import 'server-only';
import type { Ctx } from '../auth';
import { type Db, all, get, run, transaction } from '../db';
import { formatDate, formatDateTime } from '../domain/dates';
import { designationDeadline } from '../domain/fines';
import { DAMAGE_TYPES, FINE_STATUSES, SEVERITIES, labelOf } from '../domain/labels';
import { parseZones, zonesLabel } from '../domain/zones';
import { logAudit } from './audit';
import { fullName, getEmployee } from './employees';
import { notify } from './notifications';
import { getVehicle } from './vehicles';

type Actor = Pick<Ctx, 'orgId' | 'userId' | 'name' | 'origin'>;

// ---------- Dommages (lecture) ----------

export type DamageRow = {
  id: number;
  vehicle_id: number;
  plate: string;
  employee_id: number | null;
  employee_name: string | null;
  type: string;
  severity: string;
  status: string;
  description: string;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
  location_text: string | null;
  injured: number;
  photos: string;
  estimated_cost_cents: number | null;
  final_cost_cents: number | null;
  created_at: string;
  closed_at: string | null;
  /** Zones touchées, séparées par des virgules (voir lib/domain/zones.ts). */
  zones: string;
  /** Personne qui a enregistré le constat (compte utilisateur). */
  reporter_name: string | null;
};

const DAMAGE_SELECT = `SELECT d.*, v.plate, e.first_name || ' ' || e.last_name AS employee_name, u.name AS reporter_name
  FROM damages d JOIN vehicles v ON v.id = d.vehicle_id LEFT JOIN employees e ON e.id = d.employee_id LEFT JOIN users u ON u.id = d.reported_by`;

export function listDamages(db: Db, orgId: number, filter: { open?: boolean; vehicleId?: number; employeeId?: number } = {}): DamageRow[] {
  const where = ['d.org_id = ?'];
  const params: number[] = [orgId];
  if (filter.open) where.push(`d.status != 'cloture'`);
  if (filter.vehicleId !== undefined) {
    where.push('d.vehicle_id = ?');
    params.push(filter.vehicleId);
  }
  if (filter.employeeId !== undefined) {
    where.push('d.employee_id = ?');
    params.push(filter.employeeId);
  }
  return all<DamageRow>(db, `${DAMAGE_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC`, ...params);
}

export function getDamage(db: Db, orgId: number, id: number): DamageRow | undefined {
  return get<DamageRow>(db, `${DAMAGE_SELECT} WHERE d.id = ? AND d.org_id = ?`, id, orgId);
}

export type DamageEventRow = {
  id: number;
  author: string;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  text: string | null;
  file_id: number | null;
  file_name: string | null;
  created_at: string;
};

export function damageEvents(db: Db, orgId: number, damageId: number): DamageEventRow[] {
  return all<DamageEventRow>(
    db,
    `SELECT ev.*, f.name AS file_name FROM damage_events ev LEFT JOIN files f ON f.id = ev.file_id
      WHERE ev.org_id = ? AND ev.damage_id = ? ORDER BY ev.id`,
    orgId,
    damageId,
  );
}

export function attachToDamage(db: Db, ctx: Actor, damageId: number, fileId: number, text: string): void {
  run(
    db,
    `INSERT INTO damage_events (org_id, damage_id, user_id, author, kind, text, file_id) VALUES (?, ?, ?, ?, 'piece', ?, ?)`,
    ctx.orgId,
    damageId,
    ctx.userId,
    ctx.name,
    text || null,
    fileId,
  );
  logAudit(db, ctx, { action: 'piece', entityType: 'damage', entityId: damageId, summary: `Pièce jointe ajoutée au dossier dommage n° ${damageId}.` });
}

export function setDamageCosts(db: Db, ctx: Actor, damageId: number, estimated: number | null, final: number | null): string | null {
  const damage = getDamage(db, ctx.orgId, damageId);
  if (!damage) return 'Dossier introuvable.';
  run(db, `UPDATE damages SET estimated_cost_cents = ?, final_cost_cents = ? WHERE id = ? AND org_id = ?`, estimated, final, damageId, ctx.orgId);
  logAudit(db, ctx, {
    action: 'couts',
    entityType: 'damage',
    entityId: damageId,
    summary: `Coûts du dossier dommage n° ${damageId} mis à jour.`,
    changes: [
      { field: 'estimated_cost_cents', label: 'Coût estimé (centimes)', before: damage.estimated_cost_cents, after: estimated },
      { field: 'final_cost_cents', label: 'Coût final (centimes)', before: damage.final_cost_cents, after: final },
    ].filter((c) => c.before !== c.after),
  });
  return null;
}

export type DamageEdit = {
  vehicleId: number;
  employeeId: number | null;
  type: string;
  severity: string;
  description: string;
  occurredAt: string;
  locationText: string | null;
  zones: string[];
};

/** Correction d'un dossier dommage : chaque champ modifié est tracé dans le dossier et le journal. */
export function updateDamage(db: Db, ctx: Actor, damageId: number, input: DamageEdit): string | null {
  const damage = getDamage(db, ctx.orgId, damageId);
  if (!damage) return 'Dossier introuvable.';
  const vehicle = getVehicle(db, ctx.orgId, input.vehicleId);
  if (!vehicle) return 'Véhicule introuvable.';
  const employee = input.employeeId ? getEmployee(db, ctx.orgId, input.employeeId) : undefined;
  if (input.employeeId && !employee) return 'Salarié introuvable.';
  if (Date.parse(input.occurredAt) > Date.now() + 5 * 60_000) return 'La date du constat ne peut pas être dans le futur.';
  const zones = parseZones(input.zones.join(',')).join(',');
  const changes = [
    { field: 'vehicle_id', label: 'Véhicule', before: damage.plate, after: vehicle.plate },
    { field: 'employee_id', label: 'Conducteur', before: damage.employee_name, after: employee ? fullName(employee) : null },
    { field: 'type', label: 'Type', before: labelOf(DAMAGE_TYPES, damage.type), after: labelOf(DAMAGE_TYPES, input.type) },
    { field: 'severity', label: 'Gravité', before: labelOf(SEVERITIES, damage.severity), after: labelOf(SEVERITIES, input.severity) },
    { field: 'occurred_at', label: 'Date du constat', before: formatDateTime(damage.occurred_at), after: formatDateTime(input.occurredAt) },
    { field: 'location_text', label: 'Lieu', before: damage.location_text, after: input.locationText },
    { field: 'zones', label: 'Zones touchées', before: zonesLabel(damage.zones) || null, after: zonesLabel(zones) || null },
    { field: 'description', label: 'Description', before: damage.description, after: input.description },
  ].filter((c) => (c.before ?? null) !== (c.after ?? null));
  if (changes.length === 0) return null;
  transaction(db, () => {
    run(
      db,
      `UPDATE damages SET vehicle_id = ?, employee_id = ?, type = ?, severity = ?, description = ?, occurred_at = ?, location_text = ?, zones = ?
        WHERE id = ? AND org_id = ?`,
      vehicle.id,
      employee?.id ?? null,
      input.type,
      input.severity,
      input.description,
      input.occurredAt,
      input.locationText,
      zones,
      damage.id,
      ctx.orgId,
    );
    const what = changes.map((c) => c.label.toLowerCase()).join(', ');
    run(
      db,
      `INSERT INTO damage_events (org_id, damage_id, user_id, author, kind, text) VALUES (?, ?, ?, ?, 'commentaire', ?)`,
      ctx.orgId,
      damage.id,
      ctx.userId,
      ctx.name,
      `Dossier modifié : ${what}.`,
    );
    logAudit(db, ctx, { action: 'modification', entityType: 'damage', entityId: damage.id, summary: `Dossier dommage n° ${damage.id} modifié (${what}).`, changes });
  });
  return null;
}

/** Ajoute des photos à un dossier ; avec `replaceId`, la nouvelle photo remplace celle-ci. */
export function addDamagePhotos(db: Db, ctx: Actor, damageId: number, fileIds: number[], replaceId: number | null = null): string | null {
  const damage = getDamage(db, ctx.orgId, damageId);
  if (!damage) return 'Dossier introuvable.';
  if (fileIds.length === 0) return 'Choisissez au moins une photo.';
  const photos = (JSON.parse(damage.photos) as number[]).filter((id) => id !== replaceId);
  if (replaceId !== null && photos.length === (JSON.parse(damage.photos) as number[]).length) return 'Photo à remplacer introuvable.';
  const next = [...photos, ...fileIds].slice(0, 20);
  transaction(db, () => {
    run(db, `UPDATE damages SET photos = ? WHERE id = ? AND org_id = ?`, JSON.stringify(next), damage.id, ctx.orgId);
    logAudit(db, ctx, {
      action: 'piece',
      entityType: 'damage',
      entityId: damage.id,
      summary: replaceId !== null ? `Photo remplacée dans le dossier dommage n° ${damage.id}.` : `${fileIds.length} photo(s) ajoutée(s) au dossier dommage n° ${damage.id}.`,
    });
  });
  return null;
}

/** Retire une photo du dossier (le fichier reste archivé et lisible depuis le journal). */
export function removeDamagePhoto(db: Db, ctx: Actor, damageId: number, fileId: number): string | null {
  const damage = getDamage(db, ctx.orgId, damageId);
  if (!damage) return 'Dossier introuvable.';
  const photos = JSON.parse(damage.photos) as number[];
  if (!photos.includes(fileId)) return 'Photo introuvable.';
  run(db, `UPDATE damages SET photos = ? WHERE id = ? AND org_id = ?`, JSON.stringify(photos.filter((id) => id !== fileId)), damage.id, ctx.orgId);
  logAudit(db, ctx, { action: 'piece', entityType: 'damage', entityId: damage.id, summary: `Une photo a été retirée du dossier dommage n° ${damage.id}.` });
  return null;
}

// ---------- Amendes ----------

export type FineRow = {
  id: number;
  vehicle_id: number;
  plate: string;
  notice_number: string | null;
  offense_at: string;
  notice_sent_on: string;
  location: string | null;
  amount_cents: number | null;
  description: string | null;
  status: string;
  employee_id: number | null;
  employee_name: string | null;
  designated_on: string | null;
  notice_file_id: number | null;
  proof_file_id: number | null;
  created_at: string;
};

const FINE_SELECT = `SELECT f.*, v.plate, e.first_name || ' ' || e.last_name AS employee_name
  FROM fines f JOIN vehicles v ON v.id = f.vehicle_id LEFT JOIN employees e ON e.id = f.employee_id`;

export function listFines(db: Db, orgId: number, filter: { open?: boolean; employeeId?: number } = {}): FineRow[] {
  const where = ['f.org_id = ?'];
  const params: number[] = [orgId];
  if (filter.open) where.push(`f.status = 'a_designer'`);
  if (filter.employeeId !== undefined) {
    where.push('f.employee_id = ?');
    params.push(filter.employeeId);
  }
  return all<FineRow>(db, `${FINE_SELECT} WHERE ${where.join(' AND ')} ORDER BY f.status = 'a_designer' DESC, f.notice_sent_on ASC`, ...params);
}

export function getFine(db: Db, orgId: number, id: number): FineRow | undefined {
  return get<FineRow>(db, `${FINE_SELECT} WHERE f.id = ? AND f.org_id = ?`, id, orgId);
}

export type FineInput = {
  vehicleId: number;
  noticeNumber: string | null;
  offenseAt: string;
  noticeSentOn: string;
  location: string | null;
  amountCents: number | null;
  description: string | null;
  noticeFileId: number | null;
};

export function createFine(db: Db, ctx: Actor, input: FineInput): number {
  const vehicle = getVehicle(db, ctx.orgId, input.vehicleId);
  if (!vehicle) throw new Error('Véhicule introuvable.');
  return transaction(db, () => {
    const id = run(
      db,
      `INSERT INTO fines (org_id, vehicle_id, notice_number, offense_at, notice_sent_on, location, amount_cents, description, notice_file_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ctx.orgId,
      vehicle.id,
      input.noticeNumber,
      input.offenseAt,
      input.noticeSentOn,
      input.location,
      input.amountCents,
      input.description,
      input.noticeFileId,
    ).id;
    logAudit(db, ctx, {
      action: 'amende',
      entityType: 'fine',
      entityId: id,
      summary: `Avis de contravention enregistré pour ${vehicle.plate} (infraction du ${formatDateTime(input.offenseAt)}). Désignation avant le ${formatDate(designationDeadline(input.noticeSentOn))}.`,
    });
    return id;
  });
}

/** Correction des informations d'un avis (numéro, date, lieu, montant…). */
export function updateFine(db: Db, ctx: Actor, fineId: number, input: Omit<FineInput, 'noticeFileId'> & { noticeFileId: number | null }): string | null {
  const fine = getFine(db, ctx.orgId, fineId);
  if (!fine) return 'Avis introuvable.';
  const vehicle = getVehicle(db, ctx.orgId, input.vehicleId);
  if (!vehicle) return 'Véhicule introuvable.';
  if (input.noticeSentOn < input.offenseAt.slice(0, 10)) return 'L’avis ne peut pas être envoyé avant l’infraction.';
  const changes = [
    { field: 'vehicle_id', label: 'Véhicule', before: fine.plate, after: vehicle.plate },
    { field: 'notice_number', label: 'Numéro d’avis', before: fine.notice_number, after: input.noticeNumber },
    { field: 'offense_at', label: 'Date de l’infraction', before: formatDateTime(fine.offense_at), after: formatDateTime(input.offenseAt) },
    { field: 'notice_sent_on', label: 'Date d’envoi de l’avis', before: formatDate(fine.notice_sent_on), after: formatDate(input.noticeSentOn) },
    { field: 'location', label: 'Lieu', before: fine.location, after: input.location },
    { field: 'amount_cents', label: 'Montant (centimes)', before: fine.amount_cents, after: input.amountCents },
    { field: 'description', label: 'Infraction', before: fine.description, after: input.description },
  ].filter((c) => (c.before ?? null) !== (c.after ?? null));
  if (changes.length === 0 && !input.noticeFileId) return null;
  transaction(db, () => {
    run(
      db,
      `UPDATE fines SET vehicle_id = ?, notice_number = ?, offense_at = ?, notice_sent_on = ?, location = ?, amount_cents = ?, description = ?,
         notice_file_id = COALESCE(?, notice_file_id) WHERE id = ? AND org_id = ?`,
      vehicle.id,
      input.noticeNumber,
      input.offenseAt,
      input.noticeSentOn,
      input.location,
      input.amountCents,
      input.description,
      input.noticeFileId,
      fine.id,
      ctx.orgId,
    );
    logAudit(db, ctx, {
      action: 'modification',
      entityType: 'fine',
      entityId: fine.id,
      summary: `Avis ${input.noticeNumber ?? `n° ${fine.id}`} modifié (${[...changes.map((c) => c.label.toLowerCase()), ...(input.noticeFileId ? ['scan de l’avis'] : [])].join(', ')}).`,
      changes,
    });
  });
  return null;
}

export function designateDriver(
  db: Db,
  ctx: Actor,
  fineId: number,
  input: { employeeId: number; designatedOn: string; proofFileId: number | null },
): string | null {
  const fine = getFine(db, ctx.orgId, fineId);
  const employee = getEmployee(db, ctx.orgId, input.employeeId);
  if (!fine || !employee) return 'Avis ou salarié introuvable.';
  transaction(db, () => {
    run(
      db,
      `UPDATE fines SET status = 'designe', employee_id = ?, designated_on = ?, proof_file_id = COALESCE(?, proof_file_id) WHERE id = ? AND org_id = ?`,
      employee.id,
      input.designatedOn,
      input.proofFileId,
      fine.id,
      ctx.orgId,
    );
    logAudit(db, ctx, {
      action: 'designation',
      entityType: 'fine',
      entityId: fine.id,
      summary: `${fullName(employee)} a été désigné(e) comme conducteur pour l’avis ${fine.notice_number ?? `n° ${fine.id}`} (${fine.plate}) le ${formatDate(input.designatedOn)}.`,
      changes: [
        { field: 'status', label: 'Statut', before: fine.status, after: 'designe' },
        { field: 'employee_id', label: 'Conducteur', before: fine.employee_name, after: fullName(employee) },
      ],
    });
    const user = get<{ id: number }>(db, `SELECT id FROM users WHERE org_id = ? AND employee_id = ?`, ctx.orgId, employee.id);
    if (user) {
      notify(db, ctx.orgId, {
        userId: user.id,
        kind: 'amende',
        title: 'Vous avez été désigné(e) pour un avis de contravention',
        body: `Véhicule ${fine.plate}, le ${formatDateTime(fine.offense_at)}${fine.location ? `, ${fine.location}` : ''}. Vous recevrez l’avis à votre adresse.`,
        link: '/chauffeur',
      });
    }
  });
  return null;
}

export function setFineStatus(db: Db, ctx: Actor, fineId: number, status: string, note: string): string | null {
  const fine = getFine(db, ctx.orgId, fineId);
  if (!fine) return 'Avis introuvable.';
  if (status === 'designe') return 'Utilisez le formulaire de désignation.';
  run(db, `UPDATE fines SET status = ? WHERE id = ? AND org_id = ?`, status, fine.id, ctx.orgId);
  logAudit(db, ctx, {
    action: 'statut',
    entityType: 'fine',
    entityId: fine.id,
    summary: `Avis ${fine.notice_number ?? `n° ${fine.id}`} : statut « ${labelOf(FINE_STATUSES, status)} ».${note ? ` ${note}` : ''}`,
    changes: [{ field: 'status', label: 'Statut', before: fine.status, after: status }],
  });
  return null;
}
