'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { markAllRead } from '@/lib/data/notifications';
import type { FormState } from '@/lib/forms';

export async function markAllReadAction(): Promise<FormState> {
  const ctx = await getSession();
  if (!ctx) redirect('/connexion');
  markAllRead(getDb(), ctx);
  revalidatePath('/', 'layout');
  return undefined;
}
