import 'server-only';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { type Db, get, openDatabase } from './core';
import { seedDemo } from './seed';

export { all, get, run, transaction } from './core';
export type { Db, Param } from './core';

export const DATA_DIR = process.env.RELAIS_DATA_DIR ?? path.join(process.cwd(), 'data');

const globalForDb = globalThis as unknown as { relaisDb?: Db };

/** Une seule connexion par processus (le rechargement à chaud de Next ne doit pas en ouvrir d'autres). */
export function getDb(): Db {
  if (!globalForDb.relaisDb) {
    mkdirSync(DATA_DIR, { recursive: true });
    const db = openDatabase(path.join(DATA_DIR, 'relais.db'));
    const count = get<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM organizations');
    if (count?.n === 0 && process.env.RELAIS_DEMO !== '0') seedDemo(db);
    globalForDb.relaisDb = db;
  }
  return globalForDb.relaisDb;
}
