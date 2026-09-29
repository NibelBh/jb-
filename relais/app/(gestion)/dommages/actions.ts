'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { attachToDamage, setDamageCosts } from '@/lib/data/cases';
import { saveUpload, saveUploads } from '@/lib/data/files';
import { changeDamageStatus, createDamage } from '@/lib/data/operations';
import { parisLocalToIso } from '@/lib/domain/dates';
import { parseZones } from '@/lib/domain/zones';
import { DAMAGE_STATUSES, DAMAGE_TYPES, SEVERITIES } from '@/lib/domain/labels';
import { type FormState, checked, date, id, oneOf, optEuros, optId, optText, text, time, toFormState } from '@/lib/forms';

export async function createDamageAction(_: FormState, formData: FormData): Promise<FormState> {
  let damageId: number;
  try {
    const ctx = await requireAction('dommage.modifier');
    const db = getDb();
    const photos = await saveUploads(db, ctx, formData.getAll('photos'));
    damageId = createDamage(db, ctx, {
      vehicleId: id(formData, 'vehicleId'),
      employeeId: optId(formData, 'employeeId'),
      type: oneOf(formData, 'type', DAMAGE_TYPES, 'Type'),
      severity: oneOf(formData, 'severity', SEVERITIES, 'Gravité'),
      description: text(formData, 'description', 'Description', 2000),
      occurredAt: parisLocalToIso(date(formData, 'day', 'Date'), time(formData, 'time', 'Heure')),
      photos,
      injured: checked(formData, 'injured'),
      locationText: optText(formData, 'location', 200),
      zones: parseZones(String(formData.get('zones') ?? '')),
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/dommages');
  redirect(`/dommages/${damageId}`);
}

export async function changeDamageStatusAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('dommage.modifier');
    const error = changeDamageStatus(getDb(), ctx, id(formData, 'damageId'), oneOf(formData, 'status', DAMAGE_STATUSES, 'Statut'), optText(formData, 'text', 2000) ?? '');
    if (error) return { error };
    revalidatePath('/dommages', 'layout');
    return { ok: 'Dossier mis à jour.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function attachToDamageAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('dommage.modifier');
    const db = getDb();
    const fileId = await saveUpload(db, ctx, formData.get('file'));
    if (!fileId) return { error: 'Choisissez un fichier (devis, facture, constat, photo).' };
    attachToDamage(db, ctx, id(formData, 'damageId'), fileId, optText(formData, 'text', 300) ?? '');
    revalidatePath('/dommages', 'layout');
    return { ok: 'Pièce jointe ajoutée.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function setDamageCostsAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('dommage.modifier');
    const error = setDamageCosts(getDb(), ctx, id(formData, 'damageId'), optEuros(formData, 'estimated', 'Coût estimé'), optEuros(formData, 'final', 'Coût final'));
    if (error) return { error };
    revalidatePath('/dommages', 'layout');
    return { ok: 'Coûts enregistrés.' };
  } catch (error) {
    return toFormState(error);
  }
}
