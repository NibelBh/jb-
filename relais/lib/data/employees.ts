import 'server-only';
import { type Db, all, get } from '../db';
import { ABSENCE_TYPES, labelOf } from '../domain/labels';
import { type Availability, availability } from '../domain/shifts';

export type EmployeeRow = {
  id: number;
  /** Matricule dans le logiciel de paie : clé des fichiers échangés avec la paie. */
  payroll_id: string | null;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  birth_place: string | null;
  nationality: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  position: string;
  contract_type: string | null;
  status: string;
  hired_on: string | null;
  left_on: string | null;
  licence_number: string | null;
  licence_categories: string;
  licence_issued_on: string | null;
  licence_expires_on: string | null;
  licence_checked_on: string | null;
  notes: string | null;
};

export function fullName(e: Pick<EmployeeRow, 'first_name' | 'last_name'>): string {
  return `${e.first_name} ${e.last_name}`;
}

export function listEmployees(db: Db, orgId: number, opts: { includeLeft?: boolean } = {}): EmployeeRow[] {
  return all<EmployeeRow>(
    db,
    `SELECT * FROM employees WHERE org_id = ? ${opts.includeLeft ? '' : `AND status != 'sorti'`} ORDER BY last_name, first_name`,
    orgId,
  );
}

export function getEmployee(db: Db, orgId: number, id: number): EmployeeRow | undefined {
  return get<EmployeeRow>(db, `SELECT * FROM employees WHERE id = ? AND org_id = ?`, id, orgId);
}

export function licenceCategories(e: Pick<EmployeeRow, 'licence_categories'>): string[] {
  return e.licence_categories
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

export type AbsenceRow = {
  id: number;
  employee_id: number;
  employee_name: string;
  type: string;
  start_on: string;
  end_on: string;
  note: string | null;
};

export function listAbsences(db: Db, orgId: number, filter: { from: string; to: string; employeeId?: number }): AbsenceRow[] {
  const params: (string | number)[] = [orgId, filter.to, filter.from];
  let extra = '';
  if (filter.employeeId !== undefined) {
    extra = 'AND a.employee_id = ?';
    params.push(filter.employeeId);
  }
  return all<AbsenceRow>(
    db,
    `SELECT a.id, a.employee_id, e.first_name || ' ' || e.last_name AS employee_name, a.type, a.start_on, a.end_on, a.note
       FROM absences a JOIN employees e ON e.id = a.employee_id
      WHERE a.org_id = ? AND a.start_on <= ? AND a.end_on >= ? ${extra}
      ORDER BY a.start_on`,
    ...params,
  );
}

/** Disponibilité d'un salarié un jour donné (absences, arrivée, sortie, suspension). */
export function employeeAvailability(db: Db, orgId: number, employee: EmployeeRow, day: string): Availability {
  const absences = listAbsences(db, orgId, { from: day, to: day, employeeId: employee.id }).map((a) => ({ ...a, label: labelOf(ABSENCE_TYPES, a.type) }));
  return availability(employee, absences, day);
}

/** Situation du jour affichée sur la fiche et dans la liste du personnel. */
export function currentSituation(db: Db, orgId: number, employee: EmployeeRow, day: string): { label: string; tone: 'ok' | 'warn' | 'off'; until?: string } {
  if (employee.status === 'sorti') return { label: 'Sorti de l’entreprise', tone: 'off' };
  if (employee.status === 'suspendu') return { label: 'Suspendu', tone: 'off' };
  if (employee.hired_on && employee.hired_on > day) return { label: 'Arrivée prévue', tone: 'warn', until: employee.hired_on };
  const absence = listAbsences(db, orgId, { from: day, to: day, employeeId: employee.id }).find((a) => a.type !== 'retard');
  if (absence) return { label: labelOf(ABSENCE_TYPES, absence.type), tone: 'off', until: absence.end_on };
  return { label: 'Disponible', tone: 'ok' };
}

export type UserRow = {
  id: number;
  name: string;
  login: string;
  roles: string;
  active: number;
  employee_id: number | null;
  last_login_at: string | null;
  deleted_at: string | null;
};

/** Membres de l'entreprise (comptes supprimés exclus : ils restent dans l'historique). */
export function listUsers(db: Db, orgId: number): UserRow[] {
  return all<UserRow>(
    db,
    `SELECT id, name, login, roles, active, employee_id, last_login_at, deleted_at FROM users WHERE org_id = ? AND deleted_at IS NULL ORDER BY name`,
    orgId,
  );
}

export function userForEmployee(db: Db, orgId: number, employeeId: number): UserRow | undefined {
  return get<UserRow>(
    db,
    `SELECT id, name, login, roles, active, employee_id, last_login_at, deleted_at FROM users WHERE org_id = ? AND employee_id = ? AND deleted_at IS NULL`,
    orgId,
    employeeId,
  );
}
