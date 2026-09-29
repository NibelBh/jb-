import 'server-only';
import type { Ctx } from '../auth';
import { type Db, all, get, run } from '../db';
import type { Role } from '../domain/roles';

/*
 * Notifications internes. Les canaux push et e-mail se brancheront ici :
 * un seul point d'entrée pour tous les événements du produit.
 */
export function notify(
  db: Db,
  orgId: number,
  n: { roles?: Role[]; userId?: number; kind: string; title: string; body?: string; link?: string },
): void {
  run(
    db,
    `INSERT INTO notifications (org_id, target_roles, user_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    orgId,
    n.roles ? n.roles.join(',') : null,
    n.userId ?? null,
    n.kind,
    n.title,
    n.body ?? null,
    n.link ?? null,
  );
}

export type NotificationRow = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read: number;
};

function visibility(ctx: Pick<Ctx, 'roles'>): { sql: string; params: string[] } {
  const roleClauses = ctx.roles.map(() => `(',' || n.target_roles || ',') LIKE ?`);
  return {
    sql: `(n.user_id = ? OR (n.user_id IS NULL AND n.target_roles IS NOT NULL AND (${roleClauses.join(' OR ') || '0'})))`,
    params: ctx.roles.map((r) => `%,${r},%`),
  };
}

export function listNotifications(db: Db, ctx: Pick<Ctx, 'orgId' | 'userId' | 'roles'>, limit = 50): NotificationRow[] {
  const v = visibility(ctx);
  return all<NotificationRow>(
    db,
    `SELECT n.id, n.kind, n.title, n.body, n.link, n.created_at,
            EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = ?) AS read
       FROM notifications n
      WHERE n.org_id = ? AND ${v.sql}
      ORDER BY n.id DESC LIMIT ?`,
    ctx.userId,
    ctx.orgId,
    ctx.userId,
    ...v.params,
    limit,
  );
}

export function unreadCount(db: Db, ctx: Pick<Ctx, 'orgId' | 'userId' | 'roles'>): number {
  const v = visibility(ctx);
  const row = get<{ n: number }>(
    db,
    `SELECT COUNT(*) AS n FROM notifications n
      WHERE n.org_id = ? AND ${v.sql}
        AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = ?)`,
    ctx.orgId,
    ctx.userId,
    ...v.params,
    ctx.userId,
  );
  return row?.n ?? 0;
}

export function markAllRead(db: Db, ctx: Pick<Ctx, 'orgId' | 'userId' | 'roles'>): void {
  for (const n of listNotifications(db, ctx, 500)) {
    if (!n.read) run(db, `INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)`, n.id, ctx.userId);
  }
}
