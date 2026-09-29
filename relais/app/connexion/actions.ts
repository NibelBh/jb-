'use server';

import { redirect } from 'next/navigation';
import { login, logout } from '@/lib/auth';
import type { FormState } from '@/lib/forms';

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const loginId = String(formData.get('login') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!loginId || !password) return { error: 'Saisissez votre identifiant et votre mot de passe ou code.' };
  const result = await login(loginId, password);
  if (!result.ok) return { error: result.error };
  redirect(result.home);
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/connexion');
}
