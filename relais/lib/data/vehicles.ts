import 'server-only';
import { type Db, all, get } from '../db';

export type VehicleRow = {
  id: number;
  plate: string;
  vin: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  type: string;
  energy: string;
  status: string;
  first_registration_on: string | null;
  initial_km: number;
  current_km: number;
  owner: string | null;
  notes: string | null;
};

export type VehicleListRow = VehicleRow & {
  driver_name: string | null;
  driver_id: number | null;
  assignment_started_at: string | null;
};

export function listVehicles(db: Db, orgId: number, opts: { includeRetired?: boolean } = {}): VehicleListRow[] {
  return all<VehicleListRow>(
    db,
    `SELECT v.*, e.first_name || ' ' || e.last_name AS driver_name, e.id AS driver_id, a.started_at AS assignment_started_at
       FROM vehicles v
       LEFT JOIN assignments a ON a.vehicle_id = v.id AND a.org_id = v.org_id AND a.ended_at IS NULL
       LEFT JOIN employees e ON e.id = a.employee_id
      WHERE v.org_id = ? ${opts.includeRetired ? '' : `AND v.status != 'sorti'`}
      ORDER BY v.plate`,
    orgId,
  );
}

export function getVehicle(db: Db, orgId: number, id: number): VehicleRow | undefined {
  return get<VehicleRow>(db, `SELECT * FROM vehicles WHERE id = ? AND org_id = ?`, id, orgId);
}

export type ImmobilizationRow = {
  id: number;
  started_on: string;
  ended_on: string | null;
  reason: string;
  damage_id: number | null;
};

export function listImmobilizations(db: Db, orgId: number, vehicleId: number): ImmobilizationRow[] {
  return all<ImmobilizationRow>(
    db,
    `SELECT id, started_on, ended_on, reason, damage_id FROM immobilizations WHERE org_id = ? AND vehicle_id = ? ORDER BY started_on DESC`,
    orgId,
    vehicleId,
  );
}

export function openImmobilization(db: Db, orgId: number, vehicleId: number): ImmobilizationRow | undefined {
  return get<ImmobilizationRow>(
    db,
    `SELECT id, started_on, ended_on, reason, damage_id FROM immobilizations WHERE org_id = ? AND vehicle_id = ? AND ended_on IS NULL`,
    orgId,
    vehicleId,
  );
}

export function lastTechnicalInspection(db: Db, orgId: number, vehicleId: number): string | null {
  const row = get<{ issued_on: string | null }>(
    db,
    `SELECT issued_on FROM documents WHERE org_id = ? AND entity_type = 'vehicle' AND entity_id = ? AND type = 'controle_technique'
     ORDER BY issued_on DESC LIMIT 1`,
    orgId,
    vehicleId,
  );
  return row?.issued_on ?? null;
}

export type AssignmentHistoryRow = {
  id: number;
  employee_id: number;
  vehicle_id: number;
  employee_name: string;
  plate: string;
  started_at: string;
  ended_at: string | null;
  start_km: number | null;
  end_km: number | null;
  source: string;
};

export function assignmentHistory(
  db: Db,
  orgId: number,
  filter: { vehicleId?: number; employeeId?: number; limit?: number },
): AssignmentHistoryRow[] {
  const where = ['a.org_id = ?'];
  const params: number[] = [orgId];
  if (filter.vehicleId !== undefined) {
    where.push('a.vehicle_id = ?');
    params.push(filter.vehicleId);
  }
  if (filter.employeeId !== undefined) {
    where.push('a.employee_id = ?');
    params.push(filter.employeeId);
  }
  params.push(filter.limit ?? 30);
  return all<AssignmentHistoryRow>(
    db,
    `SELECT a.id, a.employee_id, a.vehicle_id, e.first_name || ' ' || e.last_name AS employee_name, v.plate,
            a.started_at, a.ended_at, a.start_km, a.end_km, a.source
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       JOIN vehicles v ON v.id = a.vehicle_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.started_at DESC LIMIT ?`,
    ...params,
  );
}

/** Kilomètres parcourus sur les affectations terminées depuis `since`. */
export function kmSince(db: Db, orgId: number, since: string): number {
  const row = get<{ km: number | null }>(
    db,
    `SELECT SUM(end_km - start_km) AS km FROM assignments
      WHERE org_id = ? AND ended_at IS NOT NULL AND start_km IS NOT NULL AND end_km IS NOT NULL AND started_at >= ?`,
    orgId,
    since,
  );
  return row?.km ?? 0;
}
