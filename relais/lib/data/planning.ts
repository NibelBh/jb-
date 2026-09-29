import 'server-only';
import type { Ctx } from '../auth';
import { type Db, all, get, run, transaction } from '../db';
import { addDays, formatDate, startOfWeek } from '../domain/dates';
import { normalizeHeader, parseCsv } from '../domain/csv';
import { ABSENCE_TYPES, DRIVING_POSITIONS, labelOf } from '../domain/labels';
import { type Candidate, rankReplacements } from '../domain/replacement';
import { logAudit } from './audit';
import { fullName, getEmployee, licenceCategories } from './employees';
import { notify } from './notifications';

type Actor = Pick<Ctx, 'orgId' | 'userId' | 'name' | 'origin'>;

export type RouteRow = { id: number; day: string; code: string; client: string | null; depot: string | null; start_time: string | null; notes: string | null };

export type BoardRoute = RouteRow & {
  employee_id: number | null;
  employee_name: string | null;
  vehicle_id: number | null;
  plate: string | null;
  vehicle_status: string | null;
  issues: string[];
};

export type BoardPerson = {
  employee_id: number;
  name: string;
  position: string;
  plan_status: string | null;
  route_code: string | null;
  plate: string | null;
  absence_type: string | null;
  licence_expires_on: string | null;
  on_duty_plate: string | null;
};

export type DayBoard = {
  day: string;
  routes: BoardRoute[];
  people: BoardPerson[];
  unassignedRoutes: number;
  toReplace: BoardRoute[];
};

export function dayBoard(db: Db, orgId: number, day: string): DayBoard {
  const routes = all<BoardRoute & { absence: string | null; licence_expires_on: string | null; employee_status: string | null }>(
    db,
    `SELECT r.*, p.employee_id, e.first_name || ' ' || e.last_name AS employee_name, e.status AS employee_status,
            p.vehicle_id, v.plate, v.status AS vehicle_status, e.licence_expires_on,
            (SELECT a.type FROM absences a WHERE a.org_id = r.org_id AND a.employee_id = p.employee_id AND a.start_on <= r.day AND a.end_on >= r.day AND a.type != 'retard' LIMIT 1) AS absence
       FROM routes r
       LEFT JOIN plans p ON p.route_id = r.id AND p.org_id = r.org_id AND p.status = 'travail'
       LEFT JOIN employees e ON e.id = p.employee_id
       LEFT JOIN vehicles v ON v.id = p.vehicle_id
      WHERE r.org_id = ? AND r.day = ?
      ORDER BY r.start_time, r.code`,
    orgId,
    day,
  );

  const vehicleUse = new Map<number, number>();
  for (const r of routes) if (r.vehicle_id) vehicleUse.set(r.vehicle_id, (vehicleUse.get(r.vehicle_id) ?? 0) + 1);

  const result: BoardRoute[] = routes.map((r) => {
    const issues: string[] = [];
    if (!r.employee_id) issues.push('Aucun chauffeur');
    if (r.absence) issues.push(`Chauffeur absent (${labelOf(ABSENCE_TYPES, r.absence).toLowerCase()})`);
    if (r.employee_status === 'sorti' || r.employee_status === 'suspendu') issues.push('Chauffeur non actif');
    if (r.employee_id && (!r.licence_expires_on || r.licence_expires_on < day)) issues.push('Permis expiré ou non renseigné');
    if (!r.vehicle_id) issues.push('Aucun véhicule');
    if (r.vehicle_status === 'immobilise' || r.vehicle_status === 'bloque' || r.vehicle_status === 'sorti') issues.push('Véhicule indisponible');
    if (r.vehicle_id && (vehicleUse.get(r.vehicle_id) ?? 0) > 1) issues.push('Véhicule affecté deux fois');
    return {
      id: r.id,
      day: r.day,
      code: r.code,
      client: r.client,
      depot: r.depot,
      start_time: r.start_time,
      notes: r.notes,
      employee_id: r.employee_id,
      employee_name: r.employee_name,
      vehicle_id: r.vehicle_id,
      plate: r.plate,
      vehicle_status: r.vehicle_status,
      issues,
    };
  });

  const people = all<BoardPerson>(
    db,
    `SELECT e.id AS employee_id, e.first_name || ' ' || e.last_name AS name, e.position, e.licence_expires_on,
            p.status AS plan_status, r.code AS route_code, v.plate,
            (SELECT a.type FROM absences a WHERE a.org_id = e.org_id AND a.employee_id = e.id AND a.start_on <= ? AND a.end_on >= ?
              ORDER BY a.type = 'retard' LIMIT 1) AS absence_type,
            (SELECT v2.plate FROM assignments s JOIN vehicles v2 ON v2.id = s.vehicle_id WHERE s.org_id = e.org_id AND s.employee_id = e.id AND s.ended_at IS NULL) AS on_duty_plate
       FROM employees e
       LEFT JOIN plans p ON p.employee_id = e.id AND p.org_id = e.org_id AND p.day = ?
       LEFT JOIN routes r ON r.id = p.route_id
       LEFT JOIN vehicles v ON v.id = p.vehicle_id
      WHERE e.org_id = ? AND e.status IN ('actif', 'periode_essai') AND e.position IN ('chauffeur', 'chef_equipe')
      ORDER BY e.last_name, e.first_name`,
    day,
    day,
    day,
    orgId,
  );

  return {
    day,
    routes: result,
    people,
    unassignedRoutes: result.filter((r) => !r.employee_id).length,
    toReplace: result.filter((r) => r.issues.some((i) => i.startsWith('Chauffeur absent') || i === 'Aucun chauffeur' || i === 'Permis expiré ou non renseigné')),
  };
}

export function listRoutes(db: Db, orgId: number, day: string): RouteRow[] {
  return all<RouteRow>(db, `SELECT * FROM routes WHERE org_id = ? AND day = ? ORDER BY start_time, code`, orgId, day);
}

export function getRoute(db: Db, orgId: number, id: number): RouteRow | undefined {
  return get<RouteRow>(db, `SELECT * FROM routes WHERE id = ? AND org_id = ?`, id, orgId);
}

/** Affecte un chauffeur (et un véhicule) à une tournée d'un jour. Un chauffeur n'a qu'une tournée par jour. */
export function assignRoute(
  db: Db,
  ctx: Actor,
  input: { routeId: number; employeeId: number | null; vehicleId: number | null },
): string | null {
  const route = getRoute(db, ctx.orgId, input.routeId);
  if (!route) return 'Tournée introuvable.';
  const employee = input.employeeId ? getEmployee(db, ctx.orgId, input.employeeId) : undefined;
  if (input.employeeId && !employee) return 'Salarié introuvable.';
  if (input.vehicleId && !get(db, `SELECT id FROM vehicles WHERE id = ? AND org_id = ?`, input.vehicleId, ctx.orgId)) return 'Véhicule introuvable.';

  const previous = get<{ employee_id: number; name: string }>(
    db,
    `SELECT p.employee_id, e.first_name || ' ' || e.last_name AS name FROM plans p JOIN employees e ON e.id = p.employee_id
      WHERE p.org_id = ? AND p.route_id = ?`,
    ctx.orgId,
    route.id,
  );

  transaction(db, () => {
    // Libère la tournée : l'ancien chauffeur reste planifié mais sans tournée.
    run(db, `UPDATE plans SET route_id = NULL, vehicle_id = NULL WHERE org_id = ? AND route_id = ?`, ctx.orgId, route.id);
    if (employee) {
      run(
        db,
        `INSERT INTO plans (org_id, day, employee_id, status, route_id, vehicle_id) VALUES (?, ?, ?, 'travail', ?, ?)
         ON CONFLICT (org_id, day, employee_id) DO UPDATE SET status = 'travail', route_id = excluded.route_id, vehicle_id = excluded.vehicle_id`,
        ctx.orgId,
        route.day,
        employee.id,
        route.id,
        input.vehicleId,
      );
    }
    const who = employee ? fullName(employee) : 'personne';
    logAudit(db, ctx, {
      action: 'planning',
      entityType: 'route',
      entityId: route.id,
      summary: `Tournée ${route.code} du ${formatDate(route.day)} affectée à ${who}${previous && previous.employee_id !== employee?.id ? ` (à la place de ${previous.name})` : ''}.`,
      changes: [{ field: 'employee_id', label: 'Chauffeur', before: previous?.name ?? null, after: employee ? fullName(employee) : null }],
    });
  });
  return null;
}

export function setDayStatus(db: Db, ctx: Actor, day: string, employeeId: number, status: 'travail' | 'repos'): string | null {
  const employee = getEmployee(db, ctx.orgId, employeeId);
  if (!employee) return 'Salarié introuvable.';
  run(
    db,
    `INSERT INTO plans (org_id, day, employee_id, status) VALUES (?, ?, ?, ?)
     ON CONFLICT (org_id, day, employee_id) DO UPDATE SET status = excluded.status,
       route_id = CASE WHEN excluded.status = 'repos' THEN NULL ELSE plans.route_id END,
       vehicle_id = CASE WHEN excluded.status = 'repos' THEN NULL ELSE plans.vehicle_id END`,
    ctx.orgId,
    day,
    employee.id,
    status,
  );
  logAudit(db, ctx, {
    action: 'planning',
    entityType: 'employee',
    entityId: employee.id,
    summary: `${fullName(employee)} : ${status === 'repos' ? 'repos' : 'travail'} le ${formatDate(day)}.`,
  });
  return null;
}

export function addRoute(db: Db, ctx: Actor, input: { day: string; code: string; client: string | null; depot: string | null; startTime: string | null }): string | null {
  const exists = get(db, `SELECT id FROM routes WHERE org_id = ? AND day = ? AND code = ?`, ctx.orgId, input.day, input.code);
  if (exists) return `La tournée ${input.code} existe déjà ce jour-là.`;
  const id = run(
    db,
    `INSERT INTO routes (org_id, day, code, client, depot, start_time) VALUES (?, ?, ?, ?, ?, ?)`,
    ctx.orgId,
    input.day,
    input.code,
    input.client,
    input.depot,
    input.startTime,
  ).id;
  logAudit(db, ctx, { action: 'creation', entityType: 'route', entityId: id, summary: `Tournée ${input.code} ajoutée pour le ${formatDate(input.day)}.` });
  return null;
}

export function deleteRoute(db: Db, ctx: Actor, routeId: number): void {
  const route = getRoute(db, ctx.orgId, routeId);
  if (!route) return;
  transaction(db, () => {
    run(db, `UPDATE plans SET route_id = NULL, vehicle_id = NULL WHERE org_id = ? AND route_id = ?`, ctx.orgId, route.id);
    run(db, `DELETE FROM routes WHERE id = ? AND org_id = ?`, route.id, ctx.orgId);
    logAudit(db, ctx, { action: 'suppression', entityType: 'route', entityId: route.id, summary: `Tournée ${route.code} du ${formatDate(route.day)} supprimée.` });
  });
}

export type ImportReport = { created: number; updated: number; assigned: number; errors: string[] };

/**
 * Import d'un fichier de tournées (CSV ou copie d'Excel), quel que soit le donneur d'ordre.
 * Colonnes reconnues : tournee/code/route, client/donneur_d_ordre, depot/agence/station,
 * heure/depart, chauffeur (nom complet ou identifiant), vehicule/immatriculation.
 */
export function importRoutes(db: Db, ctx: Actor, day: string, text: string): ImportReport {
  const report: ImportReport = { created: 0, updated: 0, assigned: 0, errors: [] };
  const rows = parseCsv(text);
  if (rows.length < 2) {
    report.errors.push('Le fichier doit contenir une ligne d’en-tête et au moins une tournée.');
    return report;
  }
  const header = rows[0].map(normalizeHeader);
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iCode = col('tournee', 'code', 'route', 'route_code', 'code_tournee');
  const iClient = col('client', 'donneur_d_ordre', 'donneur_dordre', 'donneur');
  const iDepot = col('depot', 'agence', 'station');
  const iTime = col('heure', 'depart', 'heure_depart', 'wave', 'vague');
  const iDriver = col('chauffeur', 'livreur', 'driver');
  const iPlate = col('vehicule', 'immatriculation', 'plaque', 'van');
  if (iCode < 0) {
    report.errors.push('Colonne « tournee » (ou « code », « route ») introuvable.');
    return report;
  }

  const employees = all<{ id: number; name: string; login: string | null }>(
    db,
    `SELECT e.id, e.first_name || ' ' || e.last_name AS name, u.login FROM employees e LEFT JOIN users u ON u.employee_id = e.id
      WHERE e.org_id = ? AND e.status != 'sorti'`,
    ctx.orgId,
  );
  const vehicles = all<{ id: number; plate: string }>(db, `SELECT id, plate FROM vehicles WHERE org_id = ? AND status != 'sorti'`, ctx.orgId);
  const norm = (s: string) => normalizeHeader(s);
  const plateKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

  transaction(db, () => {
    rows.slice(1).forEach((row, index) => {
      const line = index + 2;
      const code = row[iCode]?.trim();
      if (!code) {
        report.errors.push(`Ligne ${line} : code de tournée vide.`);
        return;
      }
      const time = iTime >= 0 ? (row[iTime] ?? '').trim() : '';
      const startTime = /^\d{1,2}[:h]\d{2}$/.test(time) ? time.replace('h', ':').padStart(5, '0') : null;
      const existing = get<{ id: number }>(db, `SELECT id FROM routes WHERE org_id = ? AND day = ? AND code = ?`, ctx.orgId, day, code);
      let routeId: number;
      if (existing) {
        run(
          db,
          `UPDATE routes SET client = COALESCE(?, client), depot = COALESCE(?, depot), start_time = COALESCE(?, start_time) WHERE id = ?`,
          iClient >= 0 ? row[iClient] || null : null,
          iDepot >= 0 ? row[iDepot] || null : null,
          startTime,
          existing.id,
        );
        routeId = existing.id;
        report.updated++;
      } else {
        routeId = run(
          db,
          `INSERT INTO routes (org_id, day, code, client, depot, start_time) VALUES (?, ?, ?, ?, ?, ?)`,
          ctx.orgId,
          day,
          code,
          iClient >= 0 ? row[iClient] || null : null,
          iDepot >= 0 ? row[iDepot] || null : null,
          startTime,
        ).id;
        report.created++;
      }

      const driverText = iDriver >= 0 ? (row[iDriver] ?? '').trim() : '';
      if (!driverText) return;
      const driver = employees.find((e) => norm(e.name) === norm(driverText) || (e.login && e.login.toLowerCase() === driverText.toLowerCase()));
      if (!driver) {
        report.errors.push(`Ligne ${line} : chauffeur « ${driverText} » introuvable, tournée ${code} laissée sans chauffeur.`);
        return;
      }
      const plateText = iPlate >= 0 ? (row[iPlate] ?? '').trim() : '';
      const vehicle = plateText ? vehicles.find((v) => plateKey(v.plate) === plateKey(plateText)) : undefined;
      if (plateText && !vehicle) report.errors.push(`Ligne ${line} : véhicule « ${plateText} » introuvable.`);
      run(db, `UPDATE plans SET route_id = NULL, vehicle_id = NULL WHERE org_id = ? AND route_id = ?`, ctx.orgId, routeId);
      run(
        db,
        `INSERT INTO plans (org_id, day, employee_id, status, route_id, vehicle_id) VALUES (?, ?, ?, 'travail', ?, ?)
         ON CONFLICT (org_id, day, employee_id) DO UPDATE SET status = 'travail', route_id = excluded.route_id, vehicle_id = excluded.vehicle_id`,
        ctx.orgId,
        day,
        driver.id,
        routeId,
        vehicle?.id ?? null,
      );
      report.assigned++;
    });
    logAudit(db, ctx, {
      action: 'import',
      entityType: 'route',
      entityId: null,
      summary: `Import des tournées du ${formatDate(day)} : ${report.created} créée(s), ${report.updated} mise(s) à jour, ${report.assigned} affectation(s), ${report.errors.length} anomalie(s).`,
    });
  });
  return report;
}

export function replacementCandidates(db: Db, orgId: number, day: string, routeId: number) {
  const route = getRoute(db, orgId, routeId);
  if (!route) return null;
  const monday = startOfWeek(day);
  const sunday = addDays(monday, 6);
  const rows = all<{
    id: number;
    name: string;
    position: string;
    status: string;
    licence_categories: string;
    licence_expires_on: string | null;
    absent: number;
    routes_that_day: number;
    knows_route: number;
    days_week: number;
  }>(
    db,
    `SELECT e.id, e.first_name || ' ' || e.last_name AS name, e.position, e.status, e.licence_categories, e.licence_expires_on,
            EXISTS (SELECT 1 FROM absences a WHERE a.org_id = e.org_id AND a.employee_id = e.id AND a.start_on <= ? AND a.end_on >= ? AND a.type != 'retard') AS absent,
            (SELECT COUNT(*) FROM plans p WHERE p.org_id = e.org_id AND p.employee_id = e.id AND p.day = ? AND p.route_id IS NOT NULL) AS routes_that_day,
            EXISTS (SELECT 1 FROM plans p JOIN routes r ON r.id = p.route_id WHERE p.org_id = e.org_id AND p.employee_id = e.id AND r.code = ? AND p.day < ?) AS knows_route,
            (SELECT COUNT(*) FROM plans p WHERE p.org_id = e.org_id AND p.employee_id = e.id AND p.status = 'travail' AND p.day BETWEEN ? AND ? AND p.day != ?) AS days_week
       FROM employees e WHERE e.org_id = ?`,
    day,
    day,
    day,
    route.code,
    day,
    monday,
    sunday,
    day,
    orgId,
  );
  const candidates: Candidate[] = rows.map((r) => ({
    employeeId: r.id,
    name: r.name,
    isDriver: DRIVING_POSITIONS.includes(r.position),
    active: r.status === 'actif' || r.status === 'periode_essai',
    absentThatDay: r.absent === 1,
    licenceValidThatDay: !!r.licence_expires_on && r.licence_expires_on >= day,
    licenceCategories: licenceCategories(r),
    plannedRoutesThatDay: r.routes_that_day,
    knowsRoute: r.knows_route === 1,
    daysPlannedThisWeek: r.days_week,
  }));
  return { route, ...rankReplacements(candidates) };
}

// ---------- Absences ----------

export function addAbsence(
  db: Db,
  ctx: Actor,
  input: { employeeId: number; type: string; startOn: string; endOn: string; note: string | null },
  today: string,
): string | null {
  const employee = getEmployee(db, ctx.orgId, input.employeeId);
  if (!employee) return 'Salarié introuvable.';
  if (input.endOn < input.startOn) return 'La date de fin doit être après la date de début.';
  transaction(db, () => {
    const id = run(
      db,
      `INSERT INTO absences (org_id, employee_id, type, start_on, end_on, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ctx.orgId,
      employee.id,
      input.type,
      input.startOn,
      input.endOn,
      input.note,
      ctx.userId,
    ).id;
    const label = labelOf(ABSENCE_TYPES, input.type).toLowerCase();
    logAudit(db, ctx, {
      action: 'absence',
      entityType: 'employee',
      entityId: employee.id,
      summary: `${fullName(employee)} : ${label} du ${formatDate(input.startOn)} au ${formatDate(input.endOn)}.`,
      changes: [{ field: 'absence', label: 'Absence', before: null, after: id }],
    });
    if (input.startOn <= today && input.endOn >= today) {
      const route = get<{ code: string }>(
        db,
        `SELECT r.code FROM plans p JOIN routes r ON r.id = p.route_id WHERE p.org_id = ? AND p.employee_id = ? AND p.day = ?`,
        ctx.orgId,
        employee.id,
        today,
      );
      notify(db, ctx.orgId, {
        roles: ['admin', 'exploitation'],
        kind: 'absence',
        title: input.type === 'retard' ? `${fullName(employee)} est en retard` : `${fullName(employee)} est absent(e) aujourd’hui`,
        body: route ? `Tournée ${route.code} à couvrir.` : undefined,
        link: '/aujourdhui',
      });
    }
  });
  return null;
}

export function deleteAbsence(db: Db, ctx: Actor, absenceId: number): void {
  const absence = get<{ id: number; employee_id: number; type: string; start_on: string; end_on: string }>(
    db,
    `SELECT id, employee_id, type, start_on, end_on FROM absences WHERE id = ? AND org_id = ?`,
    absenceId,
    ctx.orgId,
  );
  if (!absence) return;
  const employee = getEmployee(db, ctx.orgId, absence.employee_id);
  run(db, `DELETE FROM absences WHERE id = ? AND org_id = ?`, absence.id, ctx.orgId);
  logAudit(db, ctx, {
    action: 'suppression',
    entityType: 'employee',
    entityId: absence.employee_id,
    summary: `Absence supprimée pour ${employee ? fullName(employee) : 'un salarié'} (${labelOf(ABSENCE_TYPES, absence.type).toLowerCase()} du ${formatDate(absence.start_on)} au ${formatDate(absence.end_on)}).`,
  });
}

// ---------- Semaine ----------

export type WeekCell = { status: string | null; route_code: string | null; absence: string | null };
export type WeekRow = { employee_id: number; name: string; cells: WeekCell[] };

export function weekGrid(db: Db, orgId: number, monday: string): { days: string[]; rows: WeekRow[] } {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sunday = days[6];
  const employees = all<{ id: number; name: string }>(
    db,
    `SELECT id, first_name || ' ' || last_name AS name FROM employees
      WHERE org_id = ? AND status IN ('actif', 'periode_essai') AND position IN ('chauffeur', 'chef_equipe') ORDER BY last_name, first_name`,
    orgId,
  );
  const plans = all<{ employee_id: number; day: string; status: string; code: string | null }>(
    db,
    `SELECT p.employee_id, p.day, p.status, r.code FROM plans p LEFT JOIN routes r ON r.id = p.route_id
      WHERE p.org_id = ? AND p.day BETWEEN ? AND ?`,
    orgId,
    monday,
    sunday,
  );
  const absences = all<{ employee_id: number; type: string; start_on: string; end_on: string }>(
    db,
    `SELECT employee_id, type, start_on, end_on FROM absences WHERE org_id = ? AND start_on <= ? AND end_on >= ?`,
    orgId,
    sunday,
    monday,
  );
  const rows = employees.map((e) => ({
    employee_id: e.id,
    name: e.name,
    cells: days.map((day) => {
      const plan = plans.find((p) => p.employee_id === e.id && p.day === day);
      const absence = absences.find((a) => a.employee_id === e.id && a.start_on <= day && a.end_on >= day);
      return { status: plan?.status ?? null, route_code: plan?.code ?? null, absence: absence?.type ?? null };
    }),
  }));
  return { days, rows };
}
