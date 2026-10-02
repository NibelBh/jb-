import 'server-only';
import type { Ctx } from '../auth';
import { type Db, all, dryRun, get, run, transaction } from '../db';
import { parseCsv } from '../domain/csv';
import { addDays, parisDate } from '../domain/dates';
import { type ImportReport, cell, emptyReport, mapColumns, parseAmountCell, parsePeriodCell, reportSummary } from '../domain/importing';
import {
  type PayrollCodes,
  type PayrollLine,
  type PayrollVariable,
  computePayrollLine,
  defaultCodes,
  isPayrollVariable,
  periodBounds,
  periodLabel,
  variableInfo,
} from '../domain/payroll';
import { type ShiftTimes, workedMinutes } from '../domain/shifts';
import { logAudit } from './audit';
import { fullName, getEmployee } from './employees';
import { employeeIndex, findEmployee } from './imports';

type Actor = Pick<Ctx, 'orgId' | 'userId' | 'name' | 'origin'>;

// ---------- Codes rubriques ----------

export function payrollCodes(db: Db, orgId: number): PayrollCodes {
  const codes = defaultCodes();
  for (const row of all<{ variable: string; code: string }>(db, `SELECT variable, code FROM payroll_codes WHERE org_id = ?`, orgId)) {
    if (isPayrollVariable(row.variable)) codes[row.variable] = row.code;
  }
  return codes;
}

export function savePayrollCodes(db: Db, ctx: Actor, codes: Partial<PayrollCodes>): void {
  const before = payrollCodes(db, ctx.orgId);
  const changes = (Object.keys(codes) as PayrollVariable[]).filter((k) => codes[k] && codes[k] !== before[k]);
  if (changes.length === 0) return;
  transaction(db, () => {
    for (const key of changes) {
      run(
        db,
        `INSERT INTO payroll_codes (org_id, variable, code) VALUES (?, ?, ?) ON CONFLICT (org_id, variable) DO UPDATE SET code = excluded.code`,
        ctx.orgId,
        key,
        codes[key] as string,
      );
    }
    logAudit(db, ctx, {
      action: 'parametrage',
      entityType: 'payroll',
      entityId: null,
      summary: `Codes rubriques de paie modifiés : ${changes.map((k) => `${variableInfo(k).label} ${before[k]} → ${codes[k]}`).join(', ')}.`,
    });
  });
}

// ---------- Éléments variables saisis ----------

export type PayrollItemRow = { id: number; employee_id: number; employee_name: string; variable: string; value: number; note: string | null };

export function listPayrollItems(db: Db, orgId: number, period: string): PayrollItemRow[] {
  return all<PayrollItemRow>(
    db,
    `SELECT i.id, i.employee_id, e.first_name || ' ' || e.last_name AS employee_name, i.variable, i.value, i.note
       FROM payroll_items i JOIN employees e ON e.id = i.employee_id
      WHERE i.org_id = ? AND i.period = ? ORDER BY e.last_name, i.id`,
    orgId,
    period,
  );
}

export function addPayrollItem(
  db: Db,
  ctx: Actor,
  input: { employeeId: number; period: string; variable: PayrollVariable; value: number; note: string | null },
): string | null {
  const employee = getEmployee(db, ctx.orgId, input.employeeId);
  if (!employee) return 'Salarié introuvable.';
  const info = variableInfo(input.variable);
  if (info.source !== 'manuel') return 'Cet élément est calculé automatiquement.';
  if (!Number.isFinite(input.value) || input.value === 0) return 'Indiquez une valeur différente de zéro.';
  if (input.variable === 'autre' && !input.note) return 'Précisez la nature de l’élément dans le commentaire.';
  transaction(db, () => {
    run(
      db,
      `INSERT INTO payroll_items (org_id, employee_id, period, variable, value, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ctx.orgId,
      employee.id,
      input.period,
      input.variable,
      input.value,
      input.note,
      ctx.userId,
    );
    logAudit(db, ctx, {
      action: 'paie',
      entityType: 'employee',
      entityId: employee.id,
      summary: `Élément de paie ajouté pour ${fullName(employee)} (${periodLabel(input.period)}) : ${info.label}.`,
    });
  });
  return null;
}

export function updatePayrollItem(db: Db, ctx: Actor, itemId: number, input: { value: number; note: string | null }): string | null {
  const item = get<{ id: number; employee_id: number; variable: string; period: string; value: number; note: string | null }>(
    db,
    `SELECT id, employee_id, variable, period, value, note FROM payroll_items WHERE id = ? AND org_id = ?`,
    itemId,
    ctx.orgId,
  );
  if (!item) return 'Élément introuvable.';
  if (!Number.isFinite(input.value) || input.value === 0) return 'Indiquez une valeur différente de zéro.';
  if (item.variable === 'autre' && !input.note) return 'Précisez la nature de l’élément dans le commentaire.';
  if (item.value === input.value && item.note === input.note) return null;
  const employee = getEmployee(db, ctx.orgId, item.employee_id);
  transaction(db, () => {
    run(db, `UPDATE payroll_items SET value = ?, note = ? WHERE id = ? AND org_id = ?`, input.value, input.note, item.id, ctx.orgId);
    logAudit(db, ctx, {
      action: 'paie',
      entityType: 'employee',
      entityId: item.employee_id,
      summary: `Élément de paie modifié pour ${employee ? fullName(employee) : 'un salarié'} (${periodLabel(item.period)}) : ${isPayrollVariable(item.variable) ? variableInfo(item.variable).label : item.variable}.`,
    });
  });
  return null;
}

export function deletePayrollItem(db: Db, ctx: Actor, itemId: number): void {
  const item = get<{ id: number; employee_id: number; variable: string; period: string }>(
    db,
    `SELECT id, employee_id, variable, period FROM payroll_items WHERE id = ? AND org_id = ?`,
    itemId,
    ctx.orgId,
  );
  if (!item) return;
  const employee = getEmployee(db, ctx.orgId, item.employee_id);
  transaction(db, () => {
    run(db, `DELETE FROM payroll_items WHERE id = ? AND org_id = ?`, item.id, ctx.orgId);
    logAudit(db, ctx, {
      action: 'paie',
      entityType: 'employee',
      entityId: item.employee_id,
      summary: `Élément de paie retiré pour ${employee ? fullName(employee) : 'un salarié'} (${periodLabel(item.period)}) : ${isPayrollVariable(item.variable) ? variableInfo(item.variable).label : item.variable}.`,
    });
  });
}

// ---------- Calcul du mois ----------

export type PayrollEntryRow = { employee_id: number; gross_cents: number; net_cents: number | null; employer_cost_cents: number; source: string | null; imported_at: string };

export type PayrollMonth = {
  period: string;
  lines: PayrollLine[];
  missingPayrollId: { employeeId: number; name: string }[];
  entries: Map<number, PayrollEntryRow>;
  partial: boolean;
};

/** Salariés présents dans l'entreprise pendant au moins un jour du mois. */
function employeesOf(db: Db, orgId: number, start: string, end: string) {
  return all<{ id: number; payroll_id: string | null; first_name: string; last_name: string }>(
    db,
    `SELECT id, payroll_id, first_name, last_name FROM employees
      WHERE org_id = ?
        AND (hired_on IS NULL OR hired_on <= ?)
        AND (left_on IS NULL OR left_on >= ?)
        AND NOT (status = 'sorti' AND left_on IS NULL)
      ORDER BY last_name, first_name`,
    orgId,
    end,
    start,
  );
}

export function payrollMonth(db: Db, orgId: number, period: string, today = parisDate()): PayrollMonth {
  const { start, end } = periodBounds(period);
  const employees = employeesOf(db, orgId, start, end);
  const shifts = all<ShiftTimes & { employee_id: number; route_name: string | null; status: string }>(
    db,
    `SELECT employee_id, day, start_time, end_time, actual_start, actual_end, route_name, status FROM shifts
      WHERE org_id = ? AND day BETWEEN ? AND ? AND employee_id IS NOT NULL`,
    orgId,
    start,
    end,
  );
  // Marge d'un jour de chaque côté : les instants sont en UTC, les jours à l'heure de Paris.
  const assignments = all<{ employee_id: number; started_at: string; start_km: number | null; end_km: number | null }>(
    db,
    `SELECT employee_id, started_at, start_km, end_km FROM assignments WHERE org_id = ? AND started_at >= ? AND started_at < ?`,
    orgId,
    `${addDays(start, -1)}T00:00:00Z`,
    `${addDays(end, 2)}T00:00:00Z`,
  ).map((a) => ({ ...a, day: parisDate(new Date(a.started_at)) }));
  const absences = all<{ employee_id: number; type: string; start_on: string; end_on: string; note: string | null }>(
    db,
    `SELECT employee_id, type, start_on, end_on, note FROM absences WHERE org_id = ? AND start_on <= ? AND end_on >= ?`,
    orgId,
    end,
    start,
  );
  const items = all<{ employee_id: number; variable: string; value: number; note: string | null }>(
    db,
    `SELECT employee_id, variable, value, note FROM payroll_items WHERE org_id = ? AND period = ?`,
    orgId,
    period,
  );
  const entries = new Map(
    all<PayrollEntryRow>(
      db,
      `SELECT employee_id, gross_cents, net_cents, employer_cost_cents, source, imported_at FROM payroll_entries WHERE org_id = ? AND period = ?`,
      orgId,
      period,
    ).map((e) => [e.employee_id, e]),
  );

  const lines = employees.map((e) => {
    const mine = assignments.filter((a) => a.employee_id === e.id && a.day >= start && a.day <= end);
    return computePayrollLine(
      {
        employeeId: e.id,
        payrollId: e.payroll_id,
        lastName: e.last_name,
        firstName: e.first_name,
        shifts: shifts
          .filter((s) => s.employee_id === e.id)
          .map((s) => ({ day: s.day, route_name: s.route_name, status: s.status, minutes: s.status === 'realise' ? workedMinutes(s) : 0 })),
        absences: absences.filter((a) => a.employee_id === e.id),
        items: items.filter((i) => i.employee_id === e.id),
        km: mine.reduce((sum, a) => sum + (a.start_km !== null && a.end_km !== null ? a.end_km - a.start_km : 0), 0),
      },
      period,
      today,
    );
  });

  return {
    period,
    lines,
    missingPayrollId: employees.filter((e) => !e.payroll_id).map((e) => ({ employeeId: e.id, name: `${e.first_name} ${e.last_name}` })),
    entries,
    partial: today <= end,
  };
}

// ---------- Journal de paie importé ----------

/**
 * Import du journal de paie (export du logiciel de paie ou du cabinet) :
 * brut, net et coût employeur par salarié et par mois. Sert à calculer le coût
 * salarial par tournée. Les montants ne sont jamais écrits dans le journal d'audit.
 */
export function importPayrollJournal(db: Db, ctx: Actor, text: string, defaultPeriod: string, commit: boolean): { report: ImportReport; summary: string } {
  const rows = parseCsv(text);
  const report = emptyReport(commit);
  if (rows.length < 2) {
    report.errors.push('Le fichier doit contenir une ligne d’en-tête puis au moins une ligne de données.');
    return { report, summary: reportSummary(report) };
  }
  const col = mapColumns(rows[0], {
    payrollId: ['matricule', 'matricule_paie', 'id_paie', 'numero_salarie'],
    lastName: ['nom'],
    firstName: ['prenom'],
    period: ['periode', 'mois', 'periode_de_paie'],
    gross: ['brut', 'salaire_brut', 'total_brut', 'brut_total'],
    net: ['net', 'net_a_payer', 'net_paye', 'net_verse'],
    employerCost: ['cout_employeur', 'cout_total', 'cout_total_employeur', 'total_employeur', 'cout_global'],
    employerCharges: ['charges_patronales', 'cotisations_patronales', 'charges_employeur', 'part_patronale'],
  });
  if (col.gross < 0 || (col.employerCost < 0 && col.employerCharges < 0)) {
    report.errors.push('Colonnes obligatoires : « brut » et « cout_employeur » (ou « charges_patronales »).');
    return { report, summary: reportSummary(report) };
  }
  const data = rows.slice(1);
  report.rows = data.length;
  const index = employeeIndex(db, ctx.orgId);
  const periods = new Set<string>();

  const work = () => {
    const seen = new Set<string>();
    data.forEach((row, i) => {
      const line = i + 2;
      const who = findEmployee(index, cell(row, col.payrollId), cell(row, col.lastName), cell(row, col.firstName));
      if (!who.employee) return void report.errors.push(`Ligne ${line} : ${who.error}`);
      const period = parsePeriodCell(cell(row, col.period));
      if (!period.ok) return void report.errors.push(`Ligne ${line} : ${period.error}`);
      const month = period.value ?? defaultPeriod;
      const gross = parseAmountCell(cell(row, col.gross));
      const net = parseAmountCell(cell(row, col.net));
      const cost = parseAmountCell(cell(row, col.employerCost));
      const charges = parseAmountCell(cell(row, col.employerCharges));
      for (const p of [gross, net, cost, charges]) if (!p.ok) return void report.errors.push(`Ligne ${line} : ${p.error}`);
      if (!gross.ok || !net.ok || !cost.ok || !charges.ok) return;
      if (gross.value === null) return void report.errors.push(`Ligne ${line} : salaire brut manquant.`);
      const employerCost = cost.value ?? (charges.value !== null ? gross.value + charges.value : null);
      if (employerCost === null) return void report.errors.push(`Ligne ${line} : coût employeur ou charges patronales manquant.`);
      if (employerCost < gross.value) return void report.errors.push(`Ligne ${line} : le coût employeur est inférieur au brut, vérifiez les colonnes.`);
      const key = `${who.employee.id}|${month}`;
      if (seen.has(key)) return void report.errors.push(`Ligne ${line} : ${fullName(who.employee)} apparaît deux fois pour ${periodLabel(month)}.`);
      seen.add(key);

      const existed = get(db, `SELECT id FROM payroll_entries WHERE org_id = ? AND employee_id = ? AND period = ?`, ctx.orgId, who.employee.id, month);
      run(
        db,
        `INSERT INTO payroll_entries (org_id, employee_id, period, gross_cents, net_cents, employer_cost_cents, source, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (org_id, employee_id, period) DO UPDATE SET gross_cents = excluded.gross_cents, net_cents = excluded.net_cents,
           employer_cost_cents = excluded.employer_cost_cents, source = excluded.source, imported_at = excluded.imported_at`,
        ctx.orgId,
        who.employee.id,
        month,
        gross.value,
        net.value,
        employerCost,
        `Import CSV par ${ctx.name}`,
        new Date().toISOString(),
      );
      periods.add(month);
      if (existed) report.updated++;
      else report.created++;
    });
    logAudit(db, ctx, {
      action: 'import',
      entityType: 'payroll',
      entityId: null,
      summary: `Journal de paie importé par ${ctx.name} (${[...periods].map(periodLabel).join(', ') || 'aucune période'}) : ${report.created + report.updated} salarié(s), ${report.errors.length} anomalie(s).`,
    });
  };
  if (commit) transaction(db, work);
  else dryRun(db, work);
  return { report, summary: reportSummary(report) };
}

// ---------- Exports ----------

export function recordPayrollExport(db: Db, ctx: Actor, period: string, format: 'recapitulatif' | 'import', rows: number): void {
  transaction(db, () => {
    run(
      db,
      `INSERT INTO payroll_exports (org_id, period, format, rows, user_id, actor) VALUES (?, ?, ?, ?, ?, ?)`,
      ctx.orgId,
      period,
      format,
      rows,
      ctx.userId,
      ctx.name,
    );
    logAudit(db, ctx, {
      action: 'export_paie',
      entityType: 'payroll',
      entityId: null,
      summary: `Export des variables de paie de ${periodLabel(period)} (${format === 'import' ? 'fichier d’import' : 'récapitulatif'}, ${rows} ligne(s)) par ${ctx.name}.`,
    });
  });
}

export function listPayrollExports(db: Db, orgId: number, period: string) {
  return all<{ id: number; format: string; rows: number; actor: string; created_at: string }>(
    db,
    `SELECT id, format, rows, actor, created_at FROM payroll_exports WHERE org_id = ? AND period = ? ORDER BY id DESC LIMIT 10`,
    orgId,
    period,
  );
}

