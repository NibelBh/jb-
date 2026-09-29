import { addDays, daysBetween } from './dates';

/** Délai légal de désignation du conducteur (art. L121-6 du code de la route). */
export const DESIGNATION_DELAY_DAYS = 45;

/** Rappels envoyés après la date d'envoi de l'avis. */
export const DESIGNATION_REMINDER_DAYS = [30, 40, 44] as const;

export function designationDeadline(noticeSentOn: string): string {
  return addDays(noticeSentOn, DESIGNATION_DELAY_DAYS);
}

export type FineUrgency = 'depasse' | 'critique' | 'proche' | 'normal';

export function fineUrgency(noticeSentOn: string, today: string): { urgency: FineUrgency; daysLeft: number } {
  const daysLeft = daysBetween(today, designationDeadline(noticeSentOn));
  if (daysLeft < 0) return { urgency: 'depasse', daysLeft };
  if (daysLeft <= 5) return { urgency: 'critique', daysLeft };
  if (daysLeft <= 15) return { urgency: 'proche', daysLeft };
  return { urgency: 'normal', daysLeft };
}

export type AssignmentInterval = {
  id: number;
  employeeId: number;
  vehicleId: number;
  startedAt: string;
  endedAt: string | null;
};

export type DriverMatch =
  | { kind: 'unique'; assignment: AssignmentInterval }
  | { kind: 'ambigu'; assignments: AssignmentInterval[] }
  | { kind: 'aucun' };

/**
 * Retrouve qui conduisait `vehicleId` à l'instant `at`.
 * Un intervalle ouvert (endedAt nul) court jusqu'à maintenant.
 * Si plusieurs intervalles se chevauchent (erreur de saisie, relais en cours de tournée),
 * on ne choisit pas à la place de l'humain.
 */
export function findDriverAt(
  intervals: AssignmentInterval[],
  vehicleId: number,
  at: string,
  now: string = new Date().toISOString(),
): DriverMatch {
  const t = Date.parse(at);
  const matches = intervals.filter((a) => {
    if (a.vehicleId !== vehicleId) return false;
    const start = Date.parse(a.startedAt);
    const end = Date.parse(a.endedAt ?? now);
    return start <= t && t <= end;
  });
  if (matches.length === 0) return { kind: 'aucun' };
  const drivers = new Set(matches.map((m) => m.employeeId));
  if (drivers.size === 1) return { kind: 'unique', assignment: matches[0] };
  return { kind: 'ambigu', assignments: matches };
}
