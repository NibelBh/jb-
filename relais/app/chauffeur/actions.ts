'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireDriver } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { discardFiles, saveUpload, saveUploads } from '@/lib/data/files';
import { notify } from '@/lib/data/notifications';
import { type InspectionInput, createDamage, endAssignment, startAssignment } from '@/lib/data/operations';
import { addDocument } from '@/lib/data/records';
import { getVehicle } from '@/lib/data/vehicles';
import { END_OF_DAY_PHOTOS, REQUIRED_PHOTOS, missingPhotos, parseAnswers } from '@/lib/domain/inspection';
import { DAMAGE_TYPES, SEVERITIES } from '@/lib/domain/labels';
import { parseZones } from '@/lib/domain/zones';
import { type FormState, checked, id, int, oneOf, optDate, optText, text, toFormState } from '@/lib/forms';

async function inspectionPayload(formData: FormData, ctx: Awaited<ReturnType<typeof requireDriver>>, kind: 'depart' | 'retour') {
  const { answers, missing } = parseAnswers(formData);
  if (missing.length) return { error: `Répondez pour : ${missing.join(', ')}.` } as const;
  const odometer = int(formData, 'odometer', 'Kilométrage');
  const required = kind === 'retour' ? END_OF_DAY_PHOTOS : REQUIRED_PHOTOS;
  const hasFile = (value: FormDataEntryValue | null) => !!value && typeof value === 'object' && value.size > 0;
  const absent = required.filter((p) => !hasFile(formData.get(`photo_${p.key}`))).map((p) => p.label.toLowerCase());
  if (absent.length) return { error: `Photo${absent.length > 1 ? 's' : ''} manquante${absent.length > 1 ? 's' : ''} : ${absent.join(', ')}.` } as const;

  let damage: InspectionInput['damage'] = null;
  if (kind === 'retour' && checked(formData, 'newDamage')) {
    const zones = parseZones(String(formData.get('damageZones') ?? ''));
    const description = String(formData.get('damageDescription') ?? '').trim().slice(0, 2000);
    if (zones.length === 0) return { error: 'Indiquez sur le schéma où se trouve le nouveau dégât.' } as const;
    if (!description) return { error: 'Décrivez le nouveau dégât.' } as const;
    if (!formData.getAll('damagePhotos').some(hasFile)) return { error: 'Prenez au moins une photo du nouveau dégât.' } as const;
    damage = { zones, description, photos: [], severity: oneOf(formData, 'damageSeverity', SEVERITIES, 'Gravité') };
  }

  const db = getDb();
  const photos: Record<string, number> = {};
  for (const p of REQUIRED_PHOTOS) {
    const fileId = await saveUpload(db, ctx, formData.get(`photo_${p.key}`));
    if (fileId) photos[p.key] = fileId;
  }
  const stillMissing = missingPhotos(photos, required);
  if (stillMissing.length) {
    discardFiles(db, ctx.orgId, Object.values(photos));
    return { error: `Photo illisible : ${stillMissing.join(', ').toLowerCase()}. Reprenez-la.` } as const;
  }
  if (damage) damage.photos = await saveUploads(db, ctx, formData.getAll('damagePhotos').slice(0, 6));
  const input: InspectionInput = {
    employeeId: ctx.employeeId,
    odometer,
    confirmOdometer: checked(formData, 'confirmOdometer'),
    answers,
    photos,
    comment: optText(formData, 'comment', 1000) ?? '',
    damage,
  };
  return { input } as const;
}

function uploadedIds(input: InspectionInput): number[] {
  return [...Object.values(input.photos), ...(input.damage?.photos ?? [])];
}

export async function takeVehicleAction(_: FormState, formData: FormData): Promise<FormState> {
  let destination: string;
  try {
    const ctx = await requireDriver();
    const vehicleId = id(formData, 'vehicleId');
    const payload = await inspectionPayload(formData, ctx, 'depart');
    if ('error' in payload) return { error: payload.error };
    const db = getDb();
    const result = startAssignment(db, ctx, vehicleId, payload.input);
    if (!result.ok) {
      discardFiles(db, ctx.orgId, uploadedIds(payload.input));
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
    const payload = await inspectionPayload(formData, ctx, 'retour');
    if ('error' in payload) return { error: payload.error };
    const db = getDb();
    const result = endAssignment(db, ctx, payload.input);
    if (!result.ok) {
      discardFiles(db, ctx.orgId, uploadedIds(payload.input));
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
    const zones = parseZones(String(formData.get('zones') ?? ''));
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
      zones,
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
