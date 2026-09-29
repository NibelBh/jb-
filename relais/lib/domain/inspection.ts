/*
 * Inspection du véhicule au départ et au retour.
 * La liste est volontairement courte : un chauffeur doit la terminer en moins de trois minutes.
 */

export const CHECKLIST = [
  { key: 'pneus', label: 'Pneus' },
  { key: 'freins', label: 'Freins' },
  { key: 'eclairage', label: 'Éclairage' },
  { key: 'clignotants', label: 'Clignotants' },
  { key: 'retroviseurs', label: 'Rétroviseurs' },
  { key: 'carrosserie', label: 'Carrosserie' },
  { key: 'pare_brise', label: 'Pare-brise et essuie-glaces' },
  { key: 'niveaux', label: 'Niveaux et voyants' },
  { key: 'securite', label: 'Gilet, triangle, extincteur' },
  { key: 'etat_general', label: 'Propreté et état général' },
] as const;

export type ChecklistKey = (typeof CHECKLIST)[number]['key'];

/** ok = conforme, mineur = à surveiller, bloquant = le véhicule ne doit pas partir. */
export type ItemResult = 'ok' | 'mineur' | 'bloquant';

export const REQUIRED_PHOTOS = [
  { key: 'avant', label: 'Face avant' },
  { key: 'arriere', label: 'Face arrière' },
  { key: 'gauche', label: 'Côté gauche' },
  { key: 'droite', label: 'Côté droit' },
  { key: 'compteur', label: 'Compteur kilométrique' },
] as const;

/** État de fin de journée : quatre faces obligatoires (le compteur reste conseillé). */
export const END_OF_DAY_PHOTOS = REQUIRED_PHOTOS.filter((p) => p.key !== 'compteur');

/** Libellés des photos obligatoires qui manquent. */
export function missingPhotos(photos: Record<string, number>, required: readonly { key: string; label: string }[]): string[] {
  return required.filter((p) => !photos[p.key]).map((p) => p.label);
}

export type InspectionAnswers = Record<ChecklistKey, { result: ItemResult; note: string }>;

export function worstResult(answers: Partial<InspectionAnswers>): ItemResult {
  let worst: ItemResult = 'ok';
  for (const item of Object.values(answers)) {
    if (!item) continue;
    if (item.result === 'bloquant') return 'bloquant';
    if (item.result === 'mineur') worst = 'mineur';
  }
  return worst;
}

export function parseAnswers(formData: FormData): { answers: InspectionAnswers; missing: string[] } {
  const answers = {} as InspectionAnswers;
  const missing: string[] = [];
  for (const item of CHECKLIST) {
    const raw = String(formData.get(`item_${item.key}`) ?? '');
    const note = String(formData.get(`note_${item.key}`) ?? '').trim().slice(0, 500);
    if (raw !== 'ok' && raw !== 'mineur' && raw !== 'bloquant') {
      missing.push(item.label);
      continue;
    }
    answers[item.key] = { result: raw, note };
  }
  return { answers, missing };
}

export type OdometerCheck =
  | { ok: true }
  | { ok: false; reason: 'invalide' | 'inferieur' | 'saut'; message: string };

/** Au-delà de ce saut entre deux relevés, on demande une confirmation. */
export const MAX_ODOMETER_JUMP_KM = 1500;

export function checkOdometer(value: number, previous: number | null): OdometerCheck {
  if (!Number.isInteger(value) || value < 0 || value > 2_000_000) {
    return { ok: false, reason: 'invalide', message: 'Le kilométrage doit être un nombre entier.' };
  }
  if (previous !== null && value < previous) {
    return {
      ok: false,
      reason: 'inferieur',
      message: `Le kilométrage saisi (${formatKm(value)}) est inférieur au dernier relevé (${formatKm(previous)}).`,
    };
  }
  if (previous !== null && value - previous > MAX_ODOMETER_JUMP_KM) {
    return {
      ok: false,
      reason: 'saut',
      message: `Le kilométrage saisi (${formatKm(value)}) dépasse de ${formatKm(value - previous)} le dernier relevé (${formatKm(previous)}).`,
    };
  }
  return { ok: true };
}

export function formatKm(value: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(value).replace(/ | /g, ' ')} km`;
}
