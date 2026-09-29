/*
 * CSV : lecture tolérante (séparateur ; ou , détecté, guillemets, BOM Excel)
 * et écriture compatible Excel en français (séparateur ;, BOM UTF-8).
 */

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, '');
  const firstLine = input.split(/\r?\n/, 1)[0] ?? '';
  const separator = count(firstLine, ';') >= count(firstLine, ',') ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === separator) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''));
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? '' : String(value);
    // Empêche Excel d'interpréter une cellule comme une formule.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header, ...rows].map((r) => r.map(escape).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Normalise un en-tête : minuscules, sans accents ni espaces. */
export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Décode un fichier CSV. Excel sous Windows enregistre souvent en Windows-1252
 * (« CSV (séparateur : point-virgule) ») : si le fichier n'est pas de l'UTF-8 valide,
 * on le relit dans cet encodage pour garder les accents.
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
