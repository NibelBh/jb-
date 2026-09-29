import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Ctx } from '../auth';
import { DATA_DIR, type Db, get, run } from '../db';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export class UploadError extends Error {
  override name = 'UploadError';
}

function isFile(value: FormDataEntryValue | null): value is File {
  return typeof value === 'object' && value !== null && 'arrayBuffer' in value && value.size > 0;
}

/** Enregistre un fichier envoyé. Retourne null si le champ est vide. */
export async function saveUpload(db: Db, ctx: Pick<Ctx, 'orgId' | 'userId'>, value: FormDataEntryValue | null): Promise<number | null> {
  if (!isFile(value)) return null;
  const ext = ALLOWED[value.type];
  if (!ext) throw new UploadError('Format de fichier non accepté (JPEG, PNG, WebP ou PDF).');
  if (value.size > MAX_FILE_BYTES) throw new UploadError('Fichier trop lourd (8 Mo maximum).');

  const bytes = Buffer.from(await value.arrayBuffer());
  if (!matchesSignature(bytes, value.type)) throw new UploadError('Le contenu du fichier ne correspond pas à son format.');

  const key = `${ctx.orgId}/${randomUUID()}.${ext}`;
  const target = path.join(DATA_DIR, 'uploads', key);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return run(
    db,
    `INSERT INTO files (org_id, storage_key, name, mime, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`,
    ctx.orgId,
    key,
    value.name.slice(0, 200) || `fichier.${ext}`,
    value.type,
    value.size,
    ctx.userId,
  ).id;
}

export async function saveUploads(db: Db, ctx: Pick<Ctx, 'orgId' | 'userId'>, values: FormDataEntryValue[]): Promise<number[]> {
  const ids: number[] = [];
  for (const value of values) {
    const id = await saveUpload(db, ctx, value);
    if (id !== null) ids.push(id);
  }
  return ids;
}

function matchesSignature(bytes: Buffer, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mime === 'image/png') return bytes.subarray(0, 4).toString('hex') === '89504e47';
  if (mime === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (mime === 'application/pdf') return bytes.subarray(0, 4).toString() === '%PDF';
  return false;
}

export type FileRow = { id: number; storage_key: string; name: string; mime: string; size: number };

/** Lecture cloisonnée : un fichier d'une autre organisation est introuvable. */
export function readFile(db: Db, orgId: number, id: number): { row: FileRow; bytes: Buffer } | null {
  const row = get<FileRow>(db, `SELECT id, storage_key, name, mime, size FROM files WHERE id = ? AND org_id = ?`, id, orgId);
  if (!row) return null;
  try {
    return { row, bytes: readFileSync(path.join(DATA_DIR, 'uploads', row.storage_key)) };
  } catch {
    return null;
  }
}

/** Supprime des fichiers envoyés pour une opération finalement refusée. */
export function discardFiles(db: Db, orgId: number, ids: number[]): void {
  for (const fileId of ids) {
    const row = get<{ storage_key: string }>(db, `SELECT storage_key FROM files WHERE id = ? AND org_id = ?`, fileId, orgId);
    if (!row) continue;
    run(db, `DELETE FROM files WHERE id = ? AND org_id = ?`, fileId, orgId);
    rmSync(path.join(DATA_DIR, 'uploads', row.storage_key), { force: true });
  }
}
