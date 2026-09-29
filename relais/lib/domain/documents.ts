import { addYears, daysBetween } from './dates';

/** Paliers d'alerte, du plus urgent au moins urgent. */
export type ExpiryLevel = 'expire' | 'j7' | 'j15' | 'j30' | 'j90' | 'ok' | 'sans_date';

export type ExpiryStatus = {
  level: ExpiryLevel;
  daysLeft: number | null;
};

export const EXPIRY_THRESHOLDS: { level: Exclude<ExpiryLevel, 'expire' | 'ok' | 'sans_date'>; days: number }[] = [
  { level: 'j7', days: 7 },
  { level: 'j15', days: 15 },
  { level: 'j30', days: 30 },
  { level: 'j90', days: 90 },
];

export function expiryStatus(expiresOn: string | null | undefined, today: string): ExpiryStatus {
  if (!expiresOn) return { level: 'sans_date', daysLeft: null };
  const daysLeft = daysBetween(today, expiresOn);
  if (daysLeft < 0) return { level: 'expire', daysLeft };
  for (const threshold of EXPIRY_THRESHOLDS) {
    if (daysLeft <= threshold.days) return { level: threshold.level, daysLeft };
  }
  return { level: 'ok', daysLeft };
}

/** Vrai si le statut demande une action dans les 30 jours. */
export function needsAttention(status: ExpiryStatus): boolean {
  return status.level === 'expire' || status.level === 'j7' || status.level === 'j15' || status.level === 'j30';
}

export function expiryLabel(status: ExpiryStatus): string {
  if (status.level === 'sans_date') return 'Sans date';
  if (status.daysLeft === null) return '';
  if (status.daysLeft < 0) {
    const n = -status.daysLeft;
    return `Expiré depuis ${n} jour${n > 1 ? 's' : ''}`;
  }
  if (status.daysLeft === 0) return 'Expire aujourd’hui';
  return `Expire dans ${status.daysLeft} jour${status.daysLeft > 1 ? 's' : ''}`;
}

/**
 * Échéance du contrôle technique d'un véhicule léger (PTAC ≤ 3,5 t) :
 * avant le 4e anniversaire de la première immatriculation, puis tous les 2 ans.
 * Si un contrôle a été enregistré, la prochaine échéance est sa date + 2 ans.
 */
export function technicalInspectionDue(firstRegistration: string | null, lastInspection: string | null): string | null {
  if (lastInspection) return addYears(lastInspection, 2);
  if (firstRegistration) return addYears(firstRegistration, 4);
  return null;
}

export const DOCUMENT_TYPES = {
  vehicle: [
    { value: 'carte_grise', label: 'Carte grise' },
    { value: 'assurance', label: 'Attestation d’assurance' },
    { value: 'controle_technique', label: 'Procès-verbal de contrôle technique' },
    { value: 'contrat_location', label: 'Contrat de location' },
    { value: 'autre', label: 'Autre document' },
  ],
  employee: [
    { value: 'permis', label: 'Permis de conduire' },
    { value: 'piece_identite', label: 'Pièce d’identité' },
    { value: 'titre_sejour', label: 'Titre de séjour' },
    { value: 'contrat_travail', label: 'Contrat de travail' },
    { value: 'formation', label: 'Attestation de formation' },
    { value: 'visite_medicale', label: 'Avis de visite d’information et de prévention' },
    { value: 'autre', label: 'Autre document' },
  ],
  organization: [
    { value: 'licence_transport', label: 'Licence de transport intérieur' },
    { value: 'attestation_urssaf', label: 'Attestation de vigilance Urssaf' },
    { value: 'kbis', label: 'Extrait Kbis' },
    { value: 'assurance_flotte', label: 'Assurance flotte' },
    { value: 'autre', label: 'Autre document' },
  ],
} as const;

export type DocumentEntity = keyof typeof DOCUMENT_TYPES;

export function documentTypeLabel(entity: DocumentEntity, type: string): string {
  const found = DOCUMENT_TYPES[entity].find((t) => t.value === type);
  return found ? found.label : type;
}

export function isDocumentType(entity: DocumentEntity, type: string): boolean {
  return DOCUMENT_TYPES[entity].some((t) => t.value === type);
}
