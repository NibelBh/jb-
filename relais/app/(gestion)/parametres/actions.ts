'use server';

import { revalidatePath } from 'next/cache';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createUser, updateUserAccess } from '@/lib/data/records';
import { passwordProblem } from '@/lib/domain/password';
import { type Role, parseRoles } from '@/lib/domain/roles';
import { type FormState, checked, id, optId, text, toFormState } from '@/lib/forms';

function roles(formData: FormData): Role[] {
  return parseRoles(formData.getAll('roles').map(String).join(','));
}

export async function createManagerAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('utilisateur.gerer');
    const selected = roles(formData);
    if (selected.length === 0) return { error: 'Choisissez au moins un rôle.' };
    const password = String(formData.get('password') ?? '');
    const problem = passwordProblem(password, false);
    if (problem) return { error: problem };
    const error = createUser(getDb(), ctx, {
      name: text(formData, 'name', 'Nom', 100),
      login: text(formData, 'login', 'Identifiant (e-mail)', 120),
      password,
      roles: selected,
      employeeId: optId(formData, 'employeeId'),
    });
    if (error) return { error };
    revalidatePath('/parametres');
    return { ok: 'Utilisateur créé.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateAccessAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('utilisateur.gerer');
    const selected = roles(formData);
    if (selected.length === 0) return { error: 'Choisissez au moins un rôle.' };
    const password = String(formData.get('password') ?? '');
    if (password) {
      const onlyDriver = selected.every((r) => r === 'chauffeur');
      const problem = passwordProblem(password, onlyDriver);
      if (problem) return { error: problem };
    }
    const error = updateUserAccess(getDb(), ctx, id(formData, 'userId'), { roles: selected, active: checked(formData, 'active'), password: password || null });
    if (error) return { error };
    revalidatePath('/parametres');
    return { ok: 'Accès mis à jour.' };
  } catch (error) {
    return toFormState(error);
  }
}
