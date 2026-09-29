'use server';

import { revalidatePath } from 'next/cache';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { IMPORT_KINDS, isImportKind, runImport } from '@/lib/data/imports';
import { type FormState, csvInput, reportState, toFormState } from '@/lib/forms';

export async function importAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const kind = String(formData.get('kind') ?? '');
    if (!isImportKind(kind)) return { error: 'Type d’import inconnu.' };
    const ctx = await requireAction(IMPORT_KINDS[kind].action);
    const text = await csvInput(formData);
    const commit = formData.get('mode') === 'importer';
    const { report, summary } = runImport(getDb(), ctx, kind, text, commit);
    if (commit) revalidatePath('/', 'layout');
    return reportState(report, summary);
  } catch (error) {
    return toFormState(error);
  }
}
