import 'server-only';
import { type Db, all, get } from '../db';

export type EmployeeRow = {
  id: number;
  /** Matricule dans le logiciel de paie : clé des fichiers échangés avec la paie. */
  payroll_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string;
  contract_type: string | null;
  status: string;
  hired_on: string | null;
  left_on: string | null;
  licence_number: string | null;
  licence_categories: string;
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

export type UserRow = { id: number; name: string; login: string; roles: string; active: number; employee_id: number | null; last_login_at: string | null };

export function listUsers(db: Db, orgId: number): UserRow[] {
  return all<UserRow>(db, `SELECT id, name, login, roles, active, employee_id, last_login_at FROM users WHERE org_id = ? ORDER BY name`, orgId);
}

export function userForEmployee(db: Db, orgId: number, employeeId: number): UserRow | undefined {
  return get<UserRow>(db, `SELECT id, name, login, roles, active, employee_id, last_login_at FROM users WHERE org_id = ? AND employee_id = ?`, orgId, employeeId);
}
