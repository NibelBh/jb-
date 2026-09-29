import 'server-only';
import type { Ctx } from '../auth';
import { type Db, all, get, run, transaction } from '../db';
import { formatDateTime, parisDate } from '../domain/dates';
import { DAMAGE_STATUSES, labelOf } from '../domain/labels';
import { findDriverAt, type AssignmentInterval } from '../domain/fines';
import { CHECKLIST, type InspectionAnswers, type ItemResult, checkOdometer, formatKm, worstResult } from '../domain/inspection';
import { logAudit } from './audit';
import { fullName, getEmployee } from './employees';
import { notify } from './notifications';
import { vehicleCompliance } from '../domain/vehicles';
import { parseZones } from '../domain/zones';
import { getVehicle } from './vehicles';

type Actor = Pick<Ctx, 'orgId' | 'userId' | 'name' | 'origin'>;

export type OpenAssignment = {
  id: number;
  vehicle_id: number;
  plate: string;
  started_at: string;
  start_km: number | null;
  shift_id: number | null;
};

export function openAssignmentFor(db: Db, orgId: number, employeeId: number): OpenAssignment | undefined {
  return get<OpenAssignment>(
    db,
    `SELECT a.id, a.vehicle_id, v.plate, a.started_at, a.start_km, a.shift_id
       FROM assignments a JOIN vehicles v ON v.id = a.vehicle_id
      WHERE a.org_id = ? AND a.employee_id = ? AND a.ended_at IS NULL`,
    orgId,
    employeeId,
  );
}

export type PendingInspection = { id: number; vehicle_id: number; plate: string; created_at: string };

export function pendingInspectionFor(db: Db, orgId: number, employeeId: number): PendingInspection | undefined {
  return get<PendingInspection>(
    db,
    `SELECT i.id, i.vehicle_id, v.plate, i.created_at FROM inspections i JOIN vehicles v ON v.id = i.vehicle_id
      WHERE i.org_id = ? AND i.employee_id = ? AND i.status = 'en_attente' ORDER BY i.id DESC LIMIT 1`,
    orgId,
    employeeId,
  );
}

export type TodayShift = { id: number; day: string; start_time: string; end_time: string; route_name: string | null; vehicle_id: number | null; status: string };

/** Créneau du jour sur lequel le salarié prend son service : celui en cours, sinon le prochain prévu. */
export function currentShiftFor(db: Db, orgId: number, employeeId: number, day: string): TodayShift | undefined {
  return get<TodayShift>(
    db,
    `SELECT id, day, start_time, end_time, route_name, vehicle_id, status FROM shifts
      WHERE org_id = ? AND employee_id = ? AND day = ? AND status != 'realise'
      ORDER BY status = 'en_cours' DESC, start_time LIMIT 1`,
    orgId,
    employeeId,
    day,
  );
}

/** Nom du collègue pour qui ce véhicule est encore prévu aujourd'hui, s'il y en a un. */
export function vehicleReservedFor(db: Db, orgId: number, vehicleId: number, employeeId: number, day: string): string | null {
  const row = get<{ name: string }>(
    db,
    `SELECT e.first_name || ' ' || e.last_name AS name FROM shifts s JOIN employees e ON e.id = s.employee_id
      WHERE s.org_id = ? AND s.day = ? AND s.vehicle_id = ? AND s.employee_id != ? AND s.status = 'prevu' LIMIT 1`,
    orgId,
    day,
    vehicleId,
    employeeId,
  );
  return row?.name ?? null;
}

function startShift(db: Db, orgId: number, shiftId: number | null, vehicleId: number, at: string) {
  if (!shiftId) return;
  run(
    db,
    `UPDATE shifts SET status = 'en_cours', actual_start = COALESCE(actual_start, ?), vehicle_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? AND org_id = ?`,
    at,
    vehicleId,
    shiftId,
    orgId,
  );
}

export type InspectionInput = {
  employeeId: number;
  odometer: number;
  confirmOdometer: boolean;
  answers: InspectionAnswers;
  photos: Record<string, number>;
  comment: string;
  /** Nouveau dégât constaté pendant l'état des lieux (fin de journée). */
  damage?: { zones: string[]; description: string; photos: number[]; severity: string } | null;
};

export type InspectionOutcome =
  | { ok: true; kind: 'depart' | 'bloque' | 'retour'; vehicleId: number; plate: string; damageId?: number }
  | { ok: false; error: string; needsOdometerConfirmation?: boolean };

function problemsText(answers: InspectionAnswers): string {
  return CHECKLIST.filter((c) => answers[c.key]?.result !== 'ok')
    .map((c) => {
      const a = answers[c.key];
      const tag = a.result === 'bloquant' ? 'bloquant' : 'à surveiller';
      return `${c.label} (${tag})${a.note ? ` : ${a.note}` : ''}`;
    })
    .join(' ; ');
}

/** Prise en charge d'un véhicule par un chauffeur, avec inspection de départ. */
export function startAssignment(db: Db, ctx: Actor, vehicleId: number, input: InspectionInput): InspectionOutcome {
  const vehicle = getVehicle(db, ctx.orgId, vehicleId);
  const employee = getEmployee(db, ctx.orgId, input.employeeId);
  if (!vehicle || !employee) return { ok: false, error: 'Véhicule ou salarié introuvable.' };
  if (vehicle.status !== 'disponible') {
    return { ok: false, error: `Le véhicule ${vehicle.plate} n’est pas disponible. Contactez votre responsable.` };
  }
  if (openAssignmentFor(db, ctx.orgId, employee.id)) {
    return { ok: false, error: 'Vous avez déjà un véhicule en cours. Rendez-le avant d’en prendre un autre.' };
  }
  if (pendingInspectionFor(db, ctx.orgId, employee.id)) {
    return { ok: false, error: 'Une inspection attend la validation de votre responsable.' };
  }
  const today = parisDate();
  const shift = currentShiftFor(db, ctx.orgId, employee.id, today);
  if (!shift) return { ok: false, error: 'Vous n’êtes pas planifié(e) aujourd’hui. Contactez votre responsable.' };
  const reserved = vehicleReservedFor(db, ctx.orgId, vehicle.id, employee.id, today);
  if (reserved) {
    return { ok: false, error: `Le véhicule ${vehicle.plate} est prévu pour ${reserved} aujourd’hui. Prenez le véhicule prévu pour vous ou appelez votre responsable.` };
  }
  const compliance = vehicleCompliance(vehicle, today);
  if (compliance.blocking.length) {
    return { ok: false, error: `Le véhicule ${vehicle.plate} ne peut pas rouler : ${compliance.blocking.join(', ').toLowerCase()}. Contactez votre responsable.` };
  }
  const odo = checkOdometer(input.odometer, vehicle.current_km);
  if (!odo.ok && (odo.reason === 'invalide' || !input.confirmOdometer)) {
    return { ok: false, error: odo.message, needsOdometerConfirmation: odo.reason !== 'invalide' };
  }

  const worst = worstResult(input.answers);
  const now = new Date().toISOString();
  const driver = fullName(employee);

  return transaction(db, () => {
    const inspectionId = run(
      db,
      `INSERT INTO inspections (org_id, vehicle_id, employee_id, kind, odometer, answers, worst, photos, status, comment, created_at, shift_id)
       VALUES (?, ?, ?, 'depart', ?, ?, ?, ?, ?, ?, ?, ?)`,
      ctx.orgId,
      vehicle.id,
      employee.id,
      input.odometer,
      JSON.stringify(input.answers),
      worst,
      JSON.stringify(input.photos),
      worst === 'bloquant' ? 'en_attente' : 'validee',
      input.comment || null,
      now,
      shift.id,
    ).id;
    recordOdometer(db, ctx, vehicle.id, vehicle.plate, vehicle.current_km, input.odometer, 'inspection de départ');

    if (worst === 'bloquant') {
      run(db, `UPDATE vehicles SET status = 'bloque' WHERE id = ? AND org_id = ?`, vehicle.id, ctx.orgId);
      logAudit(db, ctx, {
        action: 'blocage',
        entityType: 'vehicle',
        entityId: vehicle.id,
        summary: `Le véhicule ${vehicle.plate} a été bloqué à l’inspection de départ de ${driver} le ${formatDateTime(now)} : ${problemsText(input.answers)}.`,
        changes: [{ field: 'status', label: 'Statut', before: vehicle.status, after: 'bloque' }],
      });
      notify(db, ctx.orgId, {
        roles: ['admin', 'manager', 'flotte', 'exploitation'],
        kind: 'inspection',
        title: `Inspection de départ ${vehicle.plate} : problème bloquant`,
        body: `${driver} : ${problemsText(input.answers)}. Véhicule bloqué en attente de validation.`,
        link: `/vehicules/${vehicle.id}`,
      });
      return { ok: true, kind: 'bloque', vehicleId: vehicle.id, plate: vehicle.plate } as const;
    }

    openAssignment(db, ctx, vehicle.id, vehicle.plate, employee.id, driver, input.odometer, inspectionId, now, 'inspection de départ, application mobile', shift.id);
    if (worst === 'mineur') {
      notify(db, ctx.orgId, {
        roles: ['manager', 'flotte'],
        kind: 'inspection',
        title: `Point à surveiller sur ${vehicle.plate}`,
        body: `${driver} : ${problemsText(input.answers)}.`,
        link: `/vehicules/${vehicle.id}`,
      });
    }
    return { ok: true, kind: 'depart', vehicleId: vehicle.id, plate: vehicle.plate } as const;
  });
}

function openAssignment(
  db: Db,
  ctx: Actor,
  vehicleId: number,
  plate: string,
  employeeId: number,
  driver: string,
  km: number,
  inspectionId: number | null,
  at: string,
  how: string,
  shiftId: number | null,
) {
  const id = run(
    db,
    `INSERT INTO assignments (org_id, vehicle_id, employee_id, started_at, start_inspection_id, start_km, source, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ctx.orgId,
    vehicleId,
    employeeId,
    at,
    inspectionId,
    km,
    ctx.origin === 'mobile' ? 'application' : 'back-office',
    shiftId,
  ).id;
  startShift(db, ctx.orgId, shiftId, vehicleId, at);
  run(db, `UPDATE vehicles SET status = 'en_tournee' WHERE id = ? AND org_id = ?`, vehicleId, ctx.orgId);
  logAudit(db, ctx, {
    action: 'affectation',
    entityType: 'vehicle',
    entityId: vehicleId,
    summary: `Le véhicule ${plate} a été affecté à ${driver} le ${formatDateTime(at)} (${how}).`,
    changes: [{ field: 'assignment', label: 'Affectation', before: null, after: id }],
  });
}

function recordOdometer(db: Db, ctx: Actor, vehicleId: number, plate: string, before: number, after: number, how: string) {
  if (after === before) return;
  run(db, `UPDATE vehicles SET current_km = ? WHERE id = ? AND org_id = ?`, after, vehicleId, ctx.orgId);
  logAudit(db, ctx, {
    action: 'kilometrage',
    entityType: 'vehicle',
    entityId: vehicleId,
    summary: `Le kilométrage de ${plate} a été modifié de ${formatKm(before)} à ${formatKm(after)} (${how}).`,
    changes: [{ field: 'current_km', label: 'Kilométrage', before, after }],
  });
}

/** Restitution du véhicule en fin de tournée, avec inspection de retour. */
export function endAssignment(db: Db, ctx: Actor, input: InspectionInput): InspectionOutcome {
  const open = openAssignmentFor(db, ctx.orgId, input.employeeId);
  if (!open) return { ok: false, error: 'Aucun véhicule en cours à rendre.' };
  if (input.damage && (input.damage.zones.length === 0 || !input.damage.description.trim())) {
    return { ok: false, error: 'Pour signaler un nouveau dégât, indiquez sa zone sur le schéma et décrivez-le.' };
  }
  const vehicle = getVehicle(db, ctx.orgId, open.vehicle_id);
  const employee = getEmployee(db, ctx.orgId, input.employeeId);
  if (!vehicle || !employee) return { ok: false, error: 'Véhicule ou salarié introuvable.' };

  const odo = checkOdometer(input.odometer, vehicle.current_km);
  if (!odo.ok && (odo.reason === 'invalide' || !input.confirmOdometer)) {
    return { ok: false, error: odo.message, needsOdometerConfirmation: odo.reason !== 'invalide' };
  }

  const worst = worstResult(input.answers);
  const now = new Date().toISOString();
  const driver = fullName(employee);

  return transaction(db, () => {
    const inspectionId = run(
      db,
      `INSERT INTO inspections (org_id, vehicle_id, employee_id, kind, odometer, answers, worst, photos, status, comment, created_at, shift_id)
       VALUES (?, ?, ?, 'retour', ?, ?, ?, ?, 'validee', ?, ?, ?)`,
      ctx.orgId,
      vehicle.id,
      employee.id,
      input.odometer,
      JSON.stringify(input.answers),
      worst,
      JSON.stringify(input.photos),
      input.comment || null,
      now,
      open.shift_id,
    ).id;
    // Fin de journée : le créneau est réalisé, avec l'heure réelle de restitution.
    if (open.shift_id) {
      run(
        db,
        `UPDATE shifts SET status = 'realise', actual_end = ?, closed_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND org_id = ?`,
        now,
        'État de fin de journée',
        open.shift_id,
        ctx.orgId,
      );
    }
    run(
      db,
      `UPDATE assignments SET ended_at = ?, end_inspection_id = ?, end_km = ? WHERE id = ? AND org_id = ?`,
      now,
      inspectionId,
      input.odometer,
      open.id,
      ctx.orgId,
    );
    recordOdometer(db, ctx, vehicle.id, vehicle.plate, vehicle.current_km, input.odometer, 'inspection de retour');
    const nextStatus = worst === 'bloquant' ? 'bloque' : 'disponible';
    run(db, `UPDATE vehicles SET status = ? WHERE id = ? AND org_id = ?`, nextStatus, vehicle.id, ctx.orgId);
    logAudit(db, ctx, {
      action: 'restitution',
      entityType: 'vehicle',
      entityId: vehicle.id,
      summary: `Le véhicule ${vehicle.plate} a été rendu par ${driver} le ${formatDateTime(now)} (${formatKm(input.odometer - (open.start_km ?? input.odometer))} parcourus).`,
      changes: [{ field: 'status', label: 'Statut', before: vehicle.status, after: nextStatus }],
    });

    let damageId: number | undefined;
    if (input.damage) {
      damageId = createDamage(db, ctx, {
        vehicleId: vehicle.id,
        employeeId: employee.id,
        type: 'carrosserie',
        severity: input.damage.severity,
        description: `${input.damage.description.trim()} (constaté à l’état de fin de journée).`,
        occurredAt: now,
        photos: [...input.damage.photos, ...Object.values(input.photos)],
        inspectionId,
        injured: false,
        zones: input.damage.zones,
      });
    } else if (worst !== 'ok') {
      damageId = createDamage(db, ctx, {
        vehicleId: vehicle.id,
        employeeId: employee.id,
        type: 'autre',
        severity: worst === 'bloquant' ? 'grave' : 'mineur',
        description: `Signalé à l’inspection de retour : ${problemsText(input.answers)}.${input.comment ? ` ${input.comment}` : ''}`,
        occurredAt: now,
        photos: Object.values(input.photos),
        inspectionId,
        injured: false,
        zones: [],
      });
    }
    return { ok: true, kind: 'retour', vehicleId: vehicle.id, plate: vehicle.plate, damageId } as const;
  });
}

/** Décision du responsable sur une inspection bloquante. */
export function reviewInspection(db: Db, ctx: Actor, inspectionId: number, decision: 'autoriser' | 'refuser', note: string): string | null {
  const inspection = get<{ id: number; vehicle_id: number; employee_id: number; odometer: number; status: string; shift_id: number | null }>(
    db,
    `SELECT id, vehicle_id, employee_id, odometer, status, shift_id FROM inspections WHERE id = ? AND org_id = ?`,
    inspectionId,
    ctx.orgId,
  );
  if (!inspection || inspection.status !== 'en_attente') return 'Cette inspection a déjà été traitée.';
  const vehicle = getVehicle(db, ctx.orgId, inspection.vehicle_id);
  const employee = getEmployee(db, ctx.orgId, inspection.employee_id);
  if (!vehicle || !employee) return 'Véhicule ou salarié introuvable.';
  if (decision === 'autoriser' && !note.trim()) return 'Indiquez pourquoi le départ est autorisé malgré le problème signalé.';
  const now = new Date().toISOString();

  transaction(db, () => {
    run(
      db,
      `UPDATE inspections SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ? AND org_id = ?`,
      decision === 'autoriser' ? 'validee' : 'refusee',
      ctx.userId,
      now,
      note.trim() || null,
      inspection.id,
      ctx.orgId,
    );
    const driver = fullName(employee);
    if (decision === 'autoriser') {
      logAudit(db, ctx, {
        action: 'deblocage',
        entityType: 'vehicle',
        entityId: vehicle.id,
        summary: `${ctx.name} a autorisé le départ de ${vehicle.plate} malgré l’inspection bloquante : ${note.trim()}`,
      });
      openAssignment(db, ctx, vehicle.id, vehicle.plate, employee.id, driver, inspection.odometer, inspection.id, now, 'départ autorisé par le responsable', inspection.shift_id);
    } else {
      logAudit(db, ctx, {
        action: 'refus_depart',
        entityType: 'vehicle',
        entityId: vehicle.id,
        summary: `${ctx.name} a refusé le départ de ${vehicle.plate} pour ${driver}.${note.trim() ? ` ${note.trim()}` : ''}`,
      });
    }
    const user = get<{ id: number }>(db, `SELECT id FROM users WHERE org_id = ? AND employee_id = ?`, ctx.orgId, employee.id);
    if (user) {
      notify(db, ctx.orgId, {
        userId: user.id,
        kind: 'inspection',
        title: decision === 'autoriser' ? `Départ autorisé avec ${vehicle.plate}` : `Départ refusé avec ${vehicle.plate}`,
        body: decision === 'autoriser' ? note.trim() : 'Votre responsable va vous attribuer un autre véhicule.',
        link: '/chauffeur',
      });
    }
  });
  return null;
}

/** Changement de statut d'un véhicule par un responsable (remise en service, immobilisation, sortie de flotte). */
export function setVehicleStatus(db: Db, ctx: Actor, vehicleId: number, status: 'disponible' | 'immobilise' | 'sorti', reason: string): string | null {
  const vehicle = getVehicle(db, ctx.orgId, vehicleId);
  if (!vehicle) return 'Véhicule introuvable.';
  if (vehicle.status === 'en_tournee') return 'Le véhicule est en tournée : il doit d’abord être rendu.';
  if (status === 'immobilise' && !reason.trim()) return 'Indiquez le motif de l’immobilisation.';
  if (vehicle.status === status) return null;
  const today = new Date().toISOString().slice(0, 10);

  transaction(db, () => {
    run(db, `UPDATE vehicles SET status = ? WHERE id = ? AND org_id = ?`, status, vehicle.id, ctx.orgId);
    if (status === 'immobilise') {
      run(db, `INSERT INTO immobilizations (org_id, vehicle_id, started_on, reason) VALUES (?, ?, ?, ?)`, ctx.orgId, vehicle.id, today, reason.trim());
    }
    if (vehicle.status === 'immobilise') {
      run(db, `UPDATE immobilizations SET ended_on = ? WHERE org_id = ? AND vehicle_id = ? AND ended_on IS NULL`, today, ctx.orgId, vehicle.id);
    }
    if (vehicle.status === 'bloque') {
      run(
        db,
        `UPDATE inspections SET status = 'refusee', reviewed_by = ?, reviewed_at = ?, review_note = COALESCE(review_note, ?)
          WHERE org_id = ? AND vehicle_id = ? AND status = 'en_attente'`,
        ctx.userId,
        new Date().toISOString(),
        'Véhicule traité par le responsable.',
        ctx.orgId,
        vehicle.id,
      );
    }
    const labels: Record<string, string> = { disponible: 'remis en service', immobilise: 'immobilisé', sorti: 'sorti de la flotte' };
    logAudit(db, ctx, {
      action: 'statut',
      entityType: 'vehicle',
      entityId: vehicle.id,
      summary: `Le véhicule ${vehicle.plate} a été ${labels[status]} par ${ctx.name}.${reason.trim() ? ` Motif : ${reason.trim()}` : ''}`,
      changes: [{ field: 'status', label: 'Statut', before: vehicle.status, after: status }],
    });
  });
  return null;
}

/**
 * Affectation saisie après coup par un responsable (oubli de l'application, véhicule de remplacement).
 * Indispensable pour pouvoir désigner un conducteur sur un avis de contravention.
 */
export function recordPastAssignment(
  db: Db,
  ctx: Actor,
  input: { vehicleId: number; employeeId: number; startedAt: string; endedAt: string },
): string | null {
  const vehicle = getVehicle(db, ctx.orgId, input.vehicleId);
  const employee = getEmployee(db, ctx.orgId, input.employeeId);
  if (!vehicle || !employee) return 'Véhicule ou salarié introuvable.';
  if (Date.parse(input.endedAt) <= Date.parse(input.startedAt)) return 'La fin doit être après le début.';
  if (Date.parse(input.endedAt) > Date.now()) return 'Une affectation passée ne peut pas finir dans le futur.';
  const overlap = get<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM assignments
      WHERE org_id = ? AND (vehicle_id = ? OR employee_id = ?)
        AND started_at < ? AND COALESCE(ended_at, ?) > ?`,
    ctx.orgId,
    vehicle.id,
    employee.id,
    input.endedAt,
    new Date().toISOString(),
    input.startedAt,
  );
  if ((overlap?.n ?? 0) > 0) return 'Cette période chevauche une affectation existante du véhicule ou du salarié.';

  transaction(db, () => {
    const id = run(
      db,
      `INSERT INTO assignments (org_id, vehicle_id, employee_id, started_at, ended_at, source) VALUES (?, ?, ?, ?, ?, 'saisie manuelle')`,
      ctx.orgId,
      vehicle.id,
      employee.id,
      input.startedAt,
      input.endedAt,
    ).id;
    logAudit(db, ctx, {
      action: 'affectation',
      entityType: 'vehicle',
      entityId: vehicle.id,
      summary: `Affectation saisie par ${ctx.name} : ${vehicle.plate} conduit par ${fullName(employee)} du ${formatDateTime(input.startedAt)} au ${formatDateTime(input.endedAt)}.`,
      changes: [{ field: 'assignment', label: 'Affectation', before: null, after: id }],
    });
  });
  return null;
}

export function intervalsForVehicle(db: Db, orgId: number, vehicleId: number): AssignmentInterval[] {
  return all<{ id: number; employee_id: number; vehicle_id: number; started_at: string; ended_at: string | null }>(
    db,
    `SELECT id, employee_id, vehicle_id, started_at, ended_at FROM assignments WHERE org_id = ? AND vehicle_id = ?`,
    orgId,
    vehicleId,
  ).map((a) => ({ id: a.id, employeeId: a.employee_id, vehicleId: a.vehicle_id, startedAt: a.started_at, endedAt: a.ended_at }));
}

export function driverAt(db: Db, orgId: number, vehicleId: number, at: string) {
  return findDriverAt(intervalsForVehicle(db, orgId, vehicleId), vehicleId, at);
}

export type InspectionRow = {
  id: number;
  vehicle_id: number;
  plate: string;
  employee_id: number;
  employee_name: string;
  kind: 'depart' | 'retour';
  odometer: number;
  answers: string;
  worst: ItemResult;
  photos: string;
  status: string;
  comment: string | null;
  review_note: string | null;
  created_at: string;
};

export function listInspections(db: Db, orgId: number, filter: { vehicleId?: number; status?: string; limit?: number }): InspectionRow[] {
  const where = ['i.org_id = ?'];
  const params: (string | number)[] = [orgId];
  if (filter.vehicleId !== undefined) {
    where.push('i.vehicle_id = ?');
    params.push(filter.vehicleId);
  }
  if (filter.status) {
    where.push('i.status = ?');
    params.push(filter.status);
  }
  params.push(filter.limit ?? 20);
  return all<InspectionRow>(
    db,
    `SELECT i.*, v.plate, e.first_name || ' ' || e.last_name AS employee_name
       FROM inspections i JOIN vehicles v ON v.id = i.vehicle_id JOIN employees e ON e.id = i.employee_id
      WHERE ${where.join(' AND ')} ORDER BY i.id DESC LIMIT ?`,
    ...params,
  );
}

// ---------- Dommages ----------

export type DamageInput = {
  vehicleId: number;
  employeeId: number | null;
  type: string;
  severity: string;
  description: string;
  occurredAt: string;
  photos: number[];
  inspectionId?: number;
  injured: boolean;
  latitude?: number | null;
  longitude?: number | null;
  locationText?: string | null;
  /** Zones du véhicule touchées (schéma). */
  zones: string[];
};

export function createDamage(db: Db, ctx: Actor, input: DamageInput): number {
  const vehicle = getVehicle(db, ctx.orgId, input.vehicleId);
  if (!vehicle) throw new Error('Véhicule introuvable.');
  const employee = input.employeeId ? getEmployee(db, ctx.orgId, input.employeeId) : undefined;
  const who = employee ? fullName(employee) : ctx.name;
  const id = run(
    db,
    `INSERT INTO damages (org_id, vehicle_id, employee_id, reported_by, type, severity, status, description, occurred_at,
       latitude, longitude, location_text, injured, photos, inspection_id, zones)
     VALUES (?, ?, ?, ?, ?, ?, 'nouveau', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ctx.orgId,
    vehicle.id,
    employee?.id ?? null,
    ctx.userId,
    input.type,
    input.severity,
    input.description,
    input.occurredAt,
    input.latitude ?? null,
    input.longitude ?? null,
    input.locationText ?? null,
    input.injured ? 1 : 0,
    JSON.stringify(input.photos),
    input.inspectionId ?? null,
    parseZones(input.zones.join(',')).join(','),
  ).id;
  run(
    db,
    `INSERT INTO damage_events (org_id, damage_id, user_id, author, kind, to_status, text) VALUES (?, ?, ?, ?, 'statut', 'nouveau', ?)`,
    ctx.orgId,
    id,
    ctx.userId,
    ctx.name,
    ctx.origin === 'mobile' ? 'Déclaration depuis l’application chauffeur.' : 'Dossier ouvert depuis le back-office.',
  );
  logAudit(db, ctx, {
    action: 'dommage',
    entityType: 'damage',
    entityId: id,
    summary: `Un dommage a été déclaré sur ${vehicle.plate} par ${who} le ${formatDateTime(input.occurredAt)}.`,
  });
  const photos = input.photos.length;
  notify(db, ctx.orgId, {
    roles: ['admin', 'manager', 'flotte', 'exploitation'],
    kind: input.type === 'accident' ? 'accident' : 'dommage',
    title: `${who} a déclaré ${input.type === 'accident' ? 'un accident' : 'un dommage'} sur ${vehicle.plate}`,
    body: `${input.description.slice(0, 140)}${photos ? ` (${photos} photo${photos > 1 ? 's' : ''})` : ''}${
      input.injured ? ' Personne blessée : déclaration d’accident du travail à faire sous 48 h.' : ''
    }`,
    link: `/dommages/${id}`,
  });
  return id;
}

export function changeDamageStatus(db: Db, ctx: Actor, damageId: number, to: string, text: string): string | null {
  const damage = get<{ id: number; status: string; vehicle_id: number }>(
    db,
    `SELECT id, status, vehicle_id FROM damages WHERE id = ? AND org_id = ?`,
    damageId,
    ctx.orgId,
  );
  if (!damage) return 'Dossier introuvable.';
  if (damage.status === to && !text.trim()) return 'Rien à enregistrer.';
  transaction(db, () => {
    if (damage.status !== to) {
      run(
        db,
        `UPDATE damages SET status = ?, closed_at = ? WHERE id = ? AND org_id = ?`,
        to,
        to === 'cloture' ? new Date().toISOString() : null,
        damage.id,
        ctx.orgId,
      );
    }
    run(
      db,
      `INSERT INTO damage_events (org_id, damage_id, user_id, author, kind, from_status, to_status, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ctx.orgId,
      damage.id,
      ctx.userId,
      ctx.name,
      damage.status !== to ? 'statut' : 'commentaire',
      damage.status !== to ? damage.status : null,
      damage.status !== to ? to : null,
      text.trim() || null,
    );
    if (damage.status !== to) {
      logAudit(db, ctx, {
        action: 'statut',
        entityType: 'damage',
        entityId: damage.id,
        summary: `Le dossier dommage n° ${damage.id} est passé de « ${labelOf(DAMAGE_STATUSES, damage.status)} » à « ${labelOf(DAMAGE_STATUSES, to)} ».`,
        changes: [{ field: 'status', label: 'Statut', before: damage.status, after: to }],
      });
    }
  });
  return null;
}
