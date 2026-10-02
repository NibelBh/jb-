import 'server-only';
import type { Ctx } from '../auth';
import { type Db, all, get, run, transaction } from '../db';
import { addDays, formatDate, parisDate, parisLocalToIso, startOfWeek } from '../domain/dates';
import { ABSENCE_TYPES, DRIVING_POSITIONS, labelOf } from '../domain/labels';
import { type Candidate, rankReplacements } from '../domain/replacement';
import { type ShiftStatus, formatRange, isTime, minutesOf, overlaps, plannedMinutes } from '../domain/shifts';
import { vehicleCompliance } from '../domain/vehicles';
import { logAudit } from './audit';
import { type EmployeeRow, employeeAvailability, fullName, getEmployee, licenceCategories, listEmployees } from './employees';
import { notify } from './notifications';
import { getVehicle } from './vehicles';

type Actor = Pick<Ctx, 'orgId' | 'userId' | 'name' | 'origin'>;

// ---------- Créneaux ----------

export type ShiftRow = {
  id: number;
  day: string;
  employee_id: number | null;
  employee_name: string | null;
  start_time: string;
  end_time: string;
  route_name: string | null;
  vehicle_id: number | null;
  plate: string | null;
  status: ShiftStatus;
  actual_start: string | null;
  actual_end: string | null;
  closed_by: string | null;
  notes: string | null;
};

const SHIFT_SELECT = `SELECT s.id, s.day, s.employee_id, e.first_name || ' ' || e.last_name AS employee_name, s.start_time, s.end_time,
       s.route_name, s.vehicle_id, v.plate, s.status, s.actual_start, s.actual_end, s.closed_by, s.notes
  FROM shifts s LEFT JOIN employees e ON e.id = s.employee_id LEFT JOIN vehicles v ON v.id = s.vehicle_id`;

export function listShifts(db: Db, orgId: number, filter: { from: string; to: string; employeeId?: number; vehicleId?: number }): ShiftRow[] {
  const where = ['s.org_id = ?', 's.day BETWEEN ? AND ?'];
  const params: (string | number)[] = [orgId, filter.from, filter.to];
  if (filter.employeeId !== undefined) {
    where.push('s.employee_id = ?');
    params.push(filter.employeeId);
  }
  if (filter.vehicleId !== undefined) {
    where.push('s.vehicle_id = ?');
    params.push(filter.vehicleId);
  }
  return all<ShiftRow>(db, `${SHIFT_SELECT} WHERE ${where.join(' AND ')} ORDER BY s.day, s.start_time, s.route_name`, ...params);
}

export function getShift(db: Db, orgId: number, id: number): ShiftRow | undefined {
  return get<ShiftRow>(db, `${SHIFT_SELECT} WHERE s.id = ? AND s.org_id = ?`, id, orgId);
}

export type ShiftInput = {
  day: string;
  employeeId: number | null;
  startTime: string;
  endTime: string;
  routeName: string | null;
  vehicleId: number | null;
  notes: string | null;
};

function describe(s: Pick<ShiftRow, 'start_time' | 'end_time' | 'route_name'>): string {
  return `${formatRange(s.start_time, s.end_time)}${s.route_name ? `, tournée ${s.route_name}` : ''}`;
}

/**
 * Contrôles d'un créneau avant enregistrement. Renvoie le premier problème bloquant, ou null.
 * Règles : horaires cohérents, salarié disponible ce jour, pas de chevauchement pour le salarié
 * ni pour le véhicule, une tournée n'est planifiée qu'une fois par jour, véhicule assuré et contrôlé.
 */
export function shiftProblem(db: Db, orgId: number, input: ShiftInput, exceptId?: number): string | null {
  if (!isTime(input.startTime) || !isTime(input.endTime)) return 'Indiquez une heure de début et une heure de fin valides.';
  if (minutesOf(input.endTime) <= minutesOf(input.startTime)) return 'L’heure de fin doit être après l’heure de début.';
  if (plannedMinutes(input.startTime, input.endTime) > 13 * 60) return 'Un créneau ne peut pas dépasser 13 heures (amplitude maximale d’une journée).';
  if (!input.employeeId && !input.routeName) return 'Indiquez au moins un salarié ou une tournée.';

  const sameDay = listShifts(db, orgId, { from: input.day, to: input.day }).filter((s) => s.id !== exceptId);
  const slot = { start_time: input.startTime, end_time: input.endTime };

  if (input.routeName) {
    const twin = sameDay.find((s) => s.route_name && s.route_name.toLowerCase() === input.routeName!.toLowerCase());
    if (twin) return `La tournée ${input.routeName} est déjà planifiée le ${formatDate(input.day)} (${twin.employee_name ?? 'sans salarié'}, ${formatRange(twin.start_time, twin.end_time)}).`;
  }

  let employee: EmployeeRow | undefined;
  if (input.employeeId) {
    employee = getEmployee(db, orgId, input.employeeId);
    if (!employee) return 'Salarié introuvable.';
    const available = employeeAvailability(db, orgId, employee, input.day);
    if (!available.available) return `${fullName(employee)} ${available.reason}.`;
    const clash = sameDay.find((s) => s.employee_id === employee!.id && overlaps(s, slot));
    if (clash) return `${fullName(employee)} est déjà planifié(e) ce jour-là de ${describe(clash)} : les horaires se chevauchent.`;
  }

  if (input.vehicleId) {
    const vehicle = getVehicle(db, orgId, input.vehicleId);
    if (!vehicle) return 'Véhicule introuvable.';
    if (vehicle.status === 'sorti') return `Le véhicule ${vehicle.plate} est sorti de la flotte.`;
    const compliance = vehicleCompliance(vehicle, input.day);
    if (compliance.blocking.length) return `Le véhicule ${vehicle.plate} ne peut pas rouler le ${formatDate(input.day)} : ${compliance.blocking.join(', ').toLowerCase()}.`;
    const clash = sameDay.find((s) => s.vehicle_id === vehicle.id && overlaps(s, slot));
    if (clash) return `Le véhicule ${vehicle.plate} est déjà utilisé ce jour-là par ${clash.employee_name ?? 'une tournée sans salarié'} (${describe(clash)}).`;
    if (employee) {
      if (!DRIVING_POSITIONS.includes(employee.position)) return `${fullName(employee)} n’occupe pas un poste de conduite : ne lui attribuez pas de véhicule.`;
      if (!employee.licence_expires_on || employee.licence_expires_on < input.day) return `Le permis de ${fullName(employee)} est expiré ou non renseigné au ${formatDate(input.day)}.`;
    }
  }
  return null;
}

function insertShift(db: Db, ctx: Actor, input: ShiftInput): number {
  return run(
    db,
    `INSERT INTO shifts (org_id, day, employee_id, start_time, end_time, route_name, vehicle_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ctx.orgId,
    input.day,
    input.employeeId,
    input.startTime,
    input.endTime,
    input.routeName,
    input.vehicleId,
    input.notes,
  ).id;
}

function who(db: Db, orgId: number, employeeId: number | null): string {
  if (!employeeId) return 'sans salarié';
  const e = getEmployee(db, orgId, employeeId);
  return e ? fullName(e) : 'un salarié';
}

/**
 * Création rapide : un créneau, ou le même créneau sur plusieurs jours (jours où le salarié
 * est indisponible ou déjà pris sautés et signalés). Tout ou rien pour un seul jour.
 */
export function createShifts(db: Db, ctx: Actor, base: Omit<ShiftInput, 'day'>, days: string[]): { created: number; skipped: string[]; error?: string } {
  if (days.length === 0) return { created: 0, skipped: [], error: 'Choisissez au moins un jour.' };
  if (days.length === 1) {
    const problem = shiftProblem(db, ctx.orgId, { ...base, day: days[0] });
    if (problem) return { created: 0, skipped: [], error: problem };
  }
  const skipped: string[] = [];
  let created = 0;
  transaction(db, () => {
    for (const day of days) {
      const input = { ...base, day };
      const problem = shiftProblem(db, ctx.orgId, input);
      if (problem) {
        skipped.push(`${formatDate(day)} : ${problem}`);
        continue;
      }
      const id = insertShift(db, ctx, input);
      created++;
      logAudit(db, ctx, {
        action: 'planning',
        entityType: 'shift',
        entityId: id,
        summary: `Planification du ${formatDate(day)} : ${who(db, ctx.orgId, input.employeeId)}, ${describe({ start_time: input.startTime, end_time: input.endTime, route_name: input.routeName })}.`,
      });
    }
  });
  if (created === 0) return { created, skipped, error: 'Aucun créneau créé.' };
  return { created, skipped };
}

export function updateShift(db: Db, ctx: Actor, shiftId: number, input: Omit<ShiftInput, 'day'> & { day?: string }): string | null {
  const shift = getShift(db, ctx.orgId, shiftId);
  if (!shift) return 'Créneau introuvable.';
  if (shift.status !== 'prevu') return 'Ce créneau a déjà commencé : corrigez la présence plutôt que le planning.';
  const next: ShiftInput = { ...input, day: input.day ?? shift.day };
  const problem = shiftProblem(db, ctx.orgId, next, shift.id);
  if (problem) return problem;
  const changes = [
    { field: 'day', label: 'Jour', before: shift.day, after: next.day },
    { field: 'employee_id', label: 'Salarié', before: shift.employee_name, after: next.employeeId ? who(db, ctx.orgId, next.employeeId) : null },
    { field: 'start_time', label: 'Début', before: shift.start_time, after: next.startTime },
    { field: 'end_time', label: 'Fin', before: shift.end_time, after: next.endTime },
    { field: 'route_name', label: 'Tournée', before: shift.route_name, after: next.routeName },
    { field: 'vehicle_id', label: 'Véhicule', before: shift.plate, after: next.vehicleId ? (getVehicle(db, ctx.orgId, next.vehicleId)?.plate ?? null) : null },
    { field: 'notes', label: 'Commentaire', before: shift.notes, after: next.notes },
  ].filter((c) => (c.before ?? null) !== (c.after ?? null));
  if (changes.length === 0) return null;
  transaction(db, () => {
    run(
      db,
      `UPDATE shifts SET day = ?, employee_id = ?, start_time = ?, end_time = ?, route_name = ?, vehicle_id = ?, notes = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND org_id = ?`,
      next.day,
      next.employeeId,
      next.startTime,
      next.endTime,
      next.routeName,
      next.vehicleId,
      next.notes,
      shift.id,
      ctx.orgId,
    );
    logAudit(db, ctx, {
      action: 'planning',
      entityType: 'shift',
      entityId: shift.id,
      summary: `Planification du ${formatDate(next.day)} modifiée (${changes.map((c) => c.label.toLowerCase()).join(', ')}).`,
      changes,
    });
  });
  return null;
}

export function deleteShift(db: Db, ctx: Actor, shiftId: number): string | null {
  const shift = getShift(db, ctx.orgId, shiftId);
  if (!shift) return 'Créneau introuvable.';
  if (shift.status !== 'prevu') return 'Ce créneau a commencé ou est terminé : il sert de preuve de présence et ne peut pas être supprimé.';
  transaction(db, () => {
    run(db, `DELETE FROM shifts WHERE id = ? AND org_id = ?`, shift.id, ctx.orgId);
    logAudit(db, ctx, {
      action: 'suppression',
      entityType: 'shift',
      entityId: shift.id,
      summary: `Planification supprimée : ${shift.employee_name ?? 'sans salarié'} le ${formatDate(shift.day)}, ${describe(shift)}.`,
    });
  });
  return null;
}

/** Remplacement : un autre salarié reprend le créneau tel quel (horaires, tournée, véhicule). */
export function reassignShift(db: Db, ctx: Actor, shiftId: number, employeeId: number): string | null {
  const shift = getShift(db, ctx.orgId, shiftId);
  if (!shift) return 'Créneau introuvable.';
  return updateShift(db, ctx, shift.id, {
    employeeId,
    startTime: shift.start_time,
    endTime: shift.end_time,
    routeName: shift.route_name,
    vehicleId: shift.vehicle_id,
    notes: shift.notes,
  });
}

// ---------- Véhicule attribué ----------

/**
 * Attribue (ou retire) un véhicule à un salarié. Un véhicule n'est attribué qu'à une personne.
 * Avec `applyToFuture`, les planifications à venir encore « prévues » passent sur ce véhicule,
 * sauf celles où il est déjà pris sur les mêmes horaires (elles sont signalées).
 */
export function attributeVehicle(
  db: Db,
  ctx: Actor,
  employeeId: number,
  vehicleId: number | null,
  applyToFuture: boolean,
  today = parisDate(),
): { error?: string; updated: number; skipped: string[] } {
  const none = { updated: 0, skipped: [] as string[] };
  const employee = getEmployee(db, ctx.orgId, employeeId);
  if (!employee) return { ...none, error: 'Salarié introuvable.' };
  const vehicle = vehicleId ? getVehicle(db, ctx.orgId, vehicleId) : undefined;
  if (vehicleId) {
    if (!vehicle) return { ...none, error: 'Véhicule introuvable.' };
    if (vehicle.status === 'sorti') return { ...none, error: `Le véhicule ${vehicle.plate} est sorti de la flotte.` };
    if (employee.status === 'sorti') return { ...none, error: `${fullName(employee)} ne fait plus partie de l’entreprise.` };
    if (!DRIVING_POSITIONS.includes(employee.position)) return { ...none, error: `${fullName(employee)} n’occupe pas un poste de conduite.` };
    const holder = get<{ id: number; first_name: string; last_name: string }>(
      db,
      `SELECT id, first_name, last_name FROM employees WHERE org_id = ? AND vehicle_id = ? AND id != ?`,
      ctx.orgId,
      vehicleId,
      employee.id,
    );
    if (holder) return { ...none, error: `${vehicle.plate} est déjà attribué à ${fullName(holder)}. Retirez-le d’abord de sa fiche.` };
  }
  const before = employee.vehicle_id ? (getVehicle(db, ctx.orgId, employee.vehicle_id)?.plate ?? null) : null;
  const skipped: string[] = [];
  let updated = 0;
  transaction(db, () => {
    if (employee.vehicle_id !== vehicleId) {
      run(db, `UPDATE employees SET vehicle_id = ? WHERE id = ? AND org_id = ?`, vehicleId, employee.id, ctx.orgId);
      logAudit(db, ctx, {
        action: 'modification',
        entityType: 'employee',
        entityId: employee.id,
        summary: vehicle ? `${vehicle.plate} est attribué à ${fullName(employee)}.` : `${fullName(employee)} n’a plus de véhicule attribué.`,
        changes: [{ field: 'vehicle_id', label: 'Véhicule attribué', before, after: vehicle?.plate ?? null }],
      });
    }
    if (!applyToFuture || !vehicle) return;
    const future = listShifts(db, ctx.orgId, { from: today, to: addDays(today, 366), employeeId: employee.id }).filter(
      (s) => s.status === 'prevu' && (s.route_name || s.vehicle_id) && s.vehicle_id !== vehicle.id,
    );
    for (const s of future) {
      const problem = shiftProblem(
        db,
        ctx.orgId,
        { day: s.day, employeeId: employee.id, startTime: s.start_time, endTime: s.end_time, routeName: s.route_name, vehicleId: vehicle.id, notes: s.notes },
        s.id,
      );
      if (problem) {
        skipped.push(`${formatDate(s.day)} : ${problem}`);
        continue;
      }
      run(db, `UPDATE shifts SET vehicle_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, vehicle.id, s.id);
      updated++;
    }
    if (updated) {
      logAudit(db, ctx, {
        action: 'planning',
        entityType: 'employee',
        entityId: employee.id,
        summary: `${updated} planification(s) à venir de ${fullName(employee)} passent sur ${vehicle.plate}.`,
      });
    }
  });
  return { updated, skipped };
}

// ---------- Présence ----------

/**
 * Confirmation de présence par un responsable, pour un créneau passé ou du jour :
 * heures réellement travaillées (par défaut, les heures prévues). C'est ce qui compte pour la paie.
 */
export function confirmPresence(db: Db, ctx: Actor, shiftId: number, input: { start: string; end: string }, today = parisDate()): string | null {
  const shift = getShift(db, ctx.orgId, shiftId);
  if (!shift) return 'Créneau introuvable.';
  if (!shift.employee_id) return 'Aucun salarié sur ce créneau.';
  if (shift.day > today) return 'On ne peut pas confirmer une présence à venir.';
  if (!isTime(input.start) || !isTime(input.end) || minutesOf(input.end) <= minutesOf(input.start)) return 'Heures réelles invalides : la fin doit être après le début.';
  const open = get<{ id: number; plate: string }>(
    db,
    `SELECT a.id, v.plate FROM assignments a JOIN vehicles v ON v.id = a.vehicle_id WHERE a.org_id = ? AND a.shift_id = ? AND a.ended_at IS NULL`,
    ctx.orgId,
    shift.id,
  );
  if (open) return `Le véhicule ${open.plate} n’a pas encore été rendu : l’état de fin de journée doit d’abord être fait.`;
  const absent = employeeAvailability(db, ctx.orgId, getEmployee(db, ctx.orgId, shift.employee_id)!, shift.day);
  if (!absent.available) return `${shift.employee_name} ${absent.reason} : retirez d’abord l’absence si le salarié a bien travaillé.`;
  const actualStart = parisLocalToIso(shift.day, input.start);
  const actualEnd = parisLocalToIso(shift.day, input.end);
  transaction(db, () => {
    run(
      db,
      `UPDATE shifts SET status = 'realise', actual_start = ?, actual_end = ?, closed_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ? AND org_id = ?`,
      actualStart,
      actualEnd,
      ctx.name,
      shift.id,
      ctx.orgId,
    );
    logAudit(db, ctx, {
      action: 'presence',
      entityType: 'shift',
      entityId: shift.id,
      summary: `Présence de ${shift.employee_name} confirmée le ${formatDate(shift.day)} de ${formatRange(input.start, input.end)} (prévu ${formatRange(shift.start_time, shift.end_time)}).`,
    });
  });
  return null;
}

/** Salarié absent sur un créneau : l'absence est enregistrée pour ce jour et le créneau est libéré pour un remplaçant. */
export function markAbsent(db: Db, ctx: Actor, shiftId: number, type: string, note: string | null, today = parisDate()): string | null {
  const shift = getShift(db, ctx.orgId, shiftId);
  if (!shift || !shift.employee_id) return 'Créneau introuvable ou sans salarié.';
  if (shift.status !== 'prevu') return 'Le salarié a déjà pris son service sur ce créneau.';
  return addAbsence(db, ctx, { employeeId: shift.employee_id, type, startOn: shift.day, endOn: shift.day, note }, today).error ?? null;
}

// ---------- Tableau du jour ----------

export type BoardShift = ShiftRow & { issues: string[]; blocking: boolean };

export type BoardPerson = {
  employee_id: number;
  name: string;
  position: string;
  shifts: ShiftRow[];
  minutes: number;
  unavailable: string | null;
  absence_type: string | null;
  late: boolean;
  on_duty_plate: string | null;
};

export type DayBoard = {
  day: string;
  shifts: BoardShift[];
  people: BoardPerson[];
  unassigned: number;
  toReplace: BoardShift[];
  toConfirm: BoardShift[];
};

export function dayBoard(db: Db, orgId: number, day: string, today = parisDate()): DayBoard {
  const shifts = listShifts(db, orgId, { from: day, to: day });
  const employees = new Map(listEmployees(db, orgId, { includeLeft: true }).map((e) => [e.id, e]));
  const vehicles = new Map<number, ReturnType<typeof getVehicle>>();
  const absences = all<{ employee_id: number; type: string }>(
    db,
    `SELECT employee_id, type FROM absences WHERE org_id = ? AND start_on <= ? AND end_on >= ?`,
    orgId,
    day,
    day,
  );

  const board: BoardShift[] = shifts.map((s) => {
    const issues: string[] = [];
    let blocking = false;
    const employee = s.employee_id ? employees.get(s.employee_id) : undefined;
    if (!employee) {
      issues.push('Aucun salarié');
      blocking = true;
    } else {
      const available = employeeAvailability(db, orgId, employee, day);
      if (!available.available) {
        issues.push(`Salarié indisponible : ${available.reason.replace(/^est /, '')}`);
        blocking = true;
      }
      if (s.vehicle_id && (!employee.licence_expires_on || employee.licence_expires_on < day)) {
        issues.push('Permis expiré ou non renseigné');
        blocking = true;
      }
      if (absences.some((a) => a.employee_id === employee.id && a.type === 'retard')) issues.push('Retard signalé');
    }
    if (s.route_name && !s.vehicle_id) issues.push('Aucun véhicule');
    if (s.vehicle_id) {
      if (!vehicles.has(s.vehicle_id)) vehicles.set(s.vehicle_id, getVehicle(db, orgId, s.vehicle_id));
      const v = vehicles.get(s.vehicle_id);
      if (v) {
        if (v.status === 'immobilise' || v.status === 'bloque' || v.status === 'sorti') {
          issues.push(`Véhicule ${v.status === 'bloque' ? 'bloqué' : v.status === 'sorti' ? 'sorti de flotte' : 'immobilisé'}`);
          blocking = true;
        }
        const compliance = vehicleCompliance(v, day);
        if (compliance.blocking.length) {
          issues.push(...compliance.blocking);
          blocking = true;
        }
      }
    }
    if (s.status === 'prevu' && day < today && s.employee_id) issues.push('Présence non confirmée');
    return { ...s, issues, blocking };
  });

  const onDuty = new Map(
    all<{ employee_id: number; plate: string }>(
      db,
      `SELECT a.employee_id, v.plate FROM assignments a JOIN vehicles v ON v.id = a.vehicle_id WHERE a.org_id = ? AND a.ended_at IS NULL`,
      orgId,
    ).map((a) => [a.employee_id, a.plate]),
  );

  const people: BoardPerson[] = [...employees.values()]
    .filter((e) => e.status !== 'sorti' && (DRIVING_POSITIONS.includes(e.position) || shifts.some((s) => s.employee_id === e.id)))
    .map((e) => {
      const mine = shifts.filter((s) => s.employee_id === e.id);
      const available = employeeAvailability(db, orgId, e, day);
      const absence = absences.find((a) => a.employee_id === e.id && a.type !== 'retard');
      return {
        employee_id: e.id,
        name: fullName(e),
        position: e.position,
        shifts: mine,
        minutes: mine.reduce((sum, s) => sum + plannedMinutes(s.start_time, s.end_time), 0),
        unavailable: available.available ? null : available.reason,
        absence_type: absence?.type ?? null,
        late: absences.some((a) => a.employee_id === e.id && a.type === 'retard'),
        on_duty_plate: onDuty.get(e.id) ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return {
    day,
    shifts: board,
    people,
    unassigned: board.filter((s) => !s.employee_id).length,
    toReplace: board.filter((s) => s.status === 'prevu' && (!s.employee_id || s.issues.some((i) => i.startsWith('Salarié indisponible') || i.startsWith('Permis')))),
    toConfirm: board.filter((s) => s.employee_id && s.status !== 'realise' && day <= today),
  };
}

// ---------- Semaine ----------

export type WeekCell = { shifts: ShiftRow[]; absence: string | null; unavailable: string | null };
export type WeekRow = { employee_id: number; name: string; minutes: number; cells: WeekCell[] };

export function weekGrid(db: Db, orgId: number, monday: string): { days: string[]; rows: WeekRow[]; unassigned: ShiftRow[] } {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sunday = days[6];
  const shifts = listShifts(db, orgId, { from: monday, to: sunday });
  const employees = listEmployees(db, orgId).filter((e) => DRIVING_POSITIONS.includes(e.position) || shifts.some((s) => s.employee_id === e.id));
  const absences = all<{ employee_id: number; type: string; start_on: string; end_on: string }>(
    db,
    `SELECT employee_id, type, start_on, end_on FROM absences WHERE org_id = ? AND start_on <= ? AND end_on >= ? AND type != 'retard'`,
    orgId,
    sunday,
    monday,
  );
  const rows = employees.map((e) => {
    const cells = days.map((day) => {
      const absence = absences.find((a) => a.employee_id === e.id && a.start_on <= day && a.end_on >= day);
      const available = employeeAvailability(db, orgId, e, day);
      return {
        shifts: shifts.filter((s) => s.employee_id === e.id && s.day === day),
        absence: absence?.type ?? null,
        unavailable: available.available ? null : available.reason,
      };
    });
    return {
      employee_id: e.id,
      name: fullName(e),
      minutes: cells.reduce((sum, c) => sum + c.shifts.reduce((m, s) => m + plannedMinutes(s.start_time, s.end_time), 0), 0),
      cells,
    };
  });
  return { days, rows, unassigned: shifts.filter((s) => !s.employee_id) };
}

// ---------- Remplacement ----------

export function replacementCandidates(db: Db, orgId: number, shiftId: number) {
  const shift = getShift(db, orgId, shiftId);
  if (!shift) return null;
  const monday = startOfWeek(shift.day);
  const sunday = addDays(monday, 6);
  const dayShifts = listShifts(db, orgId, { from: shift.day, to: shift.day }).filter((s) => s.id !== shift.id);
  const weekDays = all<{ employee_id: number; n: number }>(
    db,
    `SELECT employee_id, COUNT(DISTINCT day) AS n FROM shifts WHERE org_id = ? AND day BETWEEN ? AND ? AND day != ? AND employee_id IS NOT NULL GROUP BY employee_id`,
    orgId,
    monday,
    sunday,
    shift.day,
  );
  const knows = new Set(
    shift.route_name
      ? all<{ employee_id: number }>(
          db,
          `SELECT DISTINCT employee_id FROM shifts WHERE org_id = ? AND route_name = ? AND day < ? AND employee_id IS NOT NULL`,
          orgId,
          shift.route_name,
          shift.day,
        ).map((r) => r.employee_id)
      : [],
  );

  const candidates: Candidate[] = listEmployees(db, orgId)
    .filter((e) => e.id !== shift.employee_id)
    .map((e) => {
      const available = employeeAvailability(db, orgId, e, shift.day);
      const mine = dayShifts.filter((s) => s.employee_id === e.id);
      const clash = mine.find((s) => overlaps(s, shift));
      return {
        employeeId: e.id,
        name: fullName(e),
        isDriver: DRIVING_POSITIONS.includes(e.position),
        active: e.status === 'actif' || e.status === 'periode_essai',
        absentThatDay: !available.available,
        licenceValidThatDay: !!e.licence_expires_on && e.licence_expires_on >= shift.day,
        licenceCategories: licenceCategories(e),
        plannedRoutesThatDay: mine.length,
        knowsRoute: knows.has(e.id),
        daysPlannedThisWeek: weekDays.find((w) => w.employee_id === e.id)?.n ?? 0,
        conflict: clash ? `Déjà planifié de ${describe(clash)}` : null,
      };
    });
  return { shift, ...rankReplacements(candidates) };
}

// ---------- Absences ----------

/**
 * Enregistre une absence. Les créneaux prévus sur la période sont libérés (le salarié en est retiré,
 * la tournée reste à couvrir). Refusée si le salarié a déjà une présence confirmée sur la période.
 */
export function addAbsence(
  db: Db,
  ctx: Actor,
  input: { employeeId: number; type: string; startOn: string; endOn: string; note: string | null },
  today: string,
): { error?: string; freed?: number } {
  const employee = getEmployee(db, ctx.orgId, input.employeeId);
  if (!employee) return { error: 'Salarié introuvable.' };
  if (input.endOn < input.startOn) return { error: 'La date de fin doit être après la date de début.' };
  const label = labelOf(ABSENCE_TYPES, input.type).toLowerCase();
  const duplicate = get(
    db,
    `SELECT id FROM absences WHERE org_id = ? AND employee_id = ? AND type = ? AND start_on = ? AND end_on = ?`,
    ctx.orgId,
    employee.id,
    input.type,
    input.startOn,
    input.endOn,
  );
  if (duplicate) return { error: `Cette absence (${label}) est déjà enregistrée pour ${fullName(employee)}.` };
  const blocking = input.type !== 'retard';
  if (blocking) {
    const worked = get<{ day: string }>(
      db,
      `SELECT day FROM shifts WHERE org_id = ? AND employee_id = ? AND day BETWEEN ? AND ? AND status != 'prevu' ORDER BY day LIMIT 1`,
      ctx.orgId,
      employee.id,
      input.startOn,
      input.endOn,
    );
    if (worked) return { error: `${fullName(employee)} a travaillé le ${formatDate(worked.day)} (service commencé ou présence confirmée) : l’absence ne peut pas couvrir ce jour.` };
  }

  let freed: ShiftRow[] = [];
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
    if (blocking) {
      freed = listShifts(db, ctx.orgId, { from: input.startOn, to: input.endOn, employeeId: employee.id }).filter((s) => s.status === 'prevu');
      for (const s of freed) {
        run(
          db,
          `UPDATE shifts SET employee_id = NULL, notes = TRIM(COALESCE(notes, '') || ' ' || ?), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
          `Libéré : ${fullName(employee)} (${label}).`,
          s.id,
        );
      }
    }
    logAudit(db, ctx, {
      action: 'absence',
      entityType: 'employee',
      entityId: employee.id,
      summary: `${fullName(employee)} : ${label} du ${formatDate(input.startOn)} au ${formatDate(input.endOn)}.${freed.length ? ` ${freed.length} créneau(x) libéré(s) à couvrir.` : ''}`,
      changes: [{ field: 'absence', label: 'Absence', before: null, after: id }],
    });
    const todays = freed.filter((s) => s.day === today);
    if ((input.startOn <= today && input.endOn >= today) || freed.length) {
      notify(db, ctx.orgId, {
        roles: ['admin', 'manager', 'exploitation'],
        kind: 'absence',
        title: input.type === 'retard' ? `${fullName(employee)} est en retard` : `${fullName(employee)} : ${label}`,
        body: freed.length
          ? `${freed.length} créneau(x) à couvrir${todays.length ? `, dont aujourd’hui : ${todays.map(describe).join(' ; ')}` : ''}.`
          : undefined,
        link: freed.length ? `/planning?jour=${freed[0].day}` : '/aujourdhui',
      });
    }
  });
  return { freed: freed.length };
}

/**
 * Modification d'une absence (type, dates, commentaire), avec les mêmes contrôles qu'à la création.
 * Si la nouvelle période couvre des créneaux prévus, ils sont libérés ; ceux libérés auparavant restent à pourvoir.
 */
export function updateAbsence(
  db: Db,
  ctx: Actor,
  absenceId: number,
  input: { type: string; startOn: string; endOn: string; note: string | null },
  today = parisDate(),
): { error?: string; freed?: number } {
  const absence = get<{ id: number; employee_id: number; type: string; start_on: string; end_on: string; note: string | null }>(
    db,
    `SELECT id, employee_id, type, start_on, end_on, note FROM absences WHERE id = ? AND org_id = ?`,
    absenceId,
    ctx.orgId,
  );
  if (!absence) return { error: 'Absence introuvable.' };
  if (absence.type === input.type && absence.start_on === input.startOn && absence.end_on === input.endOn && (absence.note ?? null) === input.note) return {};
  let result: { error?: string; freed?: number } = {};
  try {
    transaction(db, () => {
      run(db, `DELETE FROM absences WHERE id = ? AND org_id = ?`, absence.id, ctx.orgId);
      result = addAbsence(db, ctx, { employeeId: absence.employee_id, ...input }, today);
      if (result.error) throw new AbsenceRollback();
      logAudit(db, ctx, {
        action: 'modification',
        entityType: 'employee',
        entityId: absence.employee_id,
        summary: `Absence corrigée : ${labelOf(ABSENCE_TYPES, absence.type).toLowerCase()} du ${formatDate(absence.start_on)} au ${formatDate(absence.end_on)} devient ${labelOf(ABSENCE_TYPES, input.type).toLowerCase()} du ${formatDate(input.startOn)} au ${formatDate(input.endOn)}.`,
      });
    });
  } catch (error) {
    if (!(error instanceof AbsenceRollback)) throw error;
  }
  return result;
}

class AbsenceRollback extends Error {}

export function deleteAbsence(db: Db, ctx: Actor, absenceId: number): void {
  const absence = get<{ id: number; employee_id: number; type: string; start_on: string; end_on: string }>(
    db,
    `SELECT id, employee_id, type, start_on, end_on FROM absences WHERE id = ? AND org_id = ?`,
    absenceId,
    ctx.orgId,
  );
  if (!absence) return;
  const employee = getEmployee(db, ctx.orgId, absence.employee_id);
  transaction(db, () => {
    run(db, `DELETE FROM absences WHERE id = ? AND org_id = ?`, absence.id, ctx.orgId);
    logAudit(db, ctx, {
      action: 'suppression',
      entityType: 'employee',
      entityId: absence.employee_id,
      summary: `Absence supprimée pour ${employee ? fullName(employee) : 'un salarié'} (${labelOf(ABSENCE_TYPES, absence.type).toLowerCase()} du ${formatDate(absence.start_on)} au ${formatDate(absence.end_on)}).`,
    });
  });
}
