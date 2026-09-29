/*
 * Lecture tolérante des fichiers importés : les clients viennent d'Excel,
 * avec des dates en JJ/MM/AAAA, des nombres à virgule et des libellés au lieu de codes.
 */
import { normalizeHeader } from './csv';
import { isIsoDate } from './dates';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Accepte AAAA-MM-JJ, JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA et JJ/MM/AA. Une cellule vide donne null. */
export function parseDateCell(raw: string): Parsed<string | null> {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (isIsoDate(value)) return { ok: true, value };
  const m = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (isIsoDate(iso)) return { ok: true, value: iso };
  }
  return { ok: false, error: `date « ${value} » illisible (attendu JJ/MM/AAAA)` };
}

/** Nombre entier, espaces de milliers acceptés (« 125 400 »). */
export function parseIntegerCell(raw: string): Parsed<number | null> {
  const value = raw.replace(/[\s  ]/g, '');
  if (!value) return { ok: true, value: null };
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, error: `nombre entier attendu, « ${raw.trim()} » reçu` };
  return { ok: true, value: n };
}

/** Nombre décimal français (« 7,5 »). */
export function parseDecimalCell(raw: string): Parsed<number | null> {
  const value = raw.replace(/[\s  €]/g, '');
  if (!value) return { ok: true, value: null };
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return { ok: false, error: `nombre attendu, « ${raw.trim()} » reçu` };
  return { ok: true, value: n };
}

/** Montant en euros (« 1 234,56 € », « 1234.56 ») converti en centimes. */
export function parseAmountCell(raw: string): Parsed<number | null> {
  const parsed = parseDecimalCell(raw);
  if (!parsed.ok) return { ok: false, error: `montant illisible « ${raw.trim()} »` };
  return { ok: true, value: parsed.value === null ? null : Math.round(parsed.value * 100) };
}

const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

/** Période de paie : AAAA-MM, MM/AAAA, JJ/MM/AAAA ou « septembre 2026 ». */
export function parsePeriodCell(raw: string): Parsed<string | null> {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  let m = value.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return monthOf(Number(m[1]), Number(m[2]), value);
  m = value.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return monthOf(Number(m[2]), Number(m[1]), value);
  const date = parseDateCell(value);
  if (date.ok && date.value) return { ok: true, value: date.value.slice(0, 7) };
  const words = normalizeHeader(value).split('_');
  const month = MONTHS.indexOf(words[0]);
  if (month >= 0 && /^\d{4}$/.test(words[1] ?? '')) return monthOf(Number(words[1]), month + 1, value);
  return { ok: false, error: `période « ${value} » illisible (attendu MM/AAAA)` };
}

function monthOf(year: number, month: number, raw: string): Parsed<string> {
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return { ok: false, error: `période « ${raw} » invalide` };
  return { ok: true, value: `${year}-${String(month).padStart(2, '0')}` };
}

type Option = { readonly value: string; readonly label: string };

/**
 * Retrouve une valeur de liste à partir du code, du libellé ou d'un synonyme,
 * sans tenir compte des accents, de la casse ni de la ponctuation.
 */
export function matchOption(options: readonly Option[], raw: string, synonyms: Record<string, string> = {}): string | null {
  const key = normalizeHeader(raw);
  if (!key) return null;
  for (const o of options) {
    if (normalizeHeader(o.value) === key || normalizeHeader(o.label) === key) return o.value;
  }
  return synonyms[key] ?? null;
}

/** Associe chaque champ attendu à la colonne du fichier, à partir de plusieurs noms possibles. */
export function mapColumns<F extends string>(header: string[], aliases: Record<F, string[]>): Record<F, number> {
  const normalized = header.map(normalizeHeader);
  const result = {} as Record<F, number>;
  for (const field of Object.keys(aliases) as F[]) {
    result[field] = normalized.findIndex((h) => aliases[field].includes(h));
  }
  return result;
}

export function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? '').trim() : '';
}

export type ImportReport = {
  committed: boolean;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export function emptyReport(committed: boolean): ImportReport {
  return { committed, rows: 0, created: 0, updated: 0, skipped: 0, errors: [] };
}

export function reportSummary(r: ImportReport): string {
  const parts = [`${r.rows} ligne${r.rows > 1 ? 's' : ''} lue${r.rows > 1 ? 's' : ''}`, `${r.created} création${r.created > 1 ? 's' : ''}`, `${r.updated} mise${r.updated > 1 ? 's' : ''} à jour`];
  if (r.skipped) parts.push(`${r.skipped} ignorée${r.skipped > 1 ? 's' : ''}`);
  parts.push(`${r.errors.length} anomalie${r.errors.length > 1 ? 's' : ''}`);
  return r.committed ? `Import terminé : ${parts.join(', ')}.` : `Vérification : ${parts.join(', ')}. Rien n’a encore été enregistré.`;
}
