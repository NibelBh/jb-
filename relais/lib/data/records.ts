import 'server-only';
import type { Ctx } from '../auth';
import { type Db, get, run, transaction } from '../db';
import { formatDate } from '../domain/dates';
import { type DocumentEntity, documentTypeLabel } from '../domain/documents';
import { hashPassword } from '../domain/password';
import { type Role, roleLabel } from '../domain/roles';
import { type Change, diff, logAudit } from './audit';
import { type EmployeeRow, fullName, getEmployee } from './employees';
import { type VehicleRow, getVehicle } from './vehicles';

type Actor = Pick<Ctx, 'orgId' | 'userId' | 'name' | 'origin'>;

// ---------- Véhicules ----------

export type VehicleInput = Pick<
  VehicleRow,
  | 'plate' | 'vin' | 'brand' | 'model' | 'year' | 'type' | 'energy' | 'first_registration_on' | 'owner' | 'notes'
  | 'insurer' | 'insurance_policy' | 'insurance_start_on' | 'insurance_end_on' | 'ct_last_on' | 'ct_expires_on'
> & { initial_km: number };

const VEHICLE_LABELS: Partial<Record<keyof VehicleRow, string>> = {
  plate: 'Immatriculation',
  vin: 'VIN',
  brand: 'Marque',
  model: 'Modèle',
  year: 'Année',
  type: 'Type',
  energy: 'Énergie',
  first_registration_on: 'Première immatriculation',
  owner: 'Propriétaire ou loueur',
  notes: 'Notes',
  initial_km: 'Kilométrage initial',
  insurer: 'Assureur',
  insurance_policy: 'N° de contrat d’assurance',
  insurance_start_on: 'Début d’assurance',
  insurance_end_on: 'Fin d’assurance',
  ct_last_on: 'Dernier contrôle technique',
  ct_expires_on: 'Échéance du contrôle technique',
};

/** Contrôles de cohérence des dates d'assurance et de contrôle technique. */
function vehicleDatesError(input: VehicleInput): string | null {
  if (input.insurance_start_on && input.insurance_end_on && input.insurance_end_on < input.insurance_start_on) {
    return 'La date d’échéance de l’assurance doit être après sa date de début.';
  }
  if (input.ct_last_on && input.ct_expires_on && input.ct_expires_on <= input.ct_last_on) {
    return 'L’échéance du contrôle technique doit être après la date du dernier contrôle.';
  }
  return null;
}

export function normalizePlate(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Format SIV français AB-123-CD ; les autres formats sont conservés tels quels.
  const m = compact.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : value.toUpperCase().trim();
}

export function createVehicle(db: Db, ctx: Actor, input: VehicleInput): { id?: number; error?: string } {
  const plate = normalizePlate(input.plate);
  if (get(db, `SELECT id FROM vehicles WHERE org_id = ? AND plate = ?`, ctx.orgId, plate)) {
    return { error: `Le véhicule ${plate} existe déjà.` };
  }
  const dates = vehicleDatesError(input);
  if (dates) return { error: dates };
  const id = run(
    db,
    `INSERT INTO vehicles (org_id, plate, vin, brand, model, year, type, energy, first_registration_on, initial_km, current_km, owner, notes,
       insurer, insurance_policy, insurance_start_on, insurance_end_on, ct_last_on, ct_expires_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ctx.orgId,
    plate,
    input.vin,
    input.brand,
    input.model,
    input.year,
    input.type,
    input.energy,
    input.first_registration_on,
    input.initial_km,
    input.initial_km,
    input.owner,
    input.notes,
    input.insurer,
    input.insurance_policy,
    input.insurance_start_on,
    input.insurance_end_on,
    input.ct_last_on,
    input.ct_expires_on,
  ).id;
  logAudit(db, ctx, { action: 'creation', entityType: 'vehicle', entityId: id, summary: `Le véhicule ${plate} a été ajouté à la flotte.` });
  return { id };
}

export function updateVehicle(db: Db, ctx: Actor, id: number, input: VehicleInput): string | null {
  const vehicle = getVehicle(db, ctx.orgId, id);
  if (!vehicle) return 'Véhicule introuvable.';
  const plate = normalizePlate(input.plate);
  if (plate !== vehicle.plate && get(db, `SELECT id FROM vehicles WHERE org_id = ? AND plate = ?`, ctx.orgId, plate)) {
    return `Le véhicule ${plate} existe déjà.`;
  }
  const dates = vehicleDatesError(input);
  if (dates) return dates;
  const next = { ...input, plate };
  const changes = diff(vehicle as unknown as Record<string, unknown>, next, VEHICLE_LABELS as Record<string, string>);
  if (changes.length === 0) return null;
  run(
    db,
    `UPDATE vehicles SET plate = ?, vin = ?, brand = ?, model = ?, year = ?, type = ?, energy = ?, first_registration_on = ?,
       initial_km = ?, owner = ?, notes = ?, insurer = ?, insurance_policy = ?, insurance_start_on = ?, insurance_end_on = ?,
       ct_last_on = ?, ct_expires_on = ? WHERE id = ? AND org_id = ?`,
    plate,
    input.vin,
    input.brand,
    input.model,
    input.year,
    input.type,
    input.energy,
    input.first_registration_on,
    input.initial_km,
    input.owner,
    input.notes,
    input.insurer,
    input.insurance_policy,
    input.insurance_start_on,
    input.insurance_end_on,
    input.ct_last_on,
    input.ct_expires_on,
    id,
    ctx.orgId,
  );
  logAudit(db, ctx, { action: 'modification', entityType: 'vehicle', entityId: id, summary: `Fiche du véhicule ${plate} modifiée (${changes.map((c) => c.label).join(', ')}).`, changes });
  return null;
}

/** Correction manuelle du kilométrage, toujours tracée avec l'ancienne valeur. */
export function correctOdometer(db: Db, ctx: Actor, id: number, km: number, reason: string): string | null {
  const vehicle = getVehicle(db, ctx.orgId, id);
  if (!vehicle) return 'Véhicule introuvable.';
  if (!reason.trim()) return 'Indiquez le motif de la correction.';
  if (!Number.isInteger(km) || km < 0) return 'Kilométrage invalide.';
  run(db, `UPDATE vehicles SET current_km = ? WHERE id = ? AND org_id = ?`, km, id, ctx.orgId);
  logAudit(db, ctx, {
    action: 'kilometrage',
    entityType: 'vehicle',
    entityId: id,
    summary: `Le kilométrage de ${vehicle.plate} a été corrigé de ${vehicle.current_km} km à ${km} km par ${ctx.name}. Motif : ${reason.trim()}`,
    changes: [{ field: 'current_km', label: 'Kilométrage', before: vehicle.current_km, after: km }],
  });
  return null;
}

// ---------- Salariés ----------

export type EmployeeInput = Omit<EmployeeRow, 'id' | 'licence_checked_on'>;

const EMPLOYEE_LABELS: Partial<Record<keyof EmployeeRow, string>> = {
  payroll_id: 'Matricule paie',
  first_name: 'Prénom',
  last_name: 'Nom',
  birth_date: 'Date de naissance',
  birth_place: 'Lieu de naissance',
  nationality: 'Nationalité',
  address: 'Adresse',
  postal_code: 'Code postal',
  city: 'Ville',
  emergency_name: 'Contact d’urgence',
  emergency_phone: 'Téléphone d’urgence',
  licence_issued_on: 'Date d’obtention du permis',
  email: 'E-mail',
  phone: 'Téléphone',
  position: 'Poste',
  contract_type: 'Contrat',
  status: 'Statut',
  hired_on: 'Date d’embauche',
  left_on: 'Date de sortie',
  licence_number: 'Numéro de permis',
  licence_categories: 'Catégories de permis',
  licence_expires_on: 'Expiration du permis',
  notes: 'Notes',
};

/** Un matricule de paie est unique dans l'entreprise : c'est la clé des fichiers échangés avec la paie. */
function payrollIdTaken(db: Db, orgId: number, payrollId: string | null, exceptId?: number): boolean {
  if (!payrollId) return false;
  const row = get<{ id: number }>(db, `SELECT id FROM employees WHERE org_id = ? AND payroll_id = ?`, orgId, payrollId);
  return row !== undefined && row.id !== exceptId;
}

function employeeDatesError(input: EmployeeInput): string | null {
  if (input.hired_on && input.left_on && input.left_on < input.hired_on) return 'La date de sortie doit être après la date d’arrivée.';
  if (input.licence_issued_on && input.licence_expires_on && input.licence_expires_on <= input.licence_issued_on) {
    return 'La fin de validité du permis doit être après sa date d’obtention.';
  }
  if (input.birth_date && input.hired_on && input.birth_date >= input.hired_on) return 'La date de naissance doit être avant la date d’arrivée.';
  return null;
}

export function createEmployee(db: Db, ctx: Actor, input: EmployeeInput): { id?: number; error?: string } {
  if (payrollIdTaken(db, ctx.orgId, input.payroll_id)) return { error: `Le matricule ${input.payroll_id} est déjà attribué.` };
  const dates = employeeDatesError(input);
  if (dates) return { error: dates };
  const id = run(
    db,
    `INSERT INTO employees (org_id, payroll_id, first_name, last_name, birth_date, birth_place, nationality, address, postal_code, city, email, phone, emergency_name, emergency_phone, position, contract_type, status, hired_on, left_on, licence_number, licence_categories, licence_issued_on, licence_expires_on, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ctx.orgId,
    input.payroll_id,
    input.first_name,
    input.last_name,
    input.birth_date,
    input.birth_place,
    input.nationality,
    input.address,
    input.postal_code,
    input.city,
    input.email,
    input.phone,
    input.emergency_name,
    input.emergency_phone,
    input.position,
    input.contract_type,
    input.status,
    input.hired_on,
    input.left_on,
    input.licence_number,
    input.licence_categories,
    input.licence_issued_on,
    input.licence_expires_on,
    input.notes,
  ).id;
  logAudit(db, ctx, { action: 'creation', entityType: 'employee', entityId: id, summary: `${input.first_name} ${input.last_name} a été ajouté(e) au personnel.` });
  return { id };
}

export function updateEmployee(db: Db, ctx: Actor, id: number, input: EmployeeInput): string | null {
  const employee = getEmployee(db, ctx.orgId, id);
  if (!employee) return 'Salarié introuvable.';
  if (payrollIdTaken(db, ctx.orgId, input.payroll_id, id)) return `Le matricule ${input.payroll_id} est déjà attribué.`;
  const dates = employeeDatesError(input);
  if (dates) return dates;
  const changes = diff(employee as unknown as Record<string, unknown>, input, EMPLOYEE_LABELS as Record<string, string>);
  if (changes.length === 0) return null;
  transaction(db, () => {
    run(
      db,
      `UPDATE employees SET payroll_id = ?, first_name = ?, last_name = ?, birth_date = ?, birth_place = ?, nationality = ?, address = ?, postal_code = ?, city = ?, email = ?, phone = ?, emergency_name = ?, emergency_phone = ?, position = ?, contract_type = ?, status = ?, hired_on = ?, left_on = ?, licence_number = ?, licence_categories = ?, licence_issued_on = ?, licence_expires_on = ?, notes = ?
       WHERE id = ? AND org_id = ?`,
      input.payroll_id,
      input.first_name,
      input.last_name,
      input.birth_date,
      input.birth_place,
      input.nationality,
      input.address,
      input.postal_code,
      input.city,
      input.email,
      input.phone,
      input.emergency_name,
      input.emergency_phone,
      input.position,
      input.contract_type,
      input.status,
      input.hired_on,
      input.left_on,
      input.licence_number,
      input.licence_categories,
      input.licence_issued_on,
      input.licence_expires_on,
      input.notes,
      id,
      ctx.orgId,
    );
    // Un salarié sorti perd immédiatement l'accès à l'application.
    if (input.status === 'sorti' && employee.status !== 'sorti') {
      run(db, `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE org_id = ? AND employee_id = ?)`, ctx.orgId, id);
      run(db, `UPDATE users SET active = 0 WHERE org_id = ? AND employee_id = ?`, ctx.orgId, id);
    }
    logAudit(db, ctx, {
      action: 'modification',
      entityType: 'employee',
      entityId: id,
      summary: `Fiche de ${fullName({ first_name: input.first_name, last_name: input.last_name })} modifiée (${changes.map((c) => c.label).join(', ')}).`,
      changes,
    });
  });
  return null;
}

export function recordLicenceCheck(db: Db, ctx: Actor, id: number, checkedOn: string, valid: boolean): string | null {
  const employee = getEmployee(db, ctx.orgId, id);
  if (!employee) return 'Salarié introuvable.';
  run(db, `UPDATE employees SET licence_checked_on = ? WHERE id = ? AND org_id = ?`, checkedOn, id, ctx.orgId);
  logAudit(db, ctx, {
    action: 'verification_permis',
    entityType: 'employee',
    entityId: id,
    summary: `Validité du permis de ${fullName(employee)} vérifiée le ${formatDate(checkedOn)} : ${valid ? 'valide' : 'NON VALIDE'}.`,
  });
  return null;
}

// ---------- Documents ----------

export function addDocument(
  db: Db,
  ctx: Actor,
  input: {
    entity: DocumentEntity;
    entityId: number;
    type: string;
    reference: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
    fileId: number | null;
    /** Faux pour un document envoyé par le salarié lui-même : les RH vérifient avant de mettre la fiche à jour. */
    syncLicence?: boolean;
  },
): string | null {
  const exists =
    input.entity === 'vehicle'
      ? getVehicle(db, ctx.orgId, input.entityId)
      : input.entity === 'employee'
        ? getEmployee(db, ctx.orgId, input.entityId)
        : input.entityId === ctx.orgId;
  if (!exists) return 'Élément introuvable.';
  transaction(db, () => {
    const id = run(
      db,
      `INSERT INTO documents (org_id, entity_type, entity_id, type, reference, issued_on, expires_on, file_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ctx.orgId,
      input.entity,
      input.entityId,
      input.type,
      input.reference,
      input.issuedOn,
      input.expiresOn,
      input.fileId,
    ).id;
    // Le permis sert aux contrôles d'affectation : on garde la fiche salarié à jour.
    if (input.syncLicence !== false && input.entity === 'employee' && input.type === 'permis' && input.expiresOn) {
      run(db, `UPDATE employees SET licence_expires_on = ? WHERE id = ? AND org_id = ?`, input.expiresOn, input.entityId, ctx.orgId);
    }
    // Attestation d'assurance ou procès-verbal de contrôle technique : la fiche véhicule suit le document le plus récent.
    if (input.entity === 'vehicle' && input.type === 'assurance' && input.expiresOn) {
      run(
        db,
        `UPDATE vehicles SET insurance_start_on = COALESCE(?, insurance_start_on), insurance_end_on = ?, insurance_policy = COALESCE(?, insurance_policy)
          WHERE id = ? AND org_id = ? AND (insurance_end_on IS NULL OR insurance_end_on <= ?)`,
        input.issuedOn, input.expiresOn, input.reference, input.entityId, ctx.orgId, input.expiresOn,
      );
    }
    if (input.entity === 'vehicle' && input.type === 'controle_technique' && input.issuedOn) {
      run(
        db,
        `UPDATE vehicles SET ct_last_on = ?, ct_expires_on = ? WHERE id = ? AND org_id = ? AND (ct_last_on IS NULL OR ct_last_on <= ?)`,
        input.issuedOn, input.expiresOn, input.entityId, ctx.orgId, input.issuedOn,
      );
    }
    logAudit(db, ctx, {
      action: 'document',
      entityType: input.entity,
      entityId: input.entityId,
      summary: `Document ajouté : ${documentTypeLabel(input.entity, input.type)}${input.expiresOn ? `, expire le ${formatDate(input.expiresOn)}` : ''}.`,
      changes: [{ field: 'document', label: 'Document', before: null, after: id }],
    });
  });
  return null;
}

export function deleteDocument(db: Db, ctx: Actor, documentId: number): void {
  const doc = get<{ id: number; entity_type: DocumentEntity; entity_id: number; type: string }>(
    db,
    `SELECT id, entity_type, entity_id, type FROM documents WHERE id = ? AND org_id = ?`,
    documentId,
    ctx.orgId,
  );
  if (!doc) return;
  run(db, `DELETE FROM documents WHERE id = ? AND org_id = ?`, doc.id, ctx.orgId);
  logAudit(db, ctx, {
    action: 'suppression',
    entityType: doc.entity_type,
    entityId: doc.entity_id,
    summary: `Document supprimé : ${documentTypeLabel(doc.entity_type, doc.type)}.`,
  });
}

// ---------- Membres (comptes d'accès) ----------

type UserRecord = { id: number; name: string; login: string; roles: string; active: number; employee_id: number | null };

function findUser(db: Db, orgId: number, userId: number): UserRecord | undefined {
  return get<UserRecord>(
    db,
    `SELECT id, name, login, roles, active, employee_id FROM users WHERE id = ? AND org_id = ? AND deleted_at IS NULL`,
    userId,
    orgId,
  );
}

/** Nombre d'administrateurs actifs, en excluant éventuellement un compte. */
function activeAdmins(db: Db, orgId: number, exceptId: number): number {
  const rows = get<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM users WHERE org_id = ? AND id != ? AND active = 1 AND deleted_at IS NULL AND (',' || roles || ',') LIKE '%,admin,%'`,
    orgId,
    exceptId,
  );
  return rows?.n ?? 0;
}

function loginTaken(db: Db, login: string, exceptId?: number): boolean {
  const row = get<{ id: number }>(db, `SELECT id FROM users WHERE login = ?`, login);
  return row !== undefined && row.id !== exceptId;
}

function employeeLinkError(db: Db, orgId: number, employeeId: number | null, exceptUserId?: number): string | null {
  if (employeeId === null) return null;
  if (!getEmployee(db, orgId, employeeId)) return 'Salarié introuvable.';
  const other = get<{ id: number }>(db, `SELECT id FROM users WHERE org_id = ? AND employee_id = ? AND deleted_at IS NULL`, orgId, employeeId);
  if (other && other.id !== exceptUserId) return 'Ce salarié a déjà un accès.';
  return null;
}

export function createUser(
  db: Db,
  ctx: Actor,
  input: { name: string; login: string; password: string; roles: Role[]; employeeId: number | null },
): string | null {
  const login = input.login.trim().toLowerCase();
  if (input.roles.length === 0) return 'Choisissez au moins un niveau d’accès.';
  if (loginTaken(db, login)) return 'Cet identifiant est déjà utilisé.';
  if (input.roles.includes('chauffeur') && input.employeeId === null) return 'Un accès salarié doit être relié à une fiche du personnel.';
  const link = employeeLinkError(db, ctx.orgId, input.employeeId);
  if (link) return link;
  const id = run(
    db,
    `INSERT INTO users (org_id, employee_id, name, login, password_hash, roles) VALUES (?, ?, ?, ?, ?, ?)`,
    ctx.orgId,
    input.employeeId,
    input.name,
    login,
    hashPassword(input.password),
    input.roles.join(','),
  ).id;
  logAudit(db, ctx, { action: 'creation', entityType: 'user', entityId: id, summary: `Membre ajouté : ${input.name} (${login}), rôles : ${input.roles.map(roleLabel).join(', ')}.` });
  return null;
}

export function updateUser(
  db: Db,
  ctx: Actor,
  userId: number,
  input: { name: string; login: string; roles: Role[]; active: boolean; password: string | null; employeeId: number | null },
): string | null {
  const user = findUser(db, ctx.orgId, userId);
  if (!user) return 'Membre introuvable.';
  const login = input.login.trim().toLowerCase();
  if (input.roles.length === 0) return 'Choisissez au moins un niveau d’accès.';
  if (user.id === ctx.userId && (!input.active || !input.roles.includes('admin'))) {
    return 'Vous ne pouvez pas retirer vos propres droits d’administrateur ni désactiver votre propre compte.';
  }
  const wasAdmin = user.active === 1 && user.roles.split(',').includes('admin');
  const staysAdmin = input.active && input.roles.includes('admin');
  if (wasAdmin && !staysAdmin && activeAdmins(db, ctx.orgId, user.id) === 0) return 'Il doit rester au moins un administrateur actif.';
  if (loginTaken(db, login, user.id)) return 'Cet identifiant est déjà utilisé.';
  if (input.roles.includes('chauffeur') && input.employeeId === null) return 'Un accès salarié doit être relié à une fiche du personnel.';
  const link = employeeLinkError(db, ctx.orgId, input.employeeId, user.id);
  if (link) return link;

  const changes: Change[] = [];
  if (user.name !== input.name) changes.push({ field: 'name', label: 'Nom', before: user.name, after: input.name });
  if (user.login !== login) changes.push({ field: 'login', label: 'Identifiant', before: user.login, after: login });
  if (user.roles !== input.roles.join(',')) changes.push({ field: 'roles', label: 'Rôles', before: user.roles, after: input.roles.join(',') });
  if (Boolean(user.active) !== input.active) changes.push({ field: 'active', label: 'Actif', before: Boolean(user.active), after: input.active });
  if (user.employee_id !== input.employeeId) changes.push({ field: 'employee_id', label: 'Fiche salarié', before: user.employee_id, after: input.employeeId });
  if (input.password) changes.push({ field: 'password', label: 'Mot de passe', before: '***', after: '***' });
  if (changes.length === 0) return null;
  transaction(db, () => {
    run(
      db,
      `UPDATE users SET name = ?, login = ?, roles = ?, active = ?, employee_id = ? WHERE id = ? AND org_id = ?`,
      input.name,
      login,
      input.roles.join(','),
      input.active ? 1 : 0,
      input.employeeId,
      user.id,
      ctx.orgId,
    );
    if (input.password) run(db, `UPDATE users SET password_hash = ? WHERE id = ?`, hashPassword(input.password), user.id);
    if (input.password || !input.active || user.login !== login) run(db, `DELETE FROM sessions WHERE user_id = ?`, user.id);
    logAudit(db, ctx, { action: 'acces', entityType: 'user', entityId: user.id, summary: `Membre ${input.name} modifié (${changes.map((c) => c.label).join(', ')}).`, changes });
  });
  return null;
}

/**
 * Suppression d'un membre : le compte ne peut plus se connecter et disparaît de la liste,
 * mais son nom reste dans l'historique (journal, dossiers, inspections). L'identifiant est libéré.
 */
export function deleteUser(db: Db, ctx: Actor, userId: number): string | null {
  const user = findUser(db, ctx.orgId, userId);
  if (!user) return 'Membre introuvable.';
  if (user.id === ctx.userId) return 'Vous ne pouvez pas supprimer votre propre compte.';
  if (user.active === 1 && user.roles.split(',').includes('admin') && activeAdmins(db, ctx.orgId, user.id) === 0) {
    return 'Il doit rester au moins un administrateur actif.';
  }
  transaction(db, () => {
    run(
      db,
      `UPDATE users SET active = 0, deleted_at = ?, employee_id = NULL, login = login || '#supprime-' || id WHERE id = ? AND org_id = ?`,
      new Date().toISOString(),
      user.id,
      ctx.orgId,
    );
    run(db, `DELETE FROM sessions WHERE user_id = ?`, user.id);
    logAudit(db, ctx, { action: 'suppression', entityType: 'user', entityId: user.id, summary: `Membre supprimé : ${user.name} (${user.login}).` });
  });
  return null;
}
