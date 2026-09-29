import { beforeEach, describe, expect, it } from 'vitest';
import { type Db, all, get, openDatabase, run } from '@/lib/db/core';
import { seedDemo } from '@/lib/db/seed';
import { listAudit } from '@/lib/data/audit';
import { getDamage, listFines } from '@/lib/data/cases';
import { listDeadlines } from '@/lib/data/documents';
import { getEmployee } from '@/lib/data/employees';
import { readFile } from '@/lib/data/files';
import { runImport } from '@/lib/data/imports';
import { listNotifications } from '@/lib/data/notifications';
import { driverAt, endAssignment, openAssignmentFor, reviewInspection, startAssignment } from '@/lib/data/operations';
import { payrollMonth } from '@/lib/data/payroll';
import {
  addAbsence,
  confirmPresence,
  createShifts,
  dayBoard,
  deleteShift,
  getShift,
  listShifts,
  reassignShift,
  replacementCandidates,
  updateShift,
} from '@/lib/data/planning';
import { createUser, deleteUser, updateUser, updateVehicle } from '@/lib/data/records';
import { getVehicle, listVehicles } from '@/lib/data/vehicles';
import { addDays, parisDate } from '@/lib/domain/dates';
import { CHECKLIST, END_OF_DAY_PHOTOS, type InspectionAnswers, missingPhotos } from '@/lib/domain/inspection';
import { periodBounds } from '@/lib/domain/payroll';

const today = parisDate();

function answers(overrides: Partial<Record<string, 'ok' | 'mineur' | 'bloquant'>> = {}): InspectionAnswers {
  return Object.fromEntries(CHECKLIST.map((c) => [c.key, { result: overrides[c.key] ?? 'ok', note: overrides[c.key] ? 'test' : '' }])) as InspectionAnswers;
}

const PHOTOS = { avant: 101, droite: 102, gauche: 103, arriere: 104 };

function actor(db: Db, orgId: number, login: string, origin: 'mobile' | 'web' = 'mobile') {
  const user = get<{ id: number; name: string }>(db, `SELECT id, name FROM users WHERE login = ?`, login);
  if (!user) throw new Error(`utilisateur ${login} absent`);
  return { orgId, userId: user.id, name: user.name, origin };
}

function employeeId(db: Db, orgId: number, firstName: string): number {
  const row = get<{ id: number }>(db, `SELECT id FROM employees WHERE org_id = ? AND first_name = ?`, orgId, firstName);
  if (!row) throw new Error(firstName);
  return row.id;
}

function vehicleId(db: Db, orgId: number, plate: string): number {
  return listVehicles(db, orgId, { includeRetired: true }).find((v) => v.plate === plate)!.id;
}

function todayShift(db: Db, orgId: number, route: string) {
  return listShifts(db, orgId, { from: today, to: today }).find((s) => s.route_name === route)!;
}

/** Aucun salarié ni véhicule sur deux créneaux qui se chevauchent le même jour, aucune tournée en double. */
function overlaps(db: Db, orgId: number) {
  return all<{ id: number }>(
    db,
    `SELECT a.id FROM shifts a JOIN shifts b ON b.org_id = a.org_id AND b.day = a.day AND b.id > a.id
      WHERE a.org_id = ? AND (
        ((a.employee_id = b.employee_id OR a.vehicle_id = b.vehicle_id) AND a.start_time < b.end_time AND b.start_time < a.end_time)
        OR (a.route_name IS NOT NULL AND a.route_name = b.route_name))`,
    orgId,
  );
}

describe('données de démonstration et règles métier', () => {
  let db: Db;
  let org: number;

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDemo(db, today);
    org = get<{ id: number }>(db, `SELECT id FROM organizations`)!.id;
  });

  it('cloisonne strictement les organisations', () => {
    const other = run(db, `INSERT INTO organizations (name) VALUES ('Autre société')`).id;
    const foreignVehicle = listVehicles(db, org)[0];
    expect(listVehicles(db, other)).toHaveLength(0);
    expect(getVehicle(db, other, foreignVehicle.id)).toBeUndefined();
    expect(getEmployee(db, other, employeeId(db, org, 'Samir'))).toBeUndefined();
    expect(listFines(db, other)).toHaveLength(0);
    expect(listShifts(db, other, { from: addDays(today, -30), to: addDays(today, 30) })).toHaveLength(0);
    expect(listDeadlines(db, other, today).filter((d) => d.entity !== 'organization')).toHaveLength(0);
    const file = run(db, `INSERT INTO files (org_id, storage_key, name, mime, size) VALUES (?, 'x/y.jpg', 'y.jpg', 'image/jpeg', 1)`, org).id;
    expect(readFile(db, other, file)).toBeNull();
  });

  it('produit un jeu de démonstration cohérent : aucun chevauchement, aucune tournée en double', () => {
    expect(overlaps(db, org)).toHaveLength(0);
    // Chaque affectation d'un créneau réalisé pointe vers le bon salarié et le bon véhicule.
    const mismatched = all(
      db,
      `SELECT a.id FROM assignments a JOIN shifts s ON s.id = a.shift_id WHERE a.employee_id != s.employee_id OR a.vehicle_id != s.vehicle_id`,
    );
    expect(mismatched).toHaveLength(0);
    // Personne n'est planifié un jour d'absence (hors créneaux libérés, sans salarié).
    const onLeave = all(
      db,
      `SELECT s.id FROM shifts s JOIN absences a ON a.employee_id = s.employee_id AND s.day BETWEEN a.start_on AND a.end_on AND a.type != 'retard'`,
    );
    expect(onLeave).toHaveLength(0);
  });

  it('refuse une planification incohérente et accepte une planification correcte', () => {
    const manager = actor(db, org, 'exploitation@demo.fr', 'web');
    const ines = employeeId(db, org, 'Inès');
    const karim = employeeId(db, org, 'Karim');
    const base = { employeeId: ines, startTime: '10:00', endTime: '18:00', routeName: 'A08', vehicleId: null, notes: null };

    expect(createShifts(db, manager, { ...base, endTime: '09:00' }, [today]).error).toMatch(/fin doit être après/);
    expect(createShifts(db, manager, { ...base, employeeId: karim }, [today]).error).toMatch(/indisponible.*arrêt maladie/);
    expect(createShifts(db, manager, { ...base, routeName: 'A01' }, [today]).error).toMatch(/A01 est déjà planifiée/);
    expect(createShifts(db, manager, { ...base, vehicleId: vehicleId(db, org, 'GD-962-LM') }, [today]).error).toMatch(/assurance expirée/);
    expect(createShifts(db, manager, { ...base, vehicleId: vehicleId(db, org, 'FG-481-KL') }, [today]).error).toMatch(/déjà utilisé/);

    expect(createShifts(db, manager, base, [today])).toMatchObject({ created: 1, skipped: [] });
    expect(createShifts(db, manager, { ...base, routeName: null, startTime: '12:00', endTime: '14:00' }, [today]).error).toMatch(/chevauchent/);
    // Deuxième créneau sans chevauchement le même jour : accepté (deux tournées dans la journée).
    expect(createShifts(db, manager, { ...base, routeName: 'A09', startTime: '18:00', endTime: '20:00' }, [today]).created).toBe(1);

    // Répétition sur une semaine : les jours de congé de Julie sont sautés et signalés.
    const julie = employeeId(db, org, 'Julie');
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, 8 + i));
    const repeated = createShifts(db, manager, { ...base, employeeId: julie, routeName: null, startTime: '19:00', endTime: '21:00' }, week);
    expect(repeated.created).toBe(1);
    expect(repeated.skipped).toHaveLength(6);

    // Une assurance renouvelée débloque le véhicule.
    const gd = getVehicle(db, org, vehicleId(db, org, 'GD-962-LM'))!;
    expect(updateVehicle(db, manager, gd.id, { ...gd, insurance_start_on: today, insurance_end_on: addDays(today, 365) })).toBeNull();
    const shift = listShifts(db, org, { from: today, to: today, employeeId: ines }).find((s) => s.route_name === 'A08')!;
    expect(updateShift(db, manager, shift.id, { ...base, vehicleId: gd.id })).toBeNull();
    expect(getShift(db, org, shift.id)?.plate).toBe('GD-962-LM');
    expect(overlaps(db, org)).toHaveLength(0);
  });

  it('parcours complet : remplacement, prise du véhicule, état de fin de journée, dégât, présence, paie', () => {
    const manager = actor(db, org, 'exploitation@demo.fr', 'web');
    const [lucas, sofia, karim, samir, julie] = ['Lucas', 'Sofia', 'Karim', 'Samir', 'Julie'].map((n) => employeeId(db, org, n));

    // 1. Le tableau du jour signale A02 (Karim en arrêt, créneau libéré) et A07 (permis de Mehdi expiré).
    const board = dayBoard(db, org, today);
    expect(board.toReplace.map((s) => s.route_name).sort()).toEqual(['A02', 'A07']);
    expect(board.shifts.find((s) => s.route_name === 'A07')?.issues).toContain('Permis expiré ou non renseigné');

    // 2. Remplaçants : Lucas, Inès et Sofia sont libres ; Karim (arrêt) et Mehdi (permis) sont écartés.
    const a02 = todayShift(db, org, 'A02');
    const candidates = replacementCandidates(db, org, a02.id)!;
    expect(candidates.ranked.map((c) => c.name).sort()).toEqual(['Inès Moreau', 'Lucas Faure', 'Sofia Da Silva']);
    expect(candidates.excluded.map((e) => e.name)).toEqual(expect.arrayContaining(['Karim Lahlou', 'Mehdi Haddad']));
    expect(reassignShift(db, manager, a02.id, lucas)).toBeNull();
    expect(reassignShift(db, manager, todayShift(db, org, 'A07').id, sofia)).toBeNull();
    // Lucas n'est plus proposé sur A07 : il est déjà pris sur des horaires qui se chevauchent.
    const again = replacementCandidates(db, org, todayShift(db, org, 'A07').id)!;
    expect(again.excluded.find((e) => e.name === 'Lucas Faure')?.reason).toMatch(/Déjà planifié/);

    // 3. Karim, en arrêt et sans créneau, ne peut pas prendre de véhicule.
    const gh = vehicleId(db, org, 'GH-205-PT');
    const karimTry = startAssignment(db, actor(db, org, 'karim'), gh, { employeeId: karim, odometer: 999_999, confirmOdometer: true, answers: answers(), photos: PHOTOS, comment: '' });
    expect(karimTry).toMatchObject({ ok: false, error: expect.stringMatching(/pas planifié/) });
    // Sofia ne peut pas prendre le véhicule prévu pour Lucas.
    const sofiaTry = startAssignment(db, actor(db, org, 'sofia'), gh, { employeeId: sofia, odometer: getVehicle(db, org, gh)!.current_km, confirmOdometer: false, answers: answers(), photos: PHOTOS, comment: '' });
    expect(sofiaTry).toMatchObject({ ok: false, error: expect.stringMatching(/prévu pour Lucas Faure/) });

    // 4. Lucas prend GH-205-PT : son créneau passe « en cours ».
    const km = getVehicle(db, org, gh)!.current_km;
    const ctxLucas = actor(db, org, 'lucas');
    expect(startAssignment(db, ctxLucas, gh, { employeeId: lucas, odometer: km - 10, confirmOdometer: false, answers: answers(), photos: PHOTOS, comment: '' })).toMatchObject({ ok: false, needsOdometerConfirmation: true });
    expect(startAssignment(db, ctxLucas, gh, { employeeId: lucas, odometer: km + 3, confirmOdometer: false, answers: answers(), photos: PHOTOS, comment: '' })).toMatchObject({ ok: true, kind: 'depart' });
    expect(getShift(db, org, a02.id)).toMatchObject({ status: 'en_cours', employee_id: lucas });
    expect(getVehicle(db, org, gh)?.status).toBe('en_tournee');
    const match = driverAt(db, org, gh, new Date().toISOString());
    expect(match.kind === 'unique' && match.assignment.employeeId).toBe(lucas);
    // Un créneau commencé ne se supprime pas et ne se modifie plus depuis le planning.
    expect(deleteShift(db, manager, a02.id)).toMatch(/preuve de présence/);

    // 5. État de fin de journée : les quatre faces sont obligatoires, un nouveau dégât est localisé.
    expect(missingPhotos({ avant: 1, arriere: 2 }, END_OF_DAY_PHOTOS)).toEqual(['Côté gauche', 'Côté droit']);
    expect(missingPhotos(PHOTOS, END_OF_DAY_PHOTOS)).toEqual([]);
    expect(endAssignment(db, ctxLucas, { employeeId: lucas, odometer: km + 120, confirmOdometer: false, answers: answers(), photos: PHOTOS, comment: '', damage: { zones: [], description: 'x', photos: [], severity: 'mineur' } })).toMatchObject({ ok: false });
    const end = endAssignment(db, ctxLucas, {
      employeeId: lucas,
      odometer: km + 120,
      confirmOdometer: false,
      answers: answers(),
      photos: PHOTOS,
      comment: '',
      damage: { zones: ['cote_gauche', 'retroviseurs'], description: 'Rétroviseur gauche fendu', photos: [201], severity: 'moyen' },
    });
    expect(end).toMatchObject({ ok: true, kind: 'retour' });
    const damage = getDamage(db, org, end.ok ? end.damageId! : 0)!;
    expect(damage).toMatchObject({ zones: 'cote_gauche,retroviseurs', employee_id: lucas, vehicle_id: gh, reporter_name: 'Lucas Faure' });
    expect(JSON.parse(damage.photos)).toEqual(expect.arrayContaining([201, 101, 104]));
    expect(getShift(db, org, a02.id)).toMatchObject({ status: 'realise', closed_by: 'État de fin de journée' });
    const inspection = get<{ shift_id: number; photos: string; employee_id: number }>(db, `SELECT shift_id, photos, employee_id FROM inspections WHERE kind = 'retour' ORDER BY id DESC LIMIT 1`)!;
    expect(inspection).toMatchObject({ shift_id: a02.id, employee_id: lucas });
    expect(Object.keys(JSON.parse(inspection.photos)).sort()).toEqual(['arriere', 'avant', 'droite', 'gauche']);
    expect(getVehicle(db, org, gh)).toMatchObject({ status: 'disponible', current_km: km + 120 });

    // 6. Présence d'hier : Sofia avait oublié l'application, sa responsable confirme les heures réelles.
    const yesterday = listShifts(db, org, { from: addDays(today, -7), to: addDays(today, -1), employeeId: sofia }).find((s) => s.status === 'prevu');
    if (yesterday) {
      expect(confirmPresence(db, manager, yesterday.id, { start: '07:10', end: '15:40' })).toBeNull();
      expect(getShift(db, org, yesterday.id)).toMatchObject({ status: 'realise', closed_by: 'Nadia Roux' });
    }
    // On ne confirme pas une présence à venir.
    const tomorrow = listShifts(db, org, { from: addDays(today, 1), to: addDays(today, 1) }).find((s) => s.employee_id);
    if (tomorrow) expect(confirmPresence(db, manager, tomorrow.id, { start: '08:00', end: '16:00' })).toMatch(/à venir/);

    // 7. Une absence libère les créneaux prévus ; elle est refusée sur un jour déjà travaillé.
    const julieNext = listShifts(db, org, { from: addDays(today, 1), to: addDays(today, 6), employeeId: julie }).filter((s) => s.status === 'prevu');
    const leave = addAbsence(db, manager, { employeeId: julie, type: 'accident_travail', startOn: addDays(today, 1), endOn: addDays(today, 6), note: null }, today);
    expect(leave).toEqual({ freed: julieNext.length });
    expect(listShifts(db, org, { from: addDays(today, 1), to: addDays(today, 6), employeeId: julie })).toHaveLength(0);
    expect(addAbsence(db, manager, { employeeId: samir, type: 'maladie', startOn: today, endOn: today, note: null }, today).error).toMatch(/a travaillé/);

    // 8. Paie : les compteurs suivent la présence réelle, jour par jour et tournée par tournée.
    const period = today.slice(0, 7);
    const { start, end: last } = periodBounds(period);
    const month = payrollMonth(db, org, period, today);
    const lineLucas = month.lines.find((l) => l.employeeId === lucas)!;
    const real = get<{ days: number; routes: number }>(
      db,
      `SELECT COUNT(DISTINCT day) AS days, COUNT(route_name) AS routes FROM shifts WHERE employee_id = ? AND status = 'realise' AND day BETWEEN ? AND ?`,
      lucas,
      start,
      last,
    )!;
    expect([lineLucas.workedDays, lineLucas.routes]).toEqual([real.days, real.routes]);
    expect(lineLucas.hours).toBeGreaterThan(0);
    // Samir est en tournée mais n'a pas encore rendu son véhicule : aujourd'hui ne compte pas encore pour lui.
    const samirToday = listShifts(db, org, { from: today, to: today, employeeId: samir })[0];
    expect(samirToday.status).toBe('en_cours');
    // Les compteurs ne sont pas des copies l'un de l'autre sur l'ensemble de l'entreprise.
    const totals = month.lines.reduce((t, l) => ({ days: t.days + l.workedDays, routes: t.routes + l.routes }), { days: 0, routes: 0 });
    const expected = get<{ days: number; routes: number }>(
      db,
      `SELECT (SELECT COUNT(*) FROM (SELECT DISTINCT employee_id, day FROM shifts WHERE status = 'realise' AND day BETWEEN ? AND ? AND employee_id IS NOT NULL)) AS days,
              (SELECT COUNT(*) FROM shifts WHERE status = 'realise' AND route_name IS NOT NULL AND day BETWEEN ? AND ? AND employee_id IS NOT NULL) AS routes`,
      start,
      last,
      start,
      last,
    )!;
    expect(totals).toEqual(expected);

    // 9. Rien ne se chevauche après tout le parcours, et chaque étape est tracée.
    expect(overlaps(db, org)).toHaveLength(0);
    const summaries = listAudit(db, org, { limit: 200 }).map((a) => a.summary);
    expect(summaries.some((s) => s.includes('a été affecté à Lucas Faure'))).toBe(true);
    expect(summaries.some((s) => s.includes('créneau(x) libéré(s)'))).toBe(true);
  });

  it('bloque le départ sur un problème critique jusqu’à la décision du responsable', () => {
    const lucas = employeeId(db, org, 'Lucas');
    const manager = actor(db, org, 'exploitation@demo.fr', 'web');
    expect(reassignShift(db, manager, todayShift(db, org, 'A02').id, lucas)).toBeNull();
    const ctx = actor(db, org, 'lucas');
    const vehicle = getVehicle(db, org, vehicleId(db, org, 'GH-205-PT'))!;
    const result = startAssignment(db, ctx, vehicle.id, { employeeId: lucas, odometer: vehicle.current_km, confirmOdometer: false, answers: answers({ freins: 'bloquant' }), photos: PHOTOS, comment: '' });
    expect(result).toMatchObject({ ok: true, kind: 'bloque' });
    expect(getVehicle(db, org, vehicle.id)?.status).toBe('bloque');
    expect(openAssignmentFor(db, org, lucas)).toBeUndefined();

    const fleet = actor(db, org, 'flotte@demo.fr', 'web');
    expect(listNotifications(db, { ...fleet, roles: ['flotte'] }).some((n) => n.title.includes('problème bloquant'))).toBe(true);

    const inspection = get<{ id: number }>(db, `SELECT id FROM inspections WHERE status = 'en_attente'`)!;
    expect(reviewInspection(db, fleet, inspection.id, 'autoriser', '')).toMatch(/Indiquez/);
    expect(reviewInspection(db, fleet, inspection.id, 'autoriser', 'Freins vérifiés par le mécanicien')).toBeNull();
    expect(openAssignmentFor(db, org, lucas)?.vehicle_id).toBe(vehicle.id);
    expect(todayShift(db, org, 'A02').status).toBe('en_cours');
  });

  it('importe un planning (CSV) avec les mêmes contrôles que la saisie', () => {
    const ctx = actor(db, org, 'admin@demo.fr', 'web');
    const day = addDays(today, 30);
    const [d, m, y] = [day.slice(8, 10), day.slice(5, 7), day.slice(0, 4)];
    const csv = [
      'Date;Matricule;Nom;Prénom;Début;Fin;Tournée;Véhicule',
      `${d}/${m}/${y};M001;;;6h45;15h15;B01;fg481kl`,
      `${d}/${m}/${y};;Moreau;Inès;7:00;16:00;B02;`,
      `${d}/${m}/${y};M001;;;14:00;18:00;B03;`,
      `${d}/${m}/${y};;Inconnu;Bob;08:00;12:00;B04;`,
      `${d}/${m}/${y};M003;;;10:00;09:00;B05;`,
    ].join('\n');
    const preview = runImport(db, ctx, 'planning', csv, false);
    expect(preview.report).toMatchObject({ committed: false, created: 2 });
    expect(listShifts(db, org, { from: day, to: day })).toHaveLength(0);
    const done = runImport(db, ctx, 'planning', csv, true);
    expect(done.report).toMatchObject({ created: 2, updated: 0 });
    expect(done.report.errors).toHaveLength(3);
    expect(done.report.errors[0]).toMatch(/Ligne 4 : .*chevauchent/);
    expect(listShifts(db, org, { from: day, to: day }).find((s) => s.route_name === 'B01')).toMatchObject({ employee_name: 'Samir Benali', plate: 'FG-481-KL', start_time: '06:45', end_time: '15:15' });
    // Réimporter la même tournée la met à jour au lieu de la dupliquer.
    const update = runImport(db, ctx, 'planning', `date;matricule;debut;fin;tournee\n${d}/${m}/${y};M002;08:00;16:00;B01\n`, true);
    expect(update.report).toMatchObject({ created: 0, updated: 1 });
  });

  it('gère les membres : niveaux, désactivation, suppression, dernier administrateur protégé', () => {
    const admin = actor(db, org, 'admin@demo.fr', 'web');
    const karim = employeeId(db, org, 'Karim');
    const karimUser = get<{ id: number }>(db, `SELECT id FROM users WHERE login = 'karim'`)!;

    expect(createUser(db, admin, { name: 'Zoé', login: 'zoe', password: '123456', roles: ['chauffeur'], employeeId: null })).toMatch(/fiche du personnel/);
    expect(createUser(db, admin, { name: 'Karim bis', login: 'karim2', password: '123456', roles: ['chauffeur'], employeeId: karim })).toMatch(/déjà un accès/);
    expect(createUser(db, admin, { name: 'Paul Manager', login: 'paul@demo.fr', password: 'motdepasse', roles: ['manager'], employeeId: null })).toBeNull();

    // Désactivation temporaire puis réactivation.
    const base = { name: 'Karim Lahlou', login: 'karim', roles: ['chauffeur' as const], password: null, employeeId: karim };
    expect(updateUser(db, admin, karimUser.id, { ...base, active: false })).toBeNull();
    expect(get<{ active: number }>(db, `SELECT active FROM users WHERE id = ?`, karimUser.id)?.active).toBe(0);
    expect(updateUser(db, admin, karimUser.id, { ...base, active: true })).toBeNull();

    // L'administrateur ne peut ni se retirer ses droits, ni se supprimer ; le dernier administrateur est protégé.
    expect(updateUser(db, admin, admin.userId, { name: admin.name, login: 'admin@demo.fr', roles: ['manager'], active: true, password: null, employeeId: null })).toMatch(/propres droits/);
    expect(deleteUser(db, admin, admin.userId)).toMatch(/propre compte/);
    const paul = get<{ id: number }>(db, `SELECT id FROM users WHERE login = 'paul@demo.fr'`)!;
    expect(updateUser(db, admin, paul.id, { name: 'Paul Manager', login: 'paul@demo.fr', roles: ['admin'], active: true, password: null, employeeId: null })).toBeNull();
    const paulCtx = actor(db, org, 'paul@demo.fr', 'web');
    expect(deleteUser(db, paulCtx, admin.userId)).toBeNull();
    expect(deleteUser(db, paulCtx, paul.id)).toMatch(/propre compte/);

    // Un compte supprimé libère son identifiant et reste lisible dans l'historique.
    expect(get(db, `SELECT id FROM users WHERE login = 'admin@demo.fr'`)).toBeUndefined();
    expect(listAudit(db, org, { limit: 50 }).some((a) => a.summary.includes('Membre supprimé : Claire Dirigeante'))).toBe(true);
  });

  it('garde un journal d’audit en ajout seul', () => {
    const row = get<{ id: number }>(db, `SELECT id FROM audit_log LIMIT 1`)!;
    expect(() => run(db, `UPDATE audit_log SET summary = 'x' WHERE id = ?`, row.id)).toThrow(/ajout seul/);
    expect(() => run(db, `DELETE FROM audit_log WHERE id = ?`, row.id)).toThrow(/ajout seul/);
  });

  it('suggère le conducteur des avis de contravention de démonstration', () => {
    const fines = listFines(db, org, { open: true });
    expect(fines).toHaveLength(2);
    for (const f of fines) expect(driverAt(db, org, f.vehicle_id, f.offense_at).kind).toBe('unique');
  });

  it('signale les assurances et contrôles techniques à échéance', () => {
    const deadlines = listDeadlines(db, org, today).filter((d) => d.entity === 'vehicle');
    expect(deadlines.find((d) => d.entityLabel === 'GD-962-LM' && d.label === 'Assurance')?.status.level).toBe('expire');
    expect(deadlines.find((d) => d.entityLabel === 'GH-205-PT' && d.label === 'Assurance')?.status.level).toBe('j15');
    expect(deadlines.filter((d) => d.label === 'Contrôle technique').length).toBeGreaterThan(0);
  });
});

describe('couche base de données', () => {
  it('renvoie des objets ordinaires, transmissibles aux composants client', () => {
    const db = openDatabase(':memory:');
    seedDemo(db, today);
    const org = get<{ id: number }>(db, `SELECT id FROM organizations`)!.id;
    const [vehicle] = listVehicles(db, org);
    expect(Object.getPrototypeOf(vehicle)).toBe(Object.prototype);
  });
});
