'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createFine, designateDriver, setFineStatus, updateFine } from '@/lib/data/cases';
import { saveUpload } from '@/lib/data/files';
import { parisDate, parisLocalToIso } from '@/lib/domain/dates';
import { FINE_STATUSES } from '@/lib/domain/labels';
import { FieldError, type FormState, date, id, oneOf, optEuros, optText, time, toFormState } from '@/lib/forms';

export async function createFineAction(_: FormState, formData: FormData): Promise<FormState> {
  let fineId: number;
  try {
    const ctx = await requireAction('amende.modifier');
    const db = getDb();
    const offenseDay = date(formData, 'offenseDay', 'Date de l’infraction');
    const noticeSentOn = date(formData, 'noticeSentOn', 'Date d’envoi de l’avis');
    if (noticeSentOn < offenseDay) throw new FieldError('L’avis ne peut pas être envoyé avant l’infraction.');
    if (noticeSentOn > parisDate()) throw new FieldError('La date d’envoi de l’avis est dans le futur.');
    const noticeFileId = await saveUpload(db, ctx, formData.get('notice'));
    fineId = createFine(db, ctx, {
      vehicleId: id(formData, 'vehicleId'),
      noticeNumber: optText(formData, 'noticeNumber', 60),
      offenseAt: parisLocalToIso(offenseDay, time(formData, 'offenseTime', 'Heure de l’infraction')),
      noticeSentOn,
      location: optText(formData, 'location', 200),
      amountCents: optEuros(formData, 'amount', 'Montant'),
      description: optText(formData, 'description', 500),
      noticeFileId,
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/amendes');
  redirect(`/amendes/${fineId}`);
}

export async function designateAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('amende.modifier');
    const db = getDb();
    const proofFileId = await saveUpload(db, ctx, formData.get('proof'));
    const error = designateDriver(db, ctx, id(formData, 'fineId'), {
      employeeId: id(formData, 'employeeId'),
      designatedOn: date(formData, 'designatedOn', 'Date de désignation'),
      proofFileId,
    });
    if (error) return { error };
    revalidatePath('/amendes', 'layout');
    revalidatePath('/aujourdhui');
    return { ok: 'Désignation enregistrée.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function setFineStatusAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('amende.modifier');
    const error = setFineStatus(getDb(), ctx, id(formData, 'fineId'), oneOf(formData, 'status', FINE_STATUSES, 'Statut'), optText(formData, 'note', 500) ?? '');
    if (error) return { error };
    revalidatePath('/amendes', 'layout');
    revalidatePath('/aujourdhui');
    return { ok: 'Statut mis à jour.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateFineAction(_: FormState, formData: FormData): Promise<FormState> {
  const fineId = Number(formData.get('fineId'));
  try {
    const ctx = await requireAction('amende.modifier');
    const db = getDb();
    const offenseDay = date(formData, 'offenseDay', 'Date de l’infraction');
    const noticeSentOn = date(formData, 'noticeSentOn', 'Date d’envoi de l’avis');
    if (noticeSentOn > parisDate()) throw new FieldError('La date d’envoi de l’avis est dans le futur.');
    const noticeFileId = await saveUpload(db, ctx, formData.get('notice'));
    const error = updateFine(db, ctx, fineId, {
      vehicleId: id(formData, 'vehicleId'),
      noticeNumber: optText(formData, 'noticeNumber', 60),
      offenseAt: parisLocalToIso(offenseDay, time(formData, 'offenseTime', 'Heure de l’infraction')),
      noticeSentOn,
      location: optText(formData, 'location', 200),
      amountCents: optEuros(formData, 'amount', 'Montant'),
      description: optText(formData, 'description', 500),
      noticeFileId,
    });
    if (error) return { error };
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/amendes', 'layout');
  redirect(`/amendes/${fineId}?enregistre=1`);
}
