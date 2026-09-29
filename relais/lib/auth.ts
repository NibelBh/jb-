import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb, get, run } from './db';
import { hashToken, newSessionToken, verifyPassword } from './domain/password';
import { type Action, type Module, type Role, can, canAccess, isManager, parseRoles } from './domain/roles';

export const SESSION_COOKIE = 'relais_session';
const MANAGER_SESSION_HOURS = 12;
const DRIVER_SESSION_DAYS = 30;

export type Ctx = {
  userId: number;
  orgId: number;
  orgName: string;
  name: string;
  roles: Role[];
  employeeId: number | null;
  origin: 'web' | 'mobile';
};

type SessionRow = {
  user_id: number;
  org_id: number;
  org_name: string;
  name: string;
  roles: string;
  employee_id: number | null;
  expires_at: string;
};

/** Lecture de la session, une seule fois par requête. */
export const getSession = cache(async (): Promise<Ctx | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = get<SessionRow>(
    getDb(),
    `SELECT s.user_id, s.org_id, o.name AS org_name, u.name, u.roles, u.employee_id, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.active = 1
       JOIN organizations o ON o.id = s.org_id
       LEFT JOIN employees e ON e.id = u.employee_id
      WHERE s.token_hash = ? AND (e.id IS NULL OR e.status != 'sorti')`,
    hashToken(token),
  );
  if (!row || row.expires_at < new Date().toISOString()) return null;
  const roles = parseRoles(row.roles);
  return {
    userId: row.user_id,
    orgId: row.org_id,
    orgName: row.org_name,
    name: row.name,
    roles,
    employeeId: row.employee_id,
    origin: isManager(roles) ? 'web' : 'mobile',
  };
});

export function homeFor(ctx: Pick<Ctx, 'roles'>): string {
  if (!isManager(ctx.roles)) return '/chauffeur';
  if (canAccess(ctx.roles, 'aujourdhui')) return '/aujourdhui';
  if (canAccess(ctx.roles, 'vehicules')) return '/vehicules';
  return '/chauffeur';
}

/** Page du back-office : exige une session et l'accès au module. */
export async function requireModule(module: Module): Promise<Ctx> {
  const ctx = await getSession();
  if (!ctx) redirect('/connexion');
  if (!canAccess(ctx.roles, module)) redirect(homeFor(ctx));
  return ctx;
}

/** Application chauffeur : exige un utilisateur lié à une fiche salarié. */
export async function requireDriver(): Promise<Ctx & { employeeId: number }> {
  const ctx = await getSession();
  if (!ctx) redirect('/connexion');
  if (ctx.employeeId === null) redirect(homeFor(ctx));
  return { ...ctx, employeeId: ctx.employeeId, origin: 'mobile' };
}

export class ForbiddenError extends Error {
  override name = 'ForbiddenError';
}

/** Server Action : vérifie la session et le droit d'effectuer l'action. */
export async function requireAction(action: Action): Promise<Ctx> {
  const ctx = await getSession();
  if (!ctx) redirect('/connexion');
  if (!can(ctx.roles, action)) throw new ForbiddenError('Action non autorisée pour votre rôle.');
  return ctx;
}

// Limitation simple des essais de connexion, par identifiant, en mémoire.
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

export type LoginResult = { ok: true; home: string } | { ok: false; error: string };

export async function login(loginId: string, password: string): Promise<LoginResult> {
  const key = loginId.trim().toLowerCase();
  const now = Date.now();
  const state = attempts.get(key);
  if (state && state.count >= MAX_ATTEMPTS && state.until > now) {
    return { ok: false, error: 'Trop d’essais. Réessayez dans quelques minutes.' };
  }

  const db = getDb();
  const user = get<{ id: number; org_id: number; password_hash: string; roles: string; status: string | null }>(
    db,
    `SELECT u.id, u.org_id, u.password_hash, u.roles, e.status
       FROM users u LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.login = ? AND u.active = 1`,
    key,
  );
  if (!user || user.status === 'sorti' || !verifyPassword(password, user.password_hash)) {
    const next = state && state.until > now ? state.count + 1 : 1;
    attempts.set(key, { count: next, until: now + LOCK_MS });
    return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  }
  attempts.delete(key);

  const roles = parseRoles(user.roles);
  const manager = isManager(roles);
  const ttl = manager ? MANAGER_SESSION_HOURS * 3600_000 : DRIVER_SESSION_DAYS * 86_400_000;
  const token = newSessionToken();
  const expires = new Date(now + ttl);
  run(db, `DELETE FROM sessions WHERE expires_at < ?`, new Date(now).toISOString());
  run(db, `INSERT INTO sessions (token_hash, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)`, hashToken(token), user.id, user.org_id, expires.toISOString());
  run(db, `UPDATE users SET last_login_at = ? WHERE id = ?`, new Date(now).toISOString(), user.id);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // RELAIS_COOKIE_SECURE=0 : essai sur le PC, ouvert depuis un téléphone du même Wi-Fi en http.
    secure: process.env.NODE_ENV === 'production' && process.env.RELAIS_COOKIE_SECURE !== '0',
    path: '/',
    expires,
  });
  return { ok: true, home: homeFor({ roles }) };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) run(getDb(), `DELETE FROM sessions WHERE token_hash = ?`, hashToken(token));
  store.delete(SESSION_COOKIE);
}

/** Révoque toutes les sessions d'un utilisateur (départ du salarié, changement de mot de passe). */
export function revokeSessions(userId: number): void {
  run(getDb(), `DELETE FROM sessions WHERE user_id = ?`, userId);
}
