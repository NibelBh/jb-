'use server';

import { revalidatePath } from 'next/cache';
import { requireAction } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { saveUpload } from '@/lib/data/files';
import { addDocument, deleteDocument } from '@/lib/data/records';
import { type DocumentEntity, isDocumentType } from '@/lib/domain/documents';
import { type FormState, id, optDate, optText, toFormState } from '@/lib/forms';

/** Ajout d'un document, partagé par les fiches véhicule, salarié et entreprise. */
export async function addDocumentAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('document.modifier');
    const entity = String(formData.get('entity')) as DocumentEntity;
    if (!['vehicle', 'employee', 'organization'].includes(entity)) return { error: 'Type d’élément invalide.' };
    const type = String(formData.get('type') ?? '');
    if (!isDocumentType(entity, type)) return { error: 'Choisissez un type de document.' };
    const db = getDb();
    const fileId = await saveUpload(db, ctx, formData.get('file'));
    const error = addDocument(db, ctx, {
      entity,
      entityId: entity === 'organization' ? ctx.orgId : id(formData, 'entityId'),
      type,
      reference: optText(formData, 'reference', 120),
      issuedOn: optDate(formData, 'issuedOn', 'Date de délivrance'),
      expiresOn: optDate(formData, 'expiresOn', 'Date d’expiration'),
      fileId,
    });
    if (error) return { error };
    revalidatePath('/', 'layout');
    return { ok: 'Document ajouté.' };
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteDocumentAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const ctx = await requireAction('document.modifier');
    deleteDocument(getDb(), ctx, id(formData, 'documentId'));
    revalidatePath('/', 'layout');
    return undefined;
  } catch (error) {
    return toFormState(error);
  }
}
