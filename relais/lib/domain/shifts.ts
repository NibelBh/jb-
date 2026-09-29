/*
 * Créneaux de planning : un salarié, un jour, une heure de début, une heure de fin,
 * éventuellement une tournée et un véhicule. Un salarié peut avoir plusieurs créneaux
 * le même jour (deux tournées), mais jamais deux créneaux qui se chevauchent.
 */
import { parisLocalToIso } from './dates';

export const SHIFT_STATUSES = [
  { value: 'prevu', label: 'Prévu' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'realise', label: 'Réalisé' },
] as const;

export type ShiftStatus = (typeof SHIFT_STATUSES)[number]['value'];

export function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Accepte « 8h », « 8h30 », « 08:30 », « 830 » et renvoie « 08:30 ». */
export function normalizeTime(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/\s/g, '');
  let m = value.match(/^(\d{1,2})[h:](\d{2})?$/);
  if (!m) m = value.match(/^(\d{1,2})(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function plannedMinutes(start: string, end: string): number {
  return minutesOf(end) - minutesOf(start);
}

/** « 08:00 » et « 16:30 » donnent « 08h00–16h30 ». */
export function formatRange(start: string, end: string): string {
  return `${start.replace(':', 'h')}–${end.replace(':', 'h')}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export function overlaps(a: { start_time: string; end_time: string }, b: { start_time: string; end_time: string }): boolean {
  return minutesOf(a.start_time) < minutesOf(b.end_time) && minutesOf(b.start_time) < minutesOf(a.end_time);
}

export type ShiftTimes = { day: string; start_time: string; end_time: string; actual_start: string | null; actual_end: string | null };

/**
 * Durée réellement travaillée, en minutes : heures réelles si elles existent,
 * sinon heures prévues (créneau confirmé par un responsable sans pointage).
 */
export function workedMinutes(s: ShiftTimes): number {
  const start = s.actual_start ?? parisLocalToIso(s.day, s.start_time);
  const end = s.actual_end ?? parisLocalToIso(s.day, s.end_time);
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60000));
}

export type Availability = { available: true } | { available: false; reason: string };

/** Un salarié est indisponible un jour donné s'il est absent (hors retard), pas encore arrivé, sorti ou suspendu. */
export function availability(
  employee: { status: string; hired_on: string | null; left_on: string | null },
  absences: { type: string; label: string; start_on: string; end_on: string }[],
  day: string,
): Availability {
  if (employee.status === 'sorti' || (employee.left_on && employee.left_on < day)) return { available: false, reason: 'ne fait plus partie de l’entreprise' };
  if (employee.status === 'suspendu') return { available: false, reason: 'est suspendu' };
  if (employee.hired_on && employee.hired_on > day) return { available: false, reason: 'n’est pas encore arrivé dans l’entreprise' };
  const absence = absences.find((a) => a.type !== 'retard' && a.start_on <= day && a.end_on >= day);
  if (absence) return { available: false, reason: `est indisponible ce jour-là (${absence.label.toLowerCase()})` };
  return { available: true };
}
