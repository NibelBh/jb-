import { beforeEach, describe, expect, it } from 'vitest';
import { type Db, all, get, openDatabase, run } from '@/lib/db/core';
import { seedDemo } from '@/lib/db/seed';
import { countAudit, listAudit } from '@/lib/data/audit';
import { addDamagePhotos, getDamage, getFine, listFines, removeDamagePhoto, updateDamage, updateFine } from '@/lib/data/cases';
import { dashboard } from '@/lib/data/dashboard';
import { getEmployee, listAbsences } from '@/lib/data/employees';
import { importTemplate, runImport } from '@/lib/data/imports';
import { addAbsence, attributeVehicle, dayBoard, listShifts, updateAbsence } from '@/lib/data/planning';
import { addDocument, updateDocument, updateEmployee, updateVehicle } from '@/lib/data/records';
import { getVehicle, listVehicles } from '@/lib/data/vehicles';
import { toCsv } from '@/lib/domain/csv';
import { addDays, formatDate, parisDate } from '@/lib/domain/dates';

const today = parisDate();

function ctxOf(db: Db, orgId: number, login = 'admin@demo.fr') {
  const user = get<{ id: number; name: string }>(db, `SELECT id, name FROM users WHERE login = ?`, login)!;
  return { orgId, userId: user.id, name: user.name, origin: 'web' as const };
}

const idOf = (db: Db, firstName: string) => get<{ id: number }>(db, `SELECT id FROM employees WHERE first_name = ?`, firstName)!.id;
const plateId = (db: Db, plate: string) => get<{ id: number }>(db, `SELECT id FROM vehicles WHERE plate = ?`, plate)!.id;
const fr = (iso: string) => formatDate(iso);

describe('modifications et cohérence entre modules', () => {
  let db: Db;
  let org: number;

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDemo(db, today);
    org = get<{ id: number }>(db, `SELECT id FROM organizations`)!.id;
  });

  it('salarié modifié → véhicule attribué → planning → tournée → Aujourd’hui → journal', () => {
    const ctx = ctxOf(db, org);
    const thomas = idOf(db, 'Thomas');
    const employee = getEmployee(db, org, thomas)!;

    // 1. Modification de la fiche : nom et téléphone.
    const input = Object.fromEntries(Object.entries(employee).filter(([k]) => !['id', 'licence_checked_on', 'vehicle_id'].includes(k))) as Parameters<typeof updateEmployee>[3];
    expect(updateEmployee(db, ctx, thomas, { ...input, last_name: 'Petit-Durand', phone: '06 22 33 44 55' })).toBeNull();
    expect(getEmployee(db, org, thomas)).toMatchObject({ last_name: 'Petit-Durand', phone: '06 22 33 44 55' });

    // 2. Véhicule attribué : GD-962-LM, dont l'assurance vient d'être renouvelée, appliqué aux planifications à venir.
    const gj = plateId(db, 'GD-962-LM');
    expect(attributeVehicle(db, ctx, thomas, gj, true, today).updated).toBe(0); // assurance expirée : aucune tournée ne bascule
    const gd = getVehicle(db, org, gj)!;
    expect(updateVehicle(db, ctx, gj, { ...gd, insurance_start_on: today, insurance_end_on: addDays(today, 365) })).toBeNull();
    const before = listShifts(db, org, { from: today, to: addDays(today, 7), employeeId: thomas }).filter((s) => s.status === 'prevu' && s.route_name);
    const result = attributeVehicle(db, ctx, thomas, gj, true, today);
    expect(result.skipped).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(getEmployee(db, org, thomas)?.vehicle_id).toBe(gj);
    expect(listVehicles(db, org).find((v) => v.id === gj)).toMatchObject({ holder_id: thomas, holder_name: 'Thomas Petit-Durand' });

    // 3. Planning : chaque tournée à venir de Thomas part avec GD-962-LM, sauf celles où il est déjà pris (signalées).
    const after = listShifts(db, org, { from: today, to: addDays(today, 7), employeeId: thomas }).filter((s) => s.status === 'prevu' && s.route_name);
    expect(after).toHaveLength(before.length);
    expect(after.filter((s) => s.vehicle_id === gj)).toHaveLength(result.updated);
    expect(result.updated + result.skipped.length).toBe(before.filter((s) => s.vehicle_id !== gj).length);
    expect(result.updated).toBeGreaterThan(0);

    // 4. Tournée du jour et tableau « Aujourd’hui » : la tournée de Thomas affiche le nouveau véhicule, sans alerte.
    const tour = dayBoard(db, org, today).shifts.find((s) => s.employee_id === thomas)!;
    expect(tour).toMatchObject({ employee_name: 'Thomas Petit-Durand', plate: 'GD-962-LM' });
    expect(tour.issues).toEqual([]);
    const d = dashboard(db, org, today);
    expect(d.board.people.find((p) => p.employee_id === thomas)?.shifts[0].plate).toBe('GD-962-LM');
    // Aucun véhicule n'est utilisé deux fois sur des horaires qui se chevauchent.
    const clashes = all(
      db,
      `SELECT a.id FROM shifts a JOIN shifts b ON b.day = a.day AND b.id > a.id AND a.vehicle_id = b.vehicle_id AND a.start_time < b.end_time AND b.start_time < a.end_time`,
    );
    expect(clashes).toHaveLength(0);

    // 5. Journal : la modification de fiche, l'attribution et la mise à jour du planning sont tracées.
    const log = listAudit(db, org, { entityType: 'employee', entityId: thomas, limit: 10 }).map((a) => a.summary);
    expect(log.some((s) => s.includes('Fiche de Thomas Petit-Durand modifiée'))).toBe(true);
    expect(log.some((s) => s.includes('GD-962-LM est attribué à Thomas Petit-Durand'))).toBe(true);
    expect(log.some((s) => s.includes('passent sur GD-962-LM'))).toBe(true);

    // 6. Pas de doublon : le même véhicule ne peut pas être attribué à une deuxième personne.
    expect(attributeVehicle(db, ctx, idOf(db, 'Lucas'), gj, false, today).error).toMatch(/déjà attribué à Thomas Petit-Durand/);
    expect(() => run(db, `UPDATE employees SET vehicle_id = ? WHERE id = ?`, gj, idOf(db, 'Lucas'))).toThrow();
    // Un poste sans conduite ne reçoit pas de véhicule ; un véhicule sorti de flotte non plus.
    expect(attributeVehicle(db, ctx, idOf(db, 'Nadia'), plateId(db, 'GK-733-RA'), false, today).error).toMatch(/poste de conduite/);
  });

  it('corrige un dommage, ses zones et ses photos', () => {
    const ctx = ctxOf(db, org);
    const damage = get<{ id: number }>(db, `SELECT id FROM damages WHERE type = 'rayure'`)!;
    const current = getDamage(db, org, damage.id)!;
    const error = updateDamage(db, ctx, damage.id, {
      vehicleId: current.vehicle_id,
      employeeId: current.employee_id,
      type: 'carrosserie',
      severity: 'moyen',
      description: 'Rayure profonde sur la porte latérale droite',
      occurredAt: current.occurred_at,
      locationText: 'Parking client',
      zones: ['cote_droit', 'roue_ar_d', 'inconnue'],
    });
    expect(error).toBeNull();
    expect(getDamage(db, org, damage.id)).toMatchObject({ type: 'carrosserie', severity: 'moyen', zones: 'cote_droit,roue_ar_d', location_text: 'Parking client' });
    expect(listAudit(db, org, { entityType: 'damage', entityId: damage.id, limit: 5 })[0].summary).toMatch(/modifié \(type, gravité, lieu, zones touchées, description\)/);

    const f1 = run(db, `INSERT INTO files (org_id, storage_key, name, mime, size) VALUES (?, 'a/1.jpg', '1.jpg', 'image/jpeg', 1)`, org).id;
    const f2 = run(db, `INSERT INTO files (org_id, storage_key, name, mime, size) VALUES (?, 'a/2.jpg', '2.jpg', 'image/jpeg', 1)`, org).id;
    expect(addDamagePhotos(db, ctx, damage.id, [f1])).toBeNull();
    expect(addDamagePhotos(db, ctx, damage.id, [f2], f1)).toBeNull();
    expect(JSON.parse(getDamage(db, org, damage.id)!.photos)).toEqual([f2]);
    expect(removeDamagePhoto(db, ctx, damage.id, f2)).toBeNull();
    expect(JSON.parse(getDamage(db, org, damage.id)!.photos)).toEqual([]);
    expect(removeDamagePhoto(db, ctx, damage.id, f2)).toMatch(/introuvable/);
  });

  it('modifie une absence en libérant les créneaux et sans couvrir un jour travaillé', () => {
    const ctx = ctxOf(db, org);
    const julie = idOf(db, 'Julie');
    const leave = listAbsences(db, org, { from: today, to: addDays(today, 30), employeeId: julie })[0];
    const planned = listShifts(db, org, { from: addDays(today, 1), to: addDays(today, 6), employeeId: julie }).filter((s) => s.status === 'prevu');
    const moved = updateAbsence(db, ctx, leave.id, { type: 'conge', startOn: addDays(today, 1), endOn: addDays(today, 6), note: 'Avancé' }, today);
    expect(moved).toEqual({ freed: planned.length });
    expect(listAbsences(db, org, { from: today, to: addDays(today, 30), employeeId: julie })).toHaveLength(1);
    expect(listShifts(db, org, { from: addDays(today, 1), to: addDays(today, 6), employeeId: julie })).toHaveLength(0);

    // Une modification qui couvrirait un jour déjà travaillé est refusée et l'absence reste intacte.
    const current = listAbsences(db, org, { from: today, to: addDays(today, 30), employeeId: julie })[0];
    expect(updateAbsence(db, ctx, current.id, { type: 'conge', startOn: addDays(today, -3), endOn: addDays(today, 6), note: null }, today).error).toMatch(/a travaillé/);
    expect(listAbsences(db, org, { from: addDays(today, -10), to: addDays(today, 30), employeeId: julie })[0]).toMatchObject({ id: current.id, start_on: addDays(today, 1) });
    expect(addAbsence(db, ctx, { employeeId: julie, type: 'conge', startOn: addDays(today, 1), endOn: addDays(today, 6), note: null }, today).error).toMatch(/déjà enregistrée/);
  });

  it('modifie un document d’assurance et la fiche véhicule suit', () => {
    const ctx = ctxOf(db, org);
    const gd = plateId(db, 'GD-962-LM');
    expect(addDocument(db, ctx, { entity: 'vehicle', entityId: gd, type: 'assurance', reference: 'POL-1', issuedOn: today, expiresOn: addDays(today, 10), fileId: null })).toBeNull();
    const doc = get<{ id: number }>(db, `SELECT id FROM documents WHERE reference = 'POL-1'`)!;
    expect(updateDocument(db, ctx, doc.id, { type: 'assurance', reference: 'POL-2', issuedOn: today, expiresOn: addDays(today, 365), fileId: null })).toBeNull();
    expect(getVehicle(db, org, gd)).toMatchObject({ insurance_end_on: addDays(today, 365), insurance_policy: 'POL-2' });
    expect(updateDocument(db, ctx, doc.id, { type: 'assurance', reference: 'POL-2', issuedOn: today, expiresOn: addDays(today, -1), fileId: null })).toMatch(/après la date de délivrance/);
  });

  it('modifie un avis de contravention', () => {
    const ctx = ctxOf(db, org);
    const fine = listFines(db, org)[0];
    expect(updateFine(db, ctx, fine.id, { vehicleId: fine.vehicle_id, noticeNumber: 'AVIS-CORR', offenseAt: fine.offense_at, noticeSentOn: fine.notice_sent_on, location: 'Lieu corrigé', amountCents: 9000, description: fine.description, noticeFileId: null })).toBeNull();
    expect(getFine(db, org, fine.id)).toMatchObject({ notice_number: 'AVIS-CORR', location: 'Lieu corrigé', amount_cents: 9000 });
  });
});

describe('imports : modèle et validation', () => {
  let db: Db;
  let org: number;

  beforeEach(() => {
    db = openDatabase(':memory:');
    seedDemo(db, today);
    org = get<{ id: number }>(db, `SELECT id FROM organizations`)!.id;
  });

  it('reconnaît les colonnes de chaque modèle et ignore la ligne d’exemple', () => {
    const ctx = ctxOf(db, org);
    for (const kind of ['personnel', 'vehicules', 'planning', 'absences', 'documents'] as const) {
      const t = importTemplate(kind);
      expect(t.header.length).toBe(t.example.length);
      const report = runImport(db, ctx, kind, toCsv(t.header, [t.example]), false).report;
      expect(report.errors, kind).toEqual([]);
      expect(report.warnings, kind).toEqual(['Ligne 2 : c’est la ligne d’exemple du modèle, elle est ignorée.']);
    }
    expect(importTemplate('planning').header.slice(0, 1)).toEqual(['date* (JJ/MM/AAAA)']);
  });

  it('explique précisément pourquoi un fichier ou une ligne est refusé', () => {
    const ctx = ctxOf(db, org);
    // Colonnes obligatoires absentes : rien n'est lu.
    const missing = runImport(db, ctx, 'planning', 'date;matricule\n01/01/2030;M001\n', false).report;
    expect(missing.errors).toEqual(['Colonnes obligatoires absentes : « debut », « fin ». Partez du modèle CSV pour avoir les bonnes colonnes.']);

    const day = addDays(today, 40);
    const csv = [
      'date* (JJ/MM/AAAA);matricule;debut* (HH:MM);fin* (HH:MM);tournee;couleur',
      `${fr(day)};M001;07:00;15:00;B01;rouge`,
      `${fr(day)};M002;7h;15:00;B01;`,
      `${fr(day)};M003;25:00;15:00;B02;`,
      `;M003;07:00;15:00;B03;`,
      `31/02/2030;M003;07:00;15:00;B04;`,
      `${fr(day)};M999;07:00;15:00;B05;`,
    ].join('\n');
    const report = runImport(db, ctx, 'planning', csv, false).report;
    expect(report.created).toBe(1);
    expect(report.warnings).toContain('Colonne « couleur » non reconnue : elle est ignorée.');
    expect(report.errors).toEqual([
      `Ligne 3 : la tournée B01 du ${fr(day)} figure déjà ligne 2.`,
      'Ligne 4 : heure de début « 25:00 » illisible (attendu HH:MM, par exemple 07:30).',
      'Ligne 5 : la colonne « date » est vide (obligatoire).',
      expect.stringMatching(/^Ligne 6 : .*31\/02\/2030/),
      'Ligne 7 : matricule M999 inconnu.',
    ]);
    expect(listShifts(db, org, { from: day, to: day })).toHaveLength(0);

    const header = runImport(db, ctx, 'absences', 'nom;prenom;type;du;du\nBenali;Samir;Congé;01/01/2031;\n', false).report;
    expect(header.errors[0]).toMatch(/Colonne en double dans l’en-tête : « du »/);
  });
});

describe('journal', () => {
  it('pagine les 1 000 derniers événements sans jamais effacer les plus anciens', () => {
    const db = openDatabase(':memory:');
    seedDemo(db, today);
    const org = get<{ id: number }>(db, `SELECT id FROM organizations`)!.id;
    const start = countAudit(db, org);
    const insert = db.prepare(`INSERT INTO audit_log (org_id, actor, action, entity_type, entity_id, summary, origin) VALUES (?, 'Test', 'test', 'vehicle', 1, ?, 'web')`);
    for (let i = 1; i <= 1200; i++) insert.run(org, `Événement ${i}`);
    expect(countAudit(db, org)).toBe(start + 1200);
    const first = listAudit(db, org, { limit: 100, offset: 0 });
    expect(first[0].summary).toBe('Événement 1200');
    expect(listAudit(db, org, { limit: 100, offset: 900 }).at(-1)?.summary).toBe('Événement 201');
    expect(first.every((r, i) => i === 0 || r.id < first[i - 1].id)).toBe(true);
    expect(countAudit(db, org, { q: 'Événement 12' })).toBe(12);
  });
});
