'use server';

import { revalidatePath } from 'next/cache';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { addPayrollItem, deletePayrollItem, importPayrollJournal, savePayrollCodes } from '@/lib/data/payroll';
import { parseDecimalCell } from '@/lib/domain/importing';
import { type PayrollCodes, MANUAL_VARIABLES, PAYROLL_VARIABLES, isPeriod } from '@/lib/domain/payroll';
import { FieldError, type FormState, csvInput, id, oneOf, optText, reportState, toFormState } from '@/lib/forms';

function period(formData: FormData): string {
  const value = String(formData.get('period') ?? '');
  if (!isPeriod(value)) throw new FieldError('Période invalide.');
  return value;
}

export async function addPayrollItemAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('paie.gerer');
    const variable = oneOf(
      formData,
      'variable',
      MANUAL_VARIABLES.map((v) => ({ value: v.key })),
      'Élément',
    );
    const value = parseDecimalCell(String(formData.get('value') ?? ''));
    if (!value.ok || value.value === null) throw new FieldError('Indiquez une valeur (ex. 150 ou 7,5).');
    const error = addPayrollItem(getDb(), ctx, {
      employeeId: id(formData, 'employeeId'),
      period: period(formData),
      variable,
      value: value.value,
      note: optText(formData, 'note', 200),
    });
    if (error) return { error };
    revalidatePath('/paie');
    return { ok: 'Élément ajouté.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function deletePayrollItemAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('paie.gerer');
    deletePayrollItem(getDb(), ctx, id(formData, 'itemId'));
    revalidatePath('/paie');
    return undefined;
  } catch (error) {
    return toFormState(error);
  }
}

export async function savePayrollCodesAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('paie.gerer');
    const codes: Partial<PayrollCodes> = {};
    for (const v of PAYROLL_VARIABLES) {
      const code = String(formData.get(`code_${v.key}`) ?? '').trim();
      if (!code) throw new FieldError(`Code manquant pour « ${v.label} ».`);
      if (!/^[A-Za-z0-9_.\-]{1,20}$/.test(code)) throw new FieldError(`Code « ${code} » invalide : lettres, chiffres, point, tiret ou souligné, 20 caractères au plus.`);
      codes[v.key] = code;
    }
    savePayrollCodes(getDb(), ctx, codes);
    revalidatePath('/paie');
    return { ok: 'Codes enregistrés. Ils seront utilisés dans le prochain fichier d’import.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function importPayrollJournalAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('paie.gerer');
    const text = await csvInput(formData);
    const commit = formData.get('mode') === 'importer';
    const { report, summary } = importPayrollJournal(getDb(), ctx, text, period(formData), commit);
    if (commit) revalidatePath('/paie');
    return reportState(report, summary);
  } catch (error) {
    return toFormState(error);
  }
}
