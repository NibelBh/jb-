/*
 * Préparation de la paie. Relais ne calcule pas les salaires : il rassemble, pour chaque
 * salarié et chaque mois, les éléments variables que le logiciel de paie ou le cabinet
 * attend (jours travaillés, absences datées, retards, primes…), dans un fichier importable.
 */
import { toCsv } from './csv';
import { addDays, formatDate } from './dates';

export type PayrollUnit = 'jours' | 'nombre' | 'euros' | 'heures' | 'valeur';

export const PAYROLL_VARIABLES = [
  { key: 'jours_travailles', label: 'Jours travaillés', unit: 'jours', defaultCode: 'JTRAV', source: 'auto' },
  { key: 'tournees', label: 'Tournées effectuées', unit: 'nombre', defaultCode: 'TOURN', source: 'auto' },
  { key: 'heures_travaillees', label: 'Heures travaillées', unit: 'heures', defaultCode: 'HTRAV', source: 'auto' },
  { key: 'conge', label: 'Congés', unit: 'jours', defaultCode: 'ABSCP', source: 'absence' },
  { key: 'maladie', label: 'Arrêt maladie', unit: 'jours', defaultCode: 'ABSMAL', source: 'absence' },
  { key: 'accident_travail', label: 'Accident du travail', unit: 'jours', defaultCode: 'ABSAT', source: 'absence' },
  { key: 'absence_injustifiee', label: 'Absence non justifiée', unit: 'jours', defaultCode: 'ABSNJ', source: 'absence' },
  { key: 'absence_autorisee', label: 'Absence autorisée', unit: 'jours', defaultCode: 'ABSAUT', source: 'absence' },
  { key: 'formation', label: 'Formation', unit: 'jours', defaultCode: 'FORM', source: 'absence' },
  { key: 'situation_autre', label: 'Autre situation', unit: 'jours', defaultCode: 'ABSAUT2', source: 'absence' },
  { key: 'retard', label: 'Retards', unit: 'nombre', defaultCode: 'RETARD', source: 'absence' },
  { key: 'prime', label: 'Prime', unit: 'euros', defaultCode: 'PRIME', source: 'manuel' },
  { key: 'acompte', label: 'Acompte', unit: 'euros', defaultCode: 'ACOMPTE', source: 'manuel' },
  { key: 'hs25', label: 'Heures supplémentaires à 25 %', unit: 'heures', defaultCode: 'HS25', source: 'manuel' },
  { key: 'hs50', label: 'Heures supplémentaires à 50 %', unit: 'heures', defaultCode: 'HS50', source: 'manuel' },
  { key: 'panier', label: 'Indemnités repas', unit: 'nombre', defaultCode: 'PANIER', source: 'manuel' },
  { key: 'autre', label: 'Autre élément', unit: 'valeur', defaultCode: 'AUTRE', source: 'manuel' },
] as const satisfies readonly { key: string; label: string; unit: PayrollUnit; defaultCode: string; source: 'auto' | 'absence' | 'manuel' }[];

export type PayrollVariable = (typeof PAYROLL_VARIABLES)[number]['key'];

export const MANUAL_VARIABLES = PAYROLL_VARIABLES.filter((v) => v.source === 'manuel');
export const ABSENCE_VARIABLES = PAYROLL_VARIABLES.filter((v) => v.source === 'absence');

export function isPayrollVariable(value: string): value is PayrollVariable {
  return PAYROLL_VARIABLES.some((v) => v.key === value);
}

export function variableInfo(key: PayrollVariable) {
  return PAYROLL_VARIABLES.find((v) => v.key === key)!;
}

export type PayrollCodes = Record<PayrollVariable, string>;

export function defaultCodes(): PayrollCodes {
  return Object.fromEntries(PAYROLL_VARIABLES.map((v) => [v.key, v.defaultCode])) as PayrollCodes;
}

// ---------- Périodes ----------

export function isPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function periodBounds(period: string): { start: string; end: string } {
  const start = `${period}-01`;
  const [y, m] = period.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, end: addDays(next, -1) };
}

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function daysOf(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

// ---------- Calcul par salarié ----------

/** Un créneau du planning, vu par la paie. `minutes` = durée réellement travaillée si le créneau est réalisé. */
export type PayrollShift = { day: string; route_name: string | null; status: string; minutes: number };

export type PayrollInput = {
  employeeId: number;
  payrollId: string | null;
  lastName: string;
  firstName: string;
  shifts: PayrollShift[];
  absences: { type: string; start_on: string; end_on: string; note: string | null }[];
  items: { variable: string; value: number; note: string | null }[];
  km: number;
};

export type AbsencePeriod = { type: string; start: string; end: string; days: number };

export type PayrollLine = {
  employeeId: number;
  payrollId: string | null;
  lastName: string;
  firstName: string;
  /** Jours distincts où le salarié a été présent (au moins un créneau réalisé). */
  workedDays: number;
  /** Tournées réalisées : un créneau réalisé avec une tournée compte pour une tournée. */
  routes: number;
  /** Heures réellement travaillées (heures réelles, sinon heures prévues confirmées par un responsable). */
  hours: number;
  /** Jours passés où un créneau reste prévu ou en cours : présence à confirmer, non comptée. */
  unconfirmedDays: string[];
  absenceDays: Record<string, number>;
  lateCount: number;
  absencePeriods: AbsencePeriod[];
  manual: Partial<Record<PayrollVariable, number>>;
  manualNotes: string[];
  km: number;
};

/**
 * Règles :
 * - journée travaillée = jour où le salarié a au moins un créneau réalisé (présence réelle :
 *   état de fin de journée fait, ou présence confirmée par un responsable) ;
 * - tournée = créneau réalisé rattaché à une tournée ; deux tournées le même jour font 1 jour et 2 tournées ;
 * - un jour sans tournée (formation, dépôt) compte comme jour travaillé mais pas comme tournée ;
 * - les créneaux non confirmés des jours passés ne comptent pas : ils sont listés à part ;
 * - les absences sont comptées en jours calendaires, bornées au mois, avec leurs dates ;
 * - chaque jour couvert par un « retard » compte pour un retard.
 */
export function computePayrollLine(input: PayrollInput, period: string, until: string): PayrollLine {
  const { start, end } = periodBounds(period);
  const inMonth = (d: string) => d >= start && d <= end;

  const absenceDaysByType: Record<string, Set<string>> = {};
  const absencePeriods: AbsencePeriod[] = [];
  for (const a of input.absences) {
    const from = a.start_on > start ? a.start_on : start;
    const to = a.end_on < end ? a.end_on : end;
    if (from > to) continue;
    const days = daysOf(from, to);
    const set = (absenceDaysByType[a.type] ??= new Set());
    days.forEach((d) => set.add(d));
    absencePeriods.push({ type: a.type, start: from, end: to, days: days.length });
  }

  const done = input.shifts.filter((s) => inMonth(s.day) && s.status === 'realise');
  const workedDays = new Set(done.map((s) => s.day));
  const routes = new Set(done.filter((s) => s.route_name).map((s) => `${s.day}|${s.route_name!.toLowerCase()}`));
  const minutes = done.reduce((sum, s) => sum + s.minutes, 0);
  const unconfirmed = new Set(input.shifts.filter((s) => inMonth(s.day) && s.day <= until && s.status !== 'realise').map((s) => s.day));

  const manual: Partial<Record<PayrollVariable, number>> = {};
  const manualNotes: string[] = [];
  for (const item of input.items) {
    if (!isPayrollVariable(item.variable)) continue;
    manual[item.variable] = round2((manual[item.variable] ?? 0) + item.value);
    if (item.note) manualNotes.push(`${variableInfo(item.variable).label} : ${item.note}`);
  }

  const absenceDays: Record<string, number> = {};
  for (const [type, set] of Object.entries(absenceDaysByType)) if (type !== 'retard') absenceDays[type] = set.size;

  return {
    employeeId: input.employeeId,
    payrollId: input.payrollId,
    lastName: input.lastName,
    firstName: input.firstName,
    workedDays: workedDays.size,
    routes: routes.size,
    hours: round2(minutes / 60),
    unconfirmedDays: [...unconfirmed].sort(),
    absenceDays,
    lateCount: absenceDaysByType.retard?.size ?? 0,
    absencePeriods: absencePeriods.sort((a, b) => a.start.localeCompare(b.start)),
    manual,
    manualNotes,
    km: input.km,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Nombre au format français, sans séparateur de milliers (les logiciels de paie le lisent mieux). */
export function frNumber(n: number, decimals = 2): string {
  return Number.isInteger(n) && decimals === 2 ? String(n) : n.toFixed(decimals).replace('.', ',');
}

function frAmount(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

// ---------- Fichiers ----------

/** Récapitulatif pour le cabinet : une ligne par salarié. */
export function recapCsv(lines: PayrollLine[], period: string): string {
  const absenceLabels = ABSENCE_VARIABLES.filter((v) => v.key !== 'retard');
  const header = [
    'Matricule',
    'Nom',
    'Prénom',
    'Période',
    'Jours travaillés',
    'Tournées',
    'Heures travaillées',
    ...absenceLabels.map((v) => `${v.label} (jours)`),
    'Retards',
    ...MANUAL_VARIABLES.map((v) => `${v.label}${v.unit === 'euros' ? ' (€)' : v.unit === 'heures' ? ' (h)' : ''}`),
    'Km parcourus',
    'Détail des absences',
    'Présences à confirmer',
    'Observations',
  ];
  const rows = lines.map((l) => [
    l.payrollId ?? '',
    l.lastName,
    l.firstName,
    period,
    l.workedDays,
    l.routes,
    frNumber(l.hours),
    ...absenceLabels.map((v) => l.absenceDays[v.key] ?? 0),
    l.lateCount,
    ...MANUAL_VARIABLES.map((v) => (l.manual[v.key] === undefined ? '' : v.unit === 'euros' ? frAmount(l.manual[v.key]!) : frNumber(l.manual[v.key]!))),
    l.km,
    l.absencePeriods.map((p) => `${labelFor(p.type)} du ${formatDate(p.start)} au ${formatDate(p.end)}`).join(' ; '),
    l.unconfirmedDays.map(formatDate).join(' ; '),
    l.manualNotes.join(' ; '),
  ]);
  return toCsv(header, rows);
}

function labelFor(type: string): string {
  return PAYROLL_VARIABLES.find((v) => v.key === type)?.label ?? type;
}

/**
 * Fichier d'import pour le logiciel de paie : une ligne par rubrique et par salarié,
 * absences datées ligne par ligne. Les codes rubriques sont ceux paramétrés par le client.
 */
export function payrollImportCsv(lines: PayrollLine[], period: string, codes: PayrollCodes): { csv: string; rows: number } {
  const { start, end } = periodBounds(period);
  const header = ['Matricule', 'Nom', 'Prénom', 'Code rubrique', 'Libellé', 'Valeur', 'Date début', 'Date fin'];
  const rows: (string | number)[][] = [];
  const push = (l: PayrollLine, key: PayrollVariable, value: string, from = start, to = end) =>
    rows.push([l.payrollId ?? '', l.lastName, l.firstName, codes[key], variableInfo(key).label, value, formatDate(from), formatDate(to)]);

  for (const l of lines) {
    if (l.workedDays > 0) push(l, 'jours_travailles', String(l.workedDays));
    if (l.routes > 0) push(l, 'tournees', String(l.routes));
    if (l.hours > 0) push(l, 'heures_travaillees', frNumber(l.hours));
    for (const p of l.absencePeriods) {
      if (p.type === 'retard' || !isPayrollVariable(p.type)) continue;
      push(l, p.type, String(p.days), p.start, p.end);
    }
    if (l.lateCount > 0) push(l, 'retard', String(l.lateCount));
    for (const v of MANUAL_VARIABLES) {
      const value = l.manual[v.key];
      if (value === undefined || value === 0) continue;
      push(l, v.key, v.unit === 'euros' ? frAmount(value) : frNumber(value));
    }
  }
  return { csv: toCsv(header, rows), rows: rows.length };
}

// ---------- Journal de paie importé ----------

export type PayrollCost = { grossCents: number; netCents: number | null; employerCostCents: number };

export function sumCosts(entries: PayrollCost[]): { gross: number; net: number; employer: number } {
  return entries.reduce(
    (acc, e) => ({ gross: acc.gross + e.grossCents, net: acc.net + (e.netCents ?? 0), employer: acc.employer + e.employerCostCents }),
    { gross: 0, net: 0, employer: 0 },
  );
}
