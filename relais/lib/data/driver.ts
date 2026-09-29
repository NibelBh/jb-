import 'server-only';
import { type Db, all, get } from '../db';
import { expiryStatus, needsAttention } from '../domain/documents';
import { type VehicleAdmin, vehicleCompliance } from '../domain/vehicles';
import { addDays } from '../domain/dates';
import { currentShiftFor, openAssignmentFor, pendingInspectionFor, vehicleReservedFor } from './operations';
import { listShifts } from './planning';

/** Tout ce dont l'écran d'accueil du chauffeur a besoin, en une fois. */
export function driverHome(db: Db, orgId: number, employeeId: number, today: string) {
  const shifts = listShifts(db, orgId, { from: today, to: today, employeeId });
  const upcoming = listShifts(db, orgId, { from: addDays(today, 1), to: addDays(today, 7), employeeId });
  const absence = get<{ type: string; end_on: string }>(
    db,
    `SELECT type, end_on FROM absences WHERE org_id = ? AND employee_id = ? AND start_on <= ? AND end_on >= ? AND type != 'retard'`,
    orgId,
    employeeId,
    today,
    today,
  );
  const contacts = all<{ name: string; phone: string }>(
    db,
    `SELECT first_name || ' ' || last_name AS name, phone FROM employees
      WHERE org_id = ? AND status != 'sorti' AND position IN ('dispatcher', 'manager') AND phone IS NOT NULL AND phone != ''
      ORDER BY position = 'dispatcher' DESC LIMIT 2`,
    orgId,
  );
  const licence = get<{ licence_expires_on: string | null }>(db, `SELECT licence_expires_on FROM employees WHERE id = ? AND org_id = ?`, employeeId, orgId);
  const docs = all<{ expires_on: string | null }>(
    db,
    `SELECT expires_on FROM documents d WHERE org_id = ? AND entity_type = 'employee' AND entity_id = ? AND expires_on IS NOT NULL
       AND expires_on = (SELECT MAX(expires_on) FROM documents d2 WHERE d2.org_id = d.org_id AND d2.entity_type = 'employee' AND d2.entity_id = d.entity_id AND d2.type = d.type)`,
    orgId,
    employeeId,
  );
  const docsToRenew =
    docs.filter((d) => needsAttention(expiryStatus(d.expires_on, today))).length +
    (licence && !docs.length && needsAttention(expiryStatus(licence.licence_expires_on, today)) ? 1 : 0);

  return {
    shifts,
    upcoming,
    current: currentShiftFor(db, orgId, employeeId, today),
    absence,
    open: openAssignmentFor(db, orgId, employeeId),
    pending: pendingInspectionFor(db, orgId, employeeId),
    contacts,
    docsToRenew,
    licenceStatus: expiryStatus(licence?.licence_expires_on, today),
  };
}

/** Véhicules que le chauffeur peut prendre : disponibles, assurés et contrôle technique à jour. */
export function availableVehicles(db: Db, orgId: number, employeeId: number, today: string) {
  return all<{ id: number; plate: string; brand: string | null; model: string | null; current_km: number } & VehicleAdmin>(
    db,
    `SELECT id, plate, brand, model, current_km, insurance_end_on, ct_last_on, ct_expires_on, first_registration_on
       FROM vehicles WHERE org_id = ? AND status = 'disponible' ORDER BY plate`,
    orgId,
  ).filter((v) => vehicleCompliance(v, today).blocking.length === 0 && !vehicleReservedFor(db, orgId, v.id, employeeId, today));
}

/** Véhicules sur lesquels un chauffeur peut signaler un problème : le sien d'abord, puis tous ceux en service. */
export function reportableVehicles(db: Db, orgId: number) {
  return all<{ id: number; plate: string }>(db, `SELECT id, plate FROM vehicles WHERE org_id = ? AND status != 'sorti' ORDER BY plate`, orgId);
}
