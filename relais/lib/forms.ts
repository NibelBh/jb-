/* Lecture des champs de formulaire côté serveur, avec des messages d'erreur en français. */
import { decodeCsvBytes } from './domain/csv';
import { isIsoDate } from './domain/dates';
import type { ImportReport } from './domain/importing';

export type FormState =
  | {
      error?: string;
      ok?: string;
      needsConfirmation?: boolean;
      /** Lignes de détail (anomalies d'un import, par exemple). */
      details?: string[];
      /** Vrai après une vérification réussie d'import : le bouton « Importer » est mis en avant. */
      verified?: boolean;
    }
  | undefined;

export class FieldError extends Error {
  override name = 'FieldError';
}

export function text(formData: FormData, name: string, label: string, max = 200): string {
  const value = String(formData.get(name) ?? '').trim();
  if (!value) throw new FieldError(`Le champ « ${label} » est obligatoire.`);
  if (value.length > max) throw new FieldError(`Le champ « ${label} » est trop long (${max} caractères maximum).`);
  return value;
}

export function optText(formData: FormData, name: string, max = 2000): string | null {
  const value = String(formData.get(name) ?? '').trim();
  return value ? value.slice(0, max) : null;
}

export function int(formData: FormData, name: string, label: string): number {
  const raw = String(formData.get(name) ?? '').replace(/\s/g, '');
  const value = Number(raw);
  if (!raw || !Number.isInteger(value)) throw new FieldError(`Le champ « ${label} » doit être un nombre entier.`);
  return value;
}

export function optInt(formData: FormData, name: string, label: string): number | null {
  const raw = String(formData.get(name) ?? '').replace(/\s/g, '');
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new FieldError(`Le champ « ${label} » doit être un nombre entier.`);
  return value;
}

export function id(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value) || value <= 0) throw new FieldError('Élément invalide.');
  return value;
}

export function optId(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? '');
  if (!raw) return null;
  return id(formData, name);
}

export function date(formData: FormData, name: string, label: string): string {
  const value = String(formData.get(name) ?? '').trim();
  if (!isIsoDate(value)) throw new FieldError(`Le champ « ${label} » doit être une date valide.`);
  return value;
}

export function optDate(formData: FormData, name: string, label: string): string | null {
  const value = String(formData.get(name) ?? '').trim();
  if (!value) return null;
  if (!isIsoDate(value)) throw new FieldError(`Le champ « ${label} » doit être une date valide.`);
  return value;
}

export function time(formData: FormData, name: string, label: string): string {
  const value = String(formData.get(name) ?? '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new FieldError(`Le champ « ${label} » doit être une heure valide.`);
  return value;
}

export function oneOf<T extends string>(formData: FormData, name: string, options: readonly { value: T }[], label: string): T {
  const value = String(formData.get(name) ?? '');
  const found = options.find((o) => o.value === value);
  if (!found) throw new FieldError(`Choisissez une valeur pour « ${label} ».`);
  return found.value;
}

/** Montant en euros saisi librement ("1 450,50") converti en centimes. */
export function optEuros(formData: FormData, name: string, label: string): number | null {
  const raw = String(formData.get(name) ?? '').replace(/\s|€/g, '').replace(',', '.');
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new FieldError(`Le champ « ${label} » doit être un montant valide.`);
  return Math.round(value * 100);
}

export function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === 'on' || formData.get(name) === '1';
}

/** Transforme une exception en état de formulaire affichable. */
export function toFormState(error: unknown): FormState {
  if (error instanceof FieldError) return { error: error.message };
  if (error instanceof Error && error.name === 'ForbiddenError') return { error: error.message };
  if (error instanceof Error && error.name === 'UploadError') return { error: error.message };
  throw error;
}

export const MAX_CSV_BYTES = 2 * 1024 * 1024;

/** Contenu CSV envoyé soit en fichier (champ `file`), soit collé (champ `csv`). */
export async function csvInput(formData: FormData): Promise<string> {
  const file = formData.get('file');
  if (file && typeof file === 'object' && 'arrayBuffer' in file && file.size > 0) {
    if (file.size > MAX_CSV_BYTES) throw new FieldError('Fichier trop lourd (2 Mo maximum).');
    return decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  }
  const pasted = String(formData.get('csv') ?? '');
  if (!pasted.trim()) throw new FieldError('Choisissez un fichier CSV ou collez son contenu.');
  if (pasted.length > MAX_CSV_BYTES) throw new FieldError('Contenu trop long (2 Mo maximum).');
  return pasted;
}

const MAX_DETAILS = 50;

/** Transforme un rapport d'import en état de formulaire (succès, anomalies, bouton « Importer » mis en avant). */
export function reportState(report: ImportReport, summary: string): FormState {
  const details = report.errors.slice(0, MAX_DETAILS);
  if (report.errors.length > MAX_DETAILS) details.push(`… et ${report.errors.length - MAX_DETAILS} autres anomalies.`);
  const nothingDone = report.created + report.updated + report.skipped === 0;
  if (nothingDone && report.errors.length > 0) return { error: summary, details };
  return { ok: summary, details, verified: !report.committed };
}
