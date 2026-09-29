'use server';

import { revalidatePath } from 'next/cache';
import { requireAction } from '@/lib/auth';
import { get, getDb } from '@/lib/db';
import { createUser, deleteUser, updateUser } from '@/lib/data/records';
import { passwordProblem } from '@/lib/domain/password';
import { ACCESS_LEVELS, type Role, parseRoles } from '@/lib/domain/roles';
import { FieldError, type FormState, checked, id, oneOf, optId, text, toFormState } from '@/lib/forms';

/** Niveau d'accès choisi → rôles techniques. Un responsable sans périmètre précis devient « manager ». */
function rolesFrom(formData: FormData): Role[] {
  const level = oneOf(formData, 'level', ACCESS_LEVELS, 'Niveau d’accès');
  if (level === 'admin') return ['admin'];
  if (level === 'salarie') return ['chauffeur'];
  const scopes = parseRoles(formData.getAll('scopes').map(String).join(',')).filter((r) => r !== 'admin' && r !== 'chauffeur');
  return scopes.length ? scopes : ['manager'];
}

function login(formData: FormData): string {
  const value = text(formData, 'login', 'Identifiant', 120).toLowerCase();
  if (!/^[a-z0-9._@+-]{3,120}$/.test(value)) throw new FieldError('L’identifiant ne peut contenir que des lettres sans accent, chiffres, points, tirets et @.');
  return value;
}

function done(message: string): FormState {
  revalidatePath('/parametres');
  revalidatePath('/personnel', 'layout');
  return { ok: message };
}

export async function createMemberAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('utilisateur.gerer');
    const roles = rolesFrom(formData);
    const password = String(formData.get('password') ?? '');
    const problem = passwordProblem(password, roles.includes('chauffeur'));
    if (problem) return { error: problem };
    const error = createUser(getDb(), ctx, {
      name: text(formData, 'name', 'Nom', 100),
      login: login(formData),
      password,
      roles,
      employeeId: optId(formData, 'employeeId'),
    });
    return error ? { error } : done('Membre ajouté.');
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateMemberAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('utilisateur.gerer');
    const roles = rolesFrom(formData);
    const password = String(formData.get('password') ?? '');
    if (password) {
      const problem = passwordProblem(password, roles.includes('chauffeur'));
      if (problem) return { error: problem };
    }
    const error = updateUser(getDb(), ctx, id(formData, 'userId'), {
      name: text(formData, 'name', 'Nom', 100),
      login: login(formData),
      roles,
      active: checked(formData, 'active'),
      password: password || null,
      employeeId: optId(formData, 'employeeId'),
    });
    return error ? { error } : done('Membre mis à jour.');
  } catch (error) {
    return toFormState(error);
  }
}

/** Désactivation temporaire (ou réactivation) sans toucher au reste. */
export async function toggleMemberAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('utilisateur.gerer');
    const db = getDb();
    const user = get<{ id: number; name: string; login: string; roles: string; active: number; employee_id: number | null }>(
      db,
      `SELECT id, name, login, roles, active, employee_id FROM users WHERE id = ? AND org_id = ? AND deleted_at IS NULL`,
      id(formData, 'userId'),
      ctx.orgId,
    );
    if (!user) return { error: 'Membre introuvable.' };
    const error = updateUser(db, ctx, user.id, {
      name: user.name,
      login: user.login,
      roles: parseRoles(user.roles),
      active: user.active !== 1,
      password: null,
      employeeId: user.employee_id,
    });
    return error ? { error } : done(user.active ? `${user.name} est désactivé(e) : plus aucune connexion possible.` : `${user.name} est réactivé(e).`);
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteMemberAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('utilisateur.gerer');
    const error = deleteUser(getDb(), ctx, id(formData, 'userId'));
    return error ? { error } : done('Membre supprimé. Son nom reste dans l’historique.');
  } catch (error) {
    return toFormState(error);
  }
}
