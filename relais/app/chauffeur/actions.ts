'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireDriver } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { discardFiles, saveUpload, saveUploads } from '@/lib/data/files';
import { notify } from '@/lib/data/notifications';
import { createDamage, endAssignment, startAssignment } from '@/lib/data/operations';
import { addDocument } from '@/lib/data/records';
import { getVehicle } from '@/lib/data/vehicles';
import { REQUIRED_PHOTOS, parseAnswers } from '@/lib/domain/inspection';
import { DAMAGE_TYPES } from '@/lib/domain/labels';
import { type FormState, checked, id, int, oneOf, optDate, optText, text, toFormState } from '@/lib/forms';

async function inspectionPayload(formData: FormData, ctx: Awaited<ReturnType<typeof requireDriver>>) {
  const { answers, missing } = parseAnswers(formData);
  if (missing.length) return { error: `Répondez pour : ${missing.join(', ')}.` } as const;
  const odometer = int(formData, 'odometer', 'Kilométrage');
  for (const p of REQUIRED_PHOTOS) {
    const value = formData.get(`photo_${p.key}`);
    if (!value || typeof value !== 'object' || value.size === 0) return { error: `Photo manquante : ${p.label.toLowerCase()}.` } as const;
  }
  const db = getDb();
  const photos: Record<string, number> = {};
  for (const p of REQUIRED_PHOTOS) {
    const fileId = await saveUpload(db, ctx, formData.get(`photo_${p.key}`));
    if (fileId) photos[p.key] = fileId;
  }
  return {
    input: {
      employeeId: ctx.employeeId,
      odometer,
      confirmOdometer: checked(formData, 'confirmOdometer'),
      answers,
      photos,
      comment: optText(formData, 'comment', 1000) ?? '',
    },
  } as const;
}

export async function takeVehicleAction(_: FormState, formData: FormData): Promise<FormState> {
  let destination: string;
  try {
    const ctx = await requireDriver();
    const vehicleId = id(formData, 'vehicleId');
    const payload = await inspectionPayload(formData, ctx);
    if ('error' in payload) return { error: payload.error };
    const db = getDb();
    const result = startAssignment(db, ctx, vehicleId, payload.input);
    if (!result.ok) {
      discardFiles(db, ctx.orgId, Object.values(payload.input.photos));
      return { error: result.error, needsConfirmation: result.needsOdometerConfirmation };
    }
    destination = result.kind === 'bloque' ? '/chauffeur?etat=bloque' : '/chauffeur?etat=parti';
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/', 'layout');
  redirect(destination);
}

export async function returnVehicleAction(_: FormState, formData: FormData): Promise<FormState> {
  let destination: string;
  try {
    const ctx = await requireDriver();
    const payload = await inspectionPayload(formData, ctx);
    if ('error' in payload) return { error: payload.error };
    const db = getDb();
    const result = endAssignment(db, ctx, payload.input);
    if (!result.ok) {
      discardFiles(db, ctx.orgId, Object.values(payload.input.photos));
      return { error: result.error, needsConfirmation: result.needsOdometerConfirmation };
    }
    destination = result.damageId ? '/chauffeur?etat=rendu_signale' : '/chauffeur?etat=rendu';
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/', 'layout');
  redirect(destination);
}

export async function reportProblemAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireDriver();
    const db = getDb();
    const vehicleId = id(formData, 'vehicleId');
    if (!getVehicle(db, ctx.orgId, vehicleId)) return { error: 'Véhicule introuvable.' };
    const type = oneOf(formData, 'type', DAMAGE_TYPES, 'Type de problème');
    const description = text(formData, 'description', 'Description', 2000);
    const lat = Number(formData.get('latitude'));
    const lng = Number(formData.get('longitude'));
    const hasPosition = formData.get('latitude') !== '' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const photos = await saveUploads(db, ctx, formData.getAll('photos').slice(0, 6));
    const injured = checked(formData, 'injured');
    createDamage(db, ctx, {
      vehicleId,
      employeeId: ctx.employeeId,
      type,
      severity: type === 'accident' || type === 'panne' || injured ? 'grave' : 'moyen',
      description,
      occurredAt: new Date().toISOString(),
      photos,
      injured,
      latitude: hasPosition ? lat : null,
      longitude: hasPosition ? lng : null,
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath('/', 'layout');
  redirect('/chauffeur?etat=signale');
}

const SELF_DOCUMENT_TYPES = [{ value: 'permis' }, { value: 'piece_identite' }, { value: 'titre_sejour' }, { value: 'formation' }, { value: 'autre' }] as const;

/** Le chauffeur envoie lui-même un document ; les RH sont prévenues pour vérifier. */
export async function sendMyDocumentAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireDriver();
    const db = getDb();
    const type = oneOf(formData, 'type', SELF_DOCUMENT_TYPES, 'Type de document');
    const fileId = await saveUpload(db, ctx, formData.get('file'));
    if (!fileId) return { error: 'Prenez le document en photo.' };
    const error = addDocument(db, ctx, {
      entity: 'employee',
      entityId: ctx.employeeId,
      type,
      reference: 'Envoyé depuis l’application',
      issuedOn: null,
      expiresOn: optDate(formData, 'expiresOn', 'Date d’expiration'),
      fileId,
      syncLicence: false,
    });
    if (error) return { error };
    notify(db, ctx.orgId, {
      roles: ['admin', 'rh'],
      kind: 'document',
      title: `${ctx.name} a envoyé un document`,
      body: 'À vérifier dans sa fiche.',
      link: `/personnel/${ctx.employeeId}`,
    });
    revalidatePath('/chauffeur', 'layout');
    return { ok: 'Document envoyé. Merci !' };
  } catch (error) {
    return toFormState(error);
  }
}
