'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getEmployee } from '@/lib/data/employees';
import { type EmployeeInput, createEmployee, createUser, recordLicenceCheck, updateEmployee } from '@/lib/data/records';
import { passwordProblem } from '@/lib/domain/password';
import { CONTRACT_TYPES, EMPLOYEE_STATUSES, POSITIONS } from '@/lib/domain/labels';
import { type FormState, date, id, oneOf, optDate, optText, text, toFormState } from '@/lib/forms';

function employeeInput(formData: FormData): EmployeeInput {
  const categories = String(formData.getAll('licence_categories').join(','))
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^(AM|A1|A2|A|B|BE|B96|C1|C1E|C|CE|D1|D1E|D|DE)$/.test(c));
  const contract = String(formData.get('contract_type') ?? '');
  return {
    payroll_id: optText(formData, 'payroll_id', 30),
    first_name: text(formData, 'first_name', 'Prénom', 80),
    last_name: text(formData, 'last_name', 'Nom', 80),
    email: optText(formData, 'email', 120),
    phone: optText(formData, 'phone', 30),
    position: oneOf(formData, 'position', POSITIONS, 'Poste'),
    contract_type: contract ? oneOf(formData, 'contract_type', CONTRACT_TYPES, 'Contrat') : null,
    status: oneOf(formData, 'status', EMPLOYEE_STATUSES, 'Statut'),
    hired_on: optDate(formData, 'hired_on', 'Date d’embauche'),
    left_on: optDate(formData, 'left_on', 'Date de sortie'),
    licence_number: optText(formData, 'licence_number', 30),
    licence_categories: [...new Set(categories)].join(','),
    licence_expires_on: optDate(formData, 'licence_expires_on', 'Expiration du permis'),
    notes: optText(formData, 'notes', 2000),
  };
}

export async function createEmployeeAction(_: FormState, formData: FormData): Promise<FormState> {
  let newId: number;
  try {
    const ctx = await requireAction('personnel.modifier');
    const result = createEmployee(getDb(), ctx, employeeInput(formData));
    if (result.error || result.id === undefined) return { error: result.error ?? 'Création impossible.' };
    newId = result.id;
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/personnel');
  redirect(`/personnel/${newId}`);
}

export async function updateEmployeeAction(_: FormState, formData: FormData): Promise<FormState> {
  const employeeId = Number(formData.get('employeeId'));
  try {
    const ctx = await requireAction('personnel.modifier');
    const error = updateEmployee(getDb(), ctx, employeeId, employeeInput(formData));
    if (error) return { error };
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/', 'layout');
  redirect(`/personnel/${employeeId}`);
}

export async function licenceCheckAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('personnel.modifier');
    const valid = formData.get('valid') === 'oui';
    const error = recordLicenceCheck(getDb(), ctx, id(formData, 'employeeId'), date(formData, 'checkedOn', 'Date de vérification'), valid);
    if (error) return { error };
    revalidatePath('/personnel', 'layout');
    return { ok: valid ? 'Vérification enregistrée.' : 'Vérification enregistrée. Ne confiez plus de véhicule à ce salarié.' };
  } catch (error) {
    return toFormState(error);
  }
}

/** Crée l'accès à l'application chauffeur pour un salarié : identifiant + code à 6 chiffres. */
export async function createDriverAccessAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('utilisateur.gerer');
    const db = getDb();
    const employee = getEmployee(db, ctx.orgId, id(formData, 'employeeId'));
    if (!employee) return { error: 'Salarié introuvable.' };
    const login = text(formData, 'login', 'Identifiant', 60).toLowerCase();
    if (!/^[a-z0-9._@-]{3,60}$/.test(login)) return { error: 'L’identifiant ne peut contenir que des lettres sans accent, chiffres, points et tirets.' };
    const code = String(formData.get('code') ?? '');
    const problem = passwordProblem(code, true);
    if (problem) return { error: problem };
    const error = createUser(db, ctx, {
      name: `${employee.first_name} ${employee.last_name}`,
      login,
      password: code,
      roles: ['chauffeur'],
      employeeId: employee.id,
    });
    if (error) return { error };
    revalidatePath('/personnel', 'layout');
    return { ok: `Accès créé. Communiquez l’identifiant « ${login} » et le code au salarié.` };
  } catch (error) {
    return toFormState(error);
  }
}
