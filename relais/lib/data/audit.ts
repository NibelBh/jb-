import 'server-only';
import type { Ctx } from '../auth';
import { type Db, all, get, run } from '../db';

export type Change = { field: string; label: string; before: unknown; after: unknown };

export function logAudit(
  db: Db,
  ctx: Pick<Ctx, 'orgId' | 'userId' | 'name' | 'origin'>,
  entry: { action: string; entityType: string; entityId: number | null; summary: string; changes?: Change[] },
): void {
  run(
    db,
    `INSERT INTO audit_log (org_id, user_id, actor, action, entity_type, entity_id, summary, changes, origin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ctx.orgId,
    ctx.userId,
    ctx.name,
    entry.action,
    entry.entityType,
    entry.entityId,
    entry.summary,
    entry.changes && entry.changes.length > 0 ? JSON.stringify(entry.changes) : null,
    ctx.origin,
  );
}

/** Compare deux objets champ par champ et ne garde que ce qui a changé. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  labels: Partial<Record<keyof T, string>>,
): Change[] {
  const changes: Change[] = [];
  for (const key of Object.keys(after) as (keyof T)[]) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    if (a !== b) changes.push({ field: String(key), label: labels[key] ?? String(key), before: a, after: b });
  }
  return changes;
}

export type AuditRow = {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string;
  changes: string | null;
  origin: string;
  created_at: string;
};

export type AuditFilter = { entityType?: string; entityId?: number; limit?: number; offset?: number; q?: string; action?: string };

function auditWhere(orgId: number, filter: AuditFilter): { sql: string; params: (string | number)[] } {
  const where = ['org_id = ?'];
  const params: (string | number)[] = [orgId];
  if (filter.entityType) {
    where.push('entity_type = ?');
    params.push(filter.entityType);
  }
  if (filter.entityId !== undefined) {
    where.push('entity_id = ?');
    params.push(filter.entityId);
  }
  if (filter.action) {
    where.push('action = ?');
    params.push(filter.action);
  }
  if (filter.q) {
    where.push('(summary LIKE ? OR actor LIKE ?)');
    params.push(`%${filter.q}%`, `%${filter.q}%`);
  }
  return { sql: where.join(' AND '), params };
}

/** Événements du plus récent au plus ancien. Rien n'est jamais effacé : la limite ne concerne que l'affichage. */
export function listAudit(db: Db, orgId: number, filter: AuditFilter = {}): AuditRow[] {
  const { sql, params } = auditWhere(orgId, filter);
  return all<AuditRow>(db, `SELECT * FROM audit_log WHERE ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`, ...params, filter.limit ?? 200, filter.offset ?? 0);
}

export function countAudit(db: Db, orgId: number, filter: AuditFilter = {}): number {
  const { sql, params } = auditWhere(orgId, filter);
  return get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM audit_log WHERE ${sql}`, ...params)?.n ?? 0;
}
