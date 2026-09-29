import { beforeEach, describe, expect, it } from 'vitest';
import { type Db, get, openDatabase, run } from '@/lib/db/core';
import { seedDemo } from '@/lib/db/seed';
import { listAudit } from '@/lib/data/audit';
import { listFines } from '@/lib/data/cases';
import { listDeadlines } from '@/lib/data/documents';
import { getEmployee } from '@/lib/data/employees';
import { readFile } from '@/lib/data/files';
import { listNotifications } from '@/lib/data/notifications';
import { driverAt, endAssignment, openAssignmentFor, reviewInspection, startAssignment } from '@/lib/data/operations';
import { dayBoard, importRoutes, replacementCandidates } from '@/lib/data/planning';
import { getVehicle, listVehicles } from '@/lib/data/vehicles';
import { CHECKLIST, type InspectionAnswers } from '@/lib/domain/inspection';
import { parisDate } from '@/lib/domain/dates';

const today = parisDate();

function answers(overrides: Partial<Record<string, 'ok' | 'mineur' | 'bloquant'>> = {}): InspectionAnswers {
  return Object.fromEntries(CHECKLIST.map((c) => [c.key, { result: overrides[c.key] ?? 'ok', note: overrides[c.key] ? 'test' : '' }])) as InspectionAnswers;
}

function actor(db: Db, orgId: number, login: string) {
  const user = get<{ id: number; name: string }>(db, `SELECT id, name FROM users WHERE login = ?`, login);
  if (!user) throw new Error(`utilisateur ${login} absent`);
  return { orgId, userId: user.id, name: user.name, origin: 'mobile' as const };
}

function employeeId(db: Db, orgId: number, firstName: string): number {
  const row = get<{ id: number }>(db, `SELECT id FROM employees WHERE org_id = ? AND first_name = ?`, orgId, firstName);
  if (!row) throw new Error(firstName);
  return row.id;
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
    expect(listDeadlines(db, other, today).filter((d) => d.entity !== 'organization')).toHaveLength(0);
    const file = run(db, `INSERT INTO files (org_id, storage_key, name, mime, size) VALUES (?, 'x/y.jpg', 'y.jpg', 'image/jpeg', 1)`, org).id;
    expect(readFile(db, other, file)).toBeNull();
  });

  it('signale la tournée d’un chauffeur absent et propose des remplaçants libres', () => {
    const board = dayBoard(db, org, today);
    const a02 = board.routes.find((r) => r.code === 'A02');
    expect(a02?.issues.some((i) => i.startsWith('Chauffeur absent'))).toBe(true);
    expect(board.toReplace.map((r) => r.code)).toContain('A02');
    // Mehdi a un permis expiré et Sofia a un véhicule immobilisé.
    expect(board.routes.find((r) => r.employee_name === 'Mehdi Haddad')?.issues).toContain('Permis expiré ou non renseigné');
    expect(board.routes.find((r) => r.employee_name === 'Sofia Da Silva')?.issues).toContain('Véhicule indisponible');

    const result = replacementCandidates(db, org, today, a02!.id)!;
    const top = result.ranked.slice(0, 2).map((c) => c.name).sort();
    expect(top).toEqual(['Inès Moreau', 'Lucas Faure']);
    expect(result.excluded.map((e) => e.name)).toEqual(expect.arrayContaining(['Karim Lahlou', 'Mehdi Haddad']));
  });

  it('prend puis rend un véhicule, avec kilométrage et historique tracés', () => {
    const lucas = employeeId(db, org, 'Lucas');
    const ctx = actor(db, org, 'lucas');
    const vehicle = listVehicles(db, org).find((v) => v.status === 'disponible')!;

    const tooLow = startAssignment(db, ctx, vehicle.id, { employeeId: lucas, odometer: vehicle.current_km - 10, confirmOdometer: false, answers: answers(), photos: {}, comment: '' });
    expect(tooLow).toMatchObject({ ok: false, needsOdometerConfirmation: true });

    const start = startAssignment(db, ctx, vehicle.id, { employeeId: lucas, odometer: vehicle.current_km + 3, confirmOdometer: false, answers: answers(), photos: {}, comment: '' });
    expect(start).toMatchObject({ ok: true, kind: 'depart' });
    expect(getVehicle(db, org, vehicle.id)?.status).toBe('en_tournee');
    expect(openAssignmentFor(db, org, lucas)?.vehicle_id).toBe(vehicle.id);

    const now = new Date().toISOString();
    const match = driverAt(db, org, vehicle.id, now);
    expect(match.kind === 'unique' && match.assignment.employeeId).toBe(lucas);

    const end = endAssignment(db, ctx, { employeeId: lucas, odometer: vehicle.current_km + 120, confirmOdometer: false, answers: answers({ retroviseurs: 'mineur' }), photos: {}, comment: '' });
    expect(end).toMatchObject({ ok: true, kind: 'retour' });
    expect(end.ok && end.damageId).toBeGreaterThan(0);
    expect(getVehicle(db, org, vehicle.id)).toMatchObject({ status: 'disponible', current_km: vehicle.current_km + 120 });

    const summaries = listAudit(db, org, { entityType: 'vehicle', entityId: vehicle.id }).map((a) => a.summary);
    expect(summaries.some((s) => s.includes('a été affecté à Lucas Faure'))).toBe(true);
    expect(summaries.some((s) => s.includes('Le kilométrage de'))).toBe(true);
  });

  it('bloque le départ sur un problème critique jusqu’à la décision du responsable', () => {
    const lucas = employeeId(db, org, 'Lucas');
    const ctx = actor(db, org, 'lucas');
    const vehicle = listVehicles(db, org).find((v) => v.status === 'disponible')!;
    const result = startAssignment(db, ctx, vehicle.id, { employeeId: lucas, odometer: vehicle.current_km, confirmOdometer: false, answers: answers({ freins: 'bloquant' }), photos: {}, comment: '' });
    expect(result).toMatchObject({ ok: true, kind: 'bloque' });
    expect(getVehicle(db, org, vehicle.id)?.status).toBe('bloque');
    expect(openAssignmentFor(db, org, lucas)).toBeUndefined();

    const manager = { ...actor(db, org, 'flotte@demo.fr'), origin: 'web' as const };
    const managerCtx = { ...manager, roles: ['flotte' as const] };
    expect(listNotifications(db, managerCtx).some((n) => n.title.includes('problème bloquant'))).toBe(true);

    const inspection = get<{ id: number }>(db, `SELECT id FROM inspections WHERE status = 'en_attente'`)!;
    expect(reviewInspection(db, manager, inspection.id, 'autoriser', '')).toMatch(/Indiquez/);
    expect(reviewInspection(db, manager, inspection.id, 'autoriser', 'Freins vérifiés par le mécanicien')).toBeNull();
    expect(openAssignmentFor(db, org, lucas)?.vehicle_id).toBe(vehicle.id);
  });

  it('importe un fichier de tournées et affecte chauffeurs et véhicules', () => {
    const ctx = { ...actor(db, org, 'exploitation@demo.fr'), origin: 'web' as const };
    const report = importRoutes(db, ctx, '2030-01-07', 'Tournée;Heure;Chauffeur;Véhicule\nB01;6h45;Samir Benali;fg481kl\nB02;07:00;Inconnu;\n;07:10;;\n');
    expect(report).toMatchObject({ created: 2, updated: 0, assigned: 1 });
    expect(report.errors).toHaveLength(2);
    const board = dayBoard(db, org, '2030-01-07');
    expect(board.routes.find((r) => r.code === 'B01')).toMatchObject({ employee_name: 'Samir Benali', plate: 'FG-481-KL', start_time: '06:45' });
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
