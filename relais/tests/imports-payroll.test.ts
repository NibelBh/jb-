import { beforeEach, describe, expect, it } from 'vitest';
import { type Db, get, openDatabase } from '@/lib/db/core';
import { seedDemo } from '@/lib/db/seed';
import { getEmployee } from '@/lib/data/employees';
import { runImport } from '@/lib/data/imports';
import { addPayrollItem, importPayrollJournal, payrollCodes, payrollMonth, savePayrollCodes } from '@/lib/data/payroll';
import { getVehicle, listVehicles } from '@/lib/data/vehicles';
import { decodeCsvBytes, parseCsv } from '@/lib/domain/csv';
import { parisDate } from '@/lib/domain/dates';
import { matchOption, parseAmountCell, parseDateCell, parseIntegerCell, parsePeriodCell } from '@/lib/domain/importing';
import { ENERGIES } from '@/lib/domain/labels';
import { computePayrollLine, defaultCodes, payrollImportCsv, periodBounds, recapCsv, shiftPeriod } from '@/lib/domain/payroll';

describe('lecture des fichiers', () => {
  it('garde les accents d’un CSV Excel en Windows-1252 comme en UTF-8', () => {
    // « Congé;Véhicule » encodé en Windows-1252 : é = 0xE9.
    const ansi = new Uint8Array([0x43, 0x6f, 0x6e, 0x67, 0xe9, 0x3b, 0x56, 0xe9, 0x68, 0x69, 0x63, 0x75, 0x6c, 0x65]);
    expect(decodeCsvBytes(ansi)).toBe('Congé;Véhicule');
    expect(decodeCsvBytes(new TextEncoder().encode('Congé;Véhicule'))).toBe('Congé;Véhicule');
  });

  it('lit les dates, nombres, montants et périodes à la française', () => {
    expect(parseDateCell('15/03/2023')).toEqual({ ok: true, value: '2023-03-15' });
    expect(parseDateCell('5-9-26')).toEqual({ ok: true, value: '2026-09-05' });
    expect(parseDateCell('2026-02-30').ok).toBe(false);
    expect(parseDateCell('')).toEqual({ ok: true, value: null });
    expect(parseIntegerCell('125 400')).toEqual({ ok: true, value: 125400 });
    expect(parseIntegerCell('12,5').ok).toBe(false);
    expect(parseAmountCell('1 234,56 €')).toEqual({ ok: true, value: 123456 });
    expect(parseAmountCell('1.234,56')).toEqual({ ok: true, value: 123456 });
    expect(parseAmountCell('2100.5')).toEqual({ ok: true, value: 210050 });
    expect(parsePeriodCell('09/2026')).toEqual({ ok: true, value: '2026-09' });
    expect(parsePeriodCell('15/09/2026')).toEqual({ ok: true, value: '2026-09' });
    expect(parsePeriodCell('Août 2026')).toEqual({ ok: true, value: '2026-08' });
    expect(parsePeriodCell('13/2026').ok).toBe(false);
  });

  it('reconnaît les libellés et synonymes sans tenir compte des accents', () => {
    expect(matchOption(ENERGIES, 'ÉLECTRIQUE')).toBe('electrique');
    expect(matchOption(ENERGIES, 'Gazole', { gazole: 'diesel' })).toBe('diesel');
    expect(matchOption(ENERGIES, 'charbon')).toBeNull();
  });
});

describe('préparation de la paie', () => {
  it('borne les périodes', () => {
    expect(periodBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
  });

  it('compte jours travaillés, tournées, absences datées, retards et éléments saisis', () => {
    const line = computePayrollLine(
      {
        employeeId: 1,
        payrollId: 'M001',
        lastName: 'Dupont',
        firstName: 'Jean',
        plannedDays: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-29'],
        routeDays: ['2026-09-01', '2026-09-03', '2026-09-04'],
        vehicleDays: ['2026-09-04', '2026-09-06'],
        absences: [
          { type: 'conge', start_on: '2026-08-28', end_on: '2026-09-02', note: null },
          { type: 'maladie', start_on: '2026-09-04', end_on: '2026-09-04', note: null },
          { type: 'retard', start_on: '2026-09-05', end_on: '2026-09-05', note: null },
        ],
        items: [
          { variable: 'prime', value: 100, note: 'Performance' },
          { variable: 'prime', value: 50, note: null },
        ],
        km: 1234,
      },
      '2026-09',
      '2026-09-20',
    );
    // Travaillés : 03 et 05 (planifiés, sans absence), 04 et 06 (véhicule pris) ; 01-02 en congé ; 29 dans le futur.
    expect(line.workedDays).toBe(4);
    // Tournées : 03 au planning (01 en congé, 04 en arrêt), plus 04 et 06 où un véhicule a été pris.
    expect(line.routes).toBe(3);
    expect(line.absenceDays).toEqual({ conge: 2, maladie: 1 });
    expect(line.lateCount).toBe(1);
    expect(line.absencePeriods[0]).toEqual({ type: 'conge', start: '2026-09-01', end: '2026-09-02', days: 2 });
    expect(line.manual.prime).toBe(150);

    const { csv, rows } = payrollImportCsv([line], '2026-09', { ...defaultCodes(), conge: 'CP01' });
    const parsed = parseCsv(csv);
    expect(parsed[0]).toEqual(['Matricule', 'Nom', 'Prénom', 'Code rubrique', 'Libellé', 'Valeur', 'Date début', 'Date fin']);
    expect(parsed).toContainEqual(['M001', 'Dupont', 'Jean', 'CP01', 'Congés', '2', '01/09/2026', '02/09/2026']);
    expect(parsed).toContainEqual(['M001', 'Dupont', 'Jean', 'PRIME', 'Prime', '150,00', '01/09/2026', '30/09/2026']);
    expect(parsed).toContainEqual(['M001', 'Dupont', 'Jean', 'JTRAV', 'Jours travaillés', '4', '01/09/2026', '30/09/2026']);
    expect(rows).toBe(parsed.length - 1);

    const recap = parseCsv(recapCsv([line], '2026-09'));
    expect(recap[1].slice(0, 6)).toEqual(['M001', 'Dupont', 'Jean', '2026-09', '4', '3']);
    expect(recap[1].at(-2)).toContain('Congés du 01/09/2026 au 02/09/2026');
  });
});

function adminCtx(db: Db, orgId: number) {
  const user = get<{ id: number }>(db, `SELECT id FROM users WHERE login = 'admin@demo.fr'`)!;
  return { orgId, userId: user.id, name: 'Claire Dirigeante', origin: 'web' as const };
}

describe('imports CSV et paie sur la base de démonstration', () => {
  let db: Db;
  let org: number;
  const today = parisDate();

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDemo(db, today);
    org = get<{ id: number }>(db, `SELECT id FROM organizations`)!.id;
  });

  it('vérifie un import de véhicules sans rien enregistrer, puis l’applique', () => {
    const ctx = adminCtx(db, org);
    const before = listVehicles(db, org).length;
    const existing = listVehicles(db, org).find((v) => v.plate === 'FG-481-KL')!;
    const csv = [
      'Immatriculation;Marque;Modèle;Énergie;Kilométrage;Première immatriculation',
      'hj-100-aa;Renault;Master;Électrique;1200;01/02/2025',
      `FG481KL;;Master L3H2;;${existing.current_km + 500};`,
      'HJ-200-BB;Ford;Transit;Charbon;;',
    ].join('\n');

    const preview = runImport(db, ctx, 'vehicules', csv, false);
    expect(preview.report).toMatchObject({ committed: false, rows: 3, created: 1, updated: 1 });
    expect(preview.report.errors).toEqual([expect.stringMatching(/^Ligne 4 : énergie « Charbon » inconnue/)]);
    expect(listVehicles(db, org)).toHaveLength(before);

    const done = runImport(db, ctx, 'vehicules', csv, true);
    expect(done.report).toMatchObject({ committed: true, created: 1, updated: 1 });
    expect(listVehicles(db, org)).toHaveLength(before + 1);
    expect(listVehicles(db, org).find((v) => v.plate === 'HJ-100-AA')).toMatchObject({ energy: 'electrique', current_km: 1200, first_registration_on: '2025-02-01' });
    expect(getVehicle(db, org, existing.id)).toMatchObject({ model: 'Master L3H2', brand: 'Renault', current_km: existing.current_km + 500 });
  });

  it('crée et complète des salariés, puis importe leurs absences sans doublon', () => {
    const ctx = adminCtx(db, org);
    const staff = runImport(
      db,
      ctx,
      'personnel',
      'matricule;nom;prenom;poste;contrat;date_embauche;fin_validite_permis\nM050;Durand;Alice;Livreur;CDD;01/09/2026;31/12/2035\nM001;Benali;Samir;;;;\n;Martin;Paul;Dispatcher;;;\n',
      true,
    );
    expect(staff.report).toMatchObject({ created: 2, updated: 1 });
    const alice = get<{ id: number }>(db, `SELECT id FROM employees WHERE payroll_id = 'M050'`)!;
    expect(getEmployee(db, org, alice.id)).toMatchObject({ position: 'chauffeur', contract_type: 'cdd', hired_on: '2026-09-01', licence_expires_on: '2035-12-31' });

    const absences = 'matricule;nom;prenom;type;du;au\nM050;;;CP;12/10/2026;16/10/2026\n;Durand;Alice;Formation;20/10/2026;\n;Inconnu;Bob;Congé;01/10/2026;\n';
    const first = runImport(db, ctx, 'absences', absences, true);
    expect(first.report).toMatchObject({ created: 2, skipped: 0 });
    expect(first.report.errors).toEqual(['Ligne 4 : salarié Bob Inconnu introuvable.']);
    const again = runImport(db, ctx, 'absences', absences, true);
    expect(again.report).toMatchObject({ created: 0, skipped: 2 });
  });

  it('importe des échéances de documents et met à jour le permis', () => {
    const ctx = adminCtx(db, org);
    const result = runImport(
      db,
      ctx,
      'documents',
      'immatriculation;matricule;type;reference;expire_le\nFG-481-KL;;Attestation d’assurance;POL-9;31/12/2027\n;M004;Permis de conduire;;01/06/2036\nZZ-999-ZZ;;Assurance;;01/01/2027\n',
      true,
    );
    expect(result.report.created).toBe(2);
    expect(result.report.errors[0]).toMatch(/véhicule ZZ-999-ZZ introuvable/);
    const thomas = get<{ licence_expires_on: string }>(db, `SELECT licence_expires_on FROM employees WHERE payroll_id = 'M004'`)!;
    expect(thomas.licence_expires_on).toBe('2036-06-01');
  });

  it('prépare le mois de paie et importe le journal de paie', () => {
    const ctx = adminCtx(db, org);
    const period = today.slice(0, 7);
    const karim = get<{ id: number }>(db, `SELECT id FROM employees WHERE first_name = 'Karim'`)!;
    const samir = get<{ id: number }>(db, `SELECT id FROM employees WHERE first_name = 'Samir'`)!;
    expect(addPayrollItem(db, ctx, { employeeId: samir.id, period, variable: 'prime', value: 80, note: 'Tournée difficile' })).toBeNull();
    expect(addPayrollItem(db, ctx, { employeeId: samir.id, period, variable: 'autre', value: 1, note: null })).toMatch(/Précisez/);

    const month = payrollMonth(db, org, period, today);
    expect(month.lines).toHaveLength(11);
    expect(month.missingPayrollId).toHaveLength(0);
    expect(month.lines.find((l) => l.employeeId === karim.id)?.absenceDays.maladie).toBeGreaterThanOrEqual(1);
    expect(month.lines.find((l) => l.employeeId === samir.id)).toMatchObject({ manual: { prime: 80 } });
    expect(month.lines.find((l) => l.employeeId === samir.id)!.workedDays).toBeGreaterThanOrEqual(1);

    savePayrollCodes(db, ctx, { maladie: 'AM01' });
    expect(payrollCodes(db, org).maladie).toBe('AM01');
    const file = parseCsv(payrollImportCsv(month.lines, period, payrollCodes(db, org)).csv);
    expect(file.some((r) => r[0] === 'M002' && r[3] === 'AM01')).toBe(true);

    const journal = `matricule;brut;net;charges_patronales\nM001;2 100,00;1 650,00;600,00\nM002;2 050,00;1 610,00;580,00\nM999;1 900,00;;500,00\n`;
    const preview = importPayrollJournal(db, ctx, journal, period, false);
    expect(preview.report).toMatchObject({ committed: false, created: 2 });
    expect(payrollMonth(db, org, period, today).entries.size).toBe(0);
    const done = importPayrollJournal(db, ctx, journal, period, true);
    expect(done.report.errors).toEqual(['Ligne 4 : matricule M999 inconnu.']);
    const entries = payrollMonth(db, org, period, today).entries;
    expect(entries.get(samir.id)).toMatchObject({ gross_cents: 210000, net_cents: 165000, employer_cost_cents: 270000 });
    expect(importPayrollJournal(db, ctx, journal, period, true).report).toMatchObject({ created: 0, updated: 2 });
  });
});
