import 'server-only';
import { type Db, all, get } from '../db';
import { addDays, parisLocalToIso } from '../domain/dates';
import { needsAttention } from '../domain/documents';
import { fineUrgency } from '../domain/fines';
import { listDeadlines } from './documents';
import { listFines } from './cases';
import { listInspections } from './operations';
import { dayBoard } from './planning';

export function dashboard(db: Db, orgId: number, today: string) {
  const board = dayBoard(db, orgId, today);
  const vehicleCounts = all<{ status: string; n: number }>(
    db,
    `SELECT status, COUNT(*) AS n FROM vehicles WHERE org_id = ? AND status != 'sorti' GROUP BY status`,
    orgId,
  );
  const byStatus = Object.fromEntries(vehicleCounts.map((v) => [v.status, v.n])) as Record<string, number>;
  const deadlines = listDeadlines(db, orgId, today).filter((d) => needsAttention(d.status) || d.status.level === 'sans_date');
  const fines = listFines(db, orgId, { open: true }).map((f) => ({ ...f, ...fineUrgency(f.notice_sent_on, today) }));
  const openDamages = get<{ n: number; cost: number | null }>(
    db,
    `SELECT COUNT(*) AS n, SUM(COALESCE(final_cost_cents, estimated_cost_cents)) AS cost FROM damages WHERE org_id = ? AND status != 'cloture'`,
    orgId,
  );
  const since = parisLocalToIso(addDays(today, -30), '00:00');
  const km30 = get<{ km: number | null }>(
    db,
    `SELECT SUM(end_km - start_km) AS km FROM assignments WHERE org_id = ? AND end_km IS NOT NULL AND start_km IS NOT NULL AND started_at >= ?`,
    orgId,
    since,
  );
  const damages30 = get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM damages WHERE org_id = ? AND created_at >= ?`, orgId, since);
  const onDuty = get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM assignments WHERE org_id = ? AND ended_at IS NULL`, orgId);

  const planned = board.people.filter((p) => p.shifts.length > 0).length;
  const onShift = board.people.filter((p) => p.shifts.some((s) => s.status === 'en_cours')).length;
  const done = board.people.filter((p) => p.shifts.length > 0 && p.shifts.every((s) => s.status === 'realise')).length;
  const absent = board.people.filter((p) => p.absence_type).length;
  const late = board.people.filter((p) => p.late).length;
  const free = board.people.filter((p) => p.shifts.length === 0 && !p.unavailable).length;
  const routes = board.shifts.filter((s) => s.route_name);

  return {
    board,
    routes: { total: routes.length, covered: routes.filter((r) => !r.blocking).length },
    people: { planned, onShift, done, absent, late, free },
    vehicles: {
      total: vehicleCounts.reduce((s, v) => s + v.n, 0),
      disponible: byStatus.disponible ?? 0,
      en_tournee: byStatus.en_tournee ?? 0,
      bloque: byStatus.bloque ?? 0,
      immobilise: byStatus.immobilise ?? 0,
    },
    onDuty: onDuty?.n ?? 0,
    deadlines,
    fines,
    blockedInspections: listInspections(db, orgId, { status: 'en_attente', limit: 20 }),
    damages: { open: openDamages?.n ?? 0, openCostCents: openDamages?.cost ?? 0, last30: damages30?.n ?? 0 },
    km30: km30?.km ?? 0,
  };
}
