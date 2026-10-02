import type { AuditRow, Change } from '@/lib/data/audit';
import { formatDateTime } from '@/lib/domain/dates';
import { DAMAGE_STATUSES, FINE_STATUSES, VEHICLE_STATUSES } from '@/lib/domain/labels';

const STATUS_LABELS = [...VEHICLE_STATUSES, ...DAMAGE_STATUSES, ...FINE_STATUSES];

function show(value: unknown, field: string): string {
  if (value === null || value === undefined || value === '') return '(vide)';
  if (field === 'status') return STATUS_LABELS.find((s) => s.value === value)?.label ?? String(value);
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  return String(value);
}

export function AuditList({ rows, title = 'Historique', empty = 'Aucune modification enregistrée pour l’instant.' }: { rows: AuditRow[]; title?: string; empty?: string }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
      </div>
      <div className="card-body">
        {rows.length === 0 ? (
          <p className="muted">{empty}</p>
        ) : (
          <ol className="timeline">
            {rows.map((r) => {
              const changes = r.changes ? (JSON.parse(r.changes) as Change[]).filter((c) => c.field !== 'assignment' && c.field !== 'document' && c.field !== 'absence') : [];
              return (
                <li key={r.id}>
                  <div>{r.summary}</div>
                  <div className="small muted">
                    {formatDateTime(r.created_at)} · {r.actor} · {r.origin === 'mobile' ? 'depuis l’application chauffeur' : r.origin === 'systeme' ? 'automatique' : 'depuis le bureau'}
                  </div>
                  {changes.length > 0 && (
                    <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                      {changes.map((c) => (
                        <li key={c.field}>
                          {c.label} : {show(c.before, c.field)} → {show(c.after, c.field)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
