import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 32;
const COST = 16384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: COST });
  return `scrypt$${COST}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, cost, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !cost || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(cost) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Seule l'empreinte du jeton est stockée : une fuite de la base ne donne pas de session valide. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Règle minimale : 8 caractères pour un mot de passe, ou un code de 6 chiffres pour un chauffeur. */
export function passwordProblem(password: string, isDriverCode: boolean): string | null {
  if (isDriverCode) return /^\d{6}$/.test(password) ? null : 'Le code chauffeur doit contenir 6 chiffres.';
  return password.length >= 8 ? null : 'Le mot de passe doit contenir au moins 8 caractères.';
}
