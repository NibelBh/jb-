/*
 * Dates : les jours sont stockés en 'YYYY-MM-DD' (heure de Paris),
 * les instants en ISO UTC. Les calculs de jours se font en UTC pur
 * pour éviter les décalages d'heure d'été.
 */

export const TIME_ZONE = 'Europe/Paris';

const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  // 29 février + 1 an : on retombe sur le 28 février, pas le 1er mars.
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

/** Jour calendaire à Paris pour un instant donné. */
export function parisDate(instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Lundi de la semaine qui contient `isoDate`. */
export function startOfWeek(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(isoDate, offset);
}

/**
 * Convertit une date et une heure saisies à Paris ('2026-09-12', '07:32')
 * en instant ISO UTC.
 */
export function parisLocalToIso(isoDate: string, time: string): string {
  const [h, min] = time.split(':').map(Number);
  const guess = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
    h,
    min,
  );
  // Décalage de Paris à cet instant (1 h ou 2 h selon la saison).
  const offset = parisOffsetMinutes(new Date(guess));
  const instant = new Date(guess - offset * 60_000);
  // Si le décalage change entre les deux instants (nuit du changement d'heure), on corrige.
  const offset2 = parisOffsetMinutes(instant);
  return new Date(guess - offset2 * 60_000).toISOString();
}

function parisOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const text = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
  return text.replace(' ', ' à ').replace(':', ' h ');
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .replace(':', ' h ');
}

export function formatWeekday(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Heure de Paris d'un instant, au format « 08:30 » (pour un champ `time`). */
export function parisClock(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
