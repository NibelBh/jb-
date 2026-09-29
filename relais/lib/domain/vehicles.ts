/*
 * Conformité administrative d'un véhicule : assurance et contrôle technique.
 * Un véhicule dont l'assurance ou le contrôle technique est expiré ne doit pas rouler.
 */
import { type ExpiryStatus, expiryStatus, technicalInspectionDue } from './documents';

export type VehicleAdmin = {
  insurance_end_on: string | null;
  ct_last_on: string | null;
  ct_expires_on: string | null;
  first_registration_on: string | null;
};

export type Compliance = {
  insurance: ExpiryStatus;
  ctDue: string | null;
  ct: ExpiryStatus;
  /** Raisons qui interdisent de faire rouler le véhicule ce jour-là. */
  blocking: string[];
};

/** Échéance du contrôle technique : la date saisie, sinon calculée (4 ans puis tous les 2 ans). */
export function ctDueDate(v: VehicleAdmin): string | null {
  return v.ct_expires_on ?? technicalInspectionDue(v.first_registration_on, v.ct_last_on);
}

export function vehicleCompliance(v: VehicleAdmin, day: string): Compliance {
  const insurance = expiryStatus(v.insurance_end_on, day);
  const ctDue = ctDueDate(v);
  const ct = expiryStatus(ctDue, day);
  const blocking: string[] = [];
  if (insurance.level === 'expire') blocking.push('Assurance expirée');
  if (ct.level === 'expire') blocking.push('Contrôle technique expiré');
  return { insurance, ctDue, ct, blocking };
}
