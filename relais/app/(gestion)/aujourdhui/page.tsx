import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpiryBadge, FineUrgencyBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { dashboard } from '@/lib/data/dashboard';
import { formatDate, formatTime, parisDate } from '@/lib/domain/dates';
import { formatKm } from '@/lib/domain/inspection';
import { formatRange } from '@/lib/domain/shifts';
import { ABSENCE_TYPES, labelOf } from '@/lib/domain/labels';
import { canAccess } from '@/lib/domain/roles';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Aujourd’hui' };

function euros(cents: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function TodayPage() {
  const ctx = await requireModule('aujourdhui');
  const today = parisDate();
  const d = dashboard(getDb(), ctx.orgId, today);
  const canFleet = canAccess(ctx.roles, 'vehicules');
  const canFines = canAccess(ctx.roles, 'amendes');
  const canDamages = canAccess(ctx.roles, 'dommages');
  const urgentDeadlines = d.deadlines.filter((x) => x.status.level !== 'sans_date');

  return (
    <>
      <PageHeader
        title="Aujourd’hui"
        subtitle="Ce qui demande votre attention aujourd’hui. Cliquez sur un chiffre pour voir le détail."
        actions={
          canAccess(ctx.roles, 'planning') && (
            <Link href={`/planning?jour=${today}`} className="btn btn-yellow">
              Ouvrir le planning du jour
            </Link>
          )
        }
      />

      <section className={styles.kpis} aria-label="Indicateurs du jour">
        <Kpi
          href={`/planning?jour=${today}&filtre=tournees`}
          show={canAccess(ctx.roles, 'planning')}
          label="Tournées couvertes"
          value={`${d.routes.covered} / ${d.routes.total}`}
          note={d.routes.total - d.routes.covered > 0 ? `${d.routes.total - d.routes.covered} à régler` : 'Toutes en ordre'}
          alert={d.routes.covered < d.routes.total}
        />
        <Kpi
          href={`/planning?jour=${today}#disponibilites`}
          show={canAccess(ctx.roles, 'planning')}
          label="Salariés planifiés"
          value={d.people.planned}
          note={`${d.people.onShift} en service, ${d.people.done} terminé${d.people.done > 1 ? 's' : ''}, ${d.people.absent} absent${d.people.absent > 1 ? 's' : ''}`}
          alert={d.people.absent > 0}
        />
        <Kpi
          href="/vehicules?statut=en_tournee"
          show={canFleet}
          label="Véhicules en tournée"
          value={d.vehicles.en_tournee}
          note={`${d.vehicles.disponible} disponible${d.vehicles.disponible > 1 ? 's' : ''} au dépôt`}
        />
        <Kpi
          href="/vehicules?statut=indisponibles"
          show={canFleet}
          label="Véhicules bloqués ou immobilisés"
          value={d.vehicles.bloque + d.vehicles.immobilise}
          alert={d.vehicles.bloque > 0}
        />
        <Kpi href="/amendes" show={canFines} label="Amendes à désigner" value={d.fines.length} alert={d.fines.some((f) => f.urgency === 'critique' || f.urgency === 'depasse')} />
        <Kpi
          href="/documents?filtre=urgent"
          show={canAccess(ctx.roles, 'documents')}
          label="Échéances sous 30 jours"
          value={urgentDeadlines.length}
          alert={urgentDeadlines.some((x) => x.status.level === 'expire')}
        />
      </section>

      <div className={styles.grid}>
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">À traiter</h2>
          </div>
          <div className="card-body stack-sm">
            {d.blockedInspections.map((i) => (
              <Item key={`i${i.id}`} tone="red" href={`/vehicules/${i.vehicle_id}`} title={`${i.plate} bloqué à l’inspection`} detail={`${i.employee_name}, ${formatTime(i.created_at)}. Décision attendue.`} />
            ))}
            {d.board.toReplace.map((r) => (
              <Item
                key={`r${r.id}`}
                tone="yellow"
                href={`/planning/remplacement?creneau=${r.id}`}
                title={`${r.route_name ? `Tournée ${r.route_name}` : 'Créneau'} ${formatRange(r.start_time, r.end_time)} à couvrir`}
                detail={r.employee_id ? `${r.employee_name} : ${r.issues.join(', ').toLowerCase()}.` : `Personne n’est affecté à cette tournée${r.notes ? ` (${r.notes.replace(/\.$/, '')})` : ''}.`}
                cta="Remplacer"
              />
            ))}
            {d.board.shifts
              .filter((r) => !d.board.toReplace.includes(r) && r.issues.length > 0)
              .map((r) => (
                <Item
                  key={`v${r.id}`}
                  tone={r.blocking ? 'red' : 'yellow'}
                  href={`/planning?jour=${today}`}
                  title={`${r.employee_name ?? 'Sans salarié'} · ${r.route_name ? `tournée ${r.route_name}` : formatRange(r.start_time, r.end_time)}`}
                  detail={r.issues.join(', ')}
                />
              ))}
            {d.blockedInspections.length === 0 && d.board.shifts.every((r) => r.issues.length === 0) && (
              <div className="empty-state">
                <strong>Tout est en ordre</strong>
                <p>Chaque tournée du jour a un salarié disponible et un véhicule en règle.</p>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Équipe du jour</h2>
            <span className="small muted">{d.onDuty} véhicule{d.onDuty > 1 ? 's' : ''} sorti{d.onDuty > 1 ? 's' : ''}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Salarié</th>
                  <th>Statut</th>
                  <th>Horaires et tournées</th>
                  <th>Véhicule</th>
                </tr>
              </thead>
              <tbody>
                {d.board.people.map((p) => (
                  <tr key={p.employee_id}>
                    <td className="nowrap">
                      <Link href={`/personnel/${p.employee_id}`} className="row-link">
                        {p.name}
                      </Link>
                    </td>
                    <td>
                      {p.absence_type ? (
                        <span className="badge badge-red">{labelOf(ABSENCE_TYPES, p.absence_type)}</span>
                      ) : p.unavailable ? (
                        <span className="badge badge-red">Indisponible</span>
                      ) : p.shifts.some((s) => s.status === 'en_cours') ? (
                        <span className="badge badge-black">En service</span>
                      ) : p.shifts.length > 0 && p.shifts.every((s) => s.status === 'realise') ? (
                        <span className="badge">Journée terminée</span>
                      ) : p.shifts.length > 0 ? (
                        <span className="badge badge-yellow">Prévu</span>
                      ) : (
                        <span className="badge badge-soft">Non planifié</span>
                      )}
                      {p.late && <span className="badge badge-yellow">Retard</span>}
                    </td>
                    <td className="small">{p.shifts.map((s) => `${formatRange(s.start_time, s.end_time)}${s.route_name ? ` ${s.route_name}` : ''}`).join(' ; ')}</td>
                    <td className="mono">{p.on_duty_plate ?? p.shifts.find((s) => s.plate)?.plate ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {canFines && (
          <section className="card">
            <div className="card-head">
              <h2 className="section-title">Amendes à désigner</h2>
              <Link href="/amendes" className="small">
                Tout voir
              </Link>
            </div>
            <div className="card-body stack-sm">
              {d.fines.length === 0 && <p className="empty">Aucun avis en attente.</p>}
              {d.fines.slice(0, 5).map((f) => (
                <Link key={f.id} href={`/amendes/${f.id}`} className={styles.line}>
                  <span>
                    <strong className="mono">{f.plate}</strong> <span className="muted small">avis du {formatDate(f.notice_sent_on)}</span>
                  </span>
                  <FineUrgencyBadge urgency={f.urgency} daysLeft={f.daysLeft} />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Échéances</h2>
            <Link href="/documents" className="small">
              Tout voir
            </Link>
          </div>
          <div className="card-body stack-sm">
            {urgentDeadlines.length === 0 && <p className="empty">Aucune échéance dans les 30 jours.</p>}
            {urgentDeadlines.slice(0, 7).map((x) => (
              <Link key={x.key} href={x.href} className={styles.line}>
                <span>
                  <strong>{x.entityLabel}</strong> <span className="muted small">{x.label}</span>
                </span>
                <ExpiryBadge status={x.status} />
              </Link>
            ))}
          </div>
        </section>

        {(canDamages || canFleet) && (
          <section className="card">
            <div className="card-head">
              <h2 className="section-title">Flotte, 30 derniers jours</h2>
            </div>
            <div className="card-body">
              <dl className="kv">
                <dt>Kilomètres parcourus</dt>
                <dd className="mono">{formatKm(d.km30)}</dd>
                <dt>Dommages déclarés</dt>
                <dd>{d.damages.last30}</dd>
                <dt>Dossiers ouverts</dt>
                <dd>
                  {canDamages ? <Link href="/dommages">{d.damages.open}</Link> : d.damages.open}
                  {d.damages.openCostCents > 0 && <span className="muted small"> (coût estimé {euros(d.damages.openCostCents)})</span>}
                </dd>
                <dt>Sinistralité</dt>
                <dd>{d.km30 > 0 ? `${((d.damages.last30 / d.km30) * 10000).toFixed(1).replace('.', ',')} dommage(s) pour 10 000 km` : 'Pas encore de données'}</dd>
              </dl>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/** Indicateur cliquable : il ouvre la page correspondante, déjà filtrée. */
function Kpi({ label, value, note, alert, href, show = true }: { label: string; value: string | number; note?: string; alert?: boolean; href: string; show?: boolean }) {
  const body = (
    <>
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
      {note && <span className={styles.kpiNote}>{note}</span>}
    </>
  );
  const className = `${styles.kpi} ${alert ? styles.kpiAlert : ''}`;
  if (!show) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={`${className} ${styles.kpiLink}`}>
      {body}
      <span className={styles.kpiGo} aria-hidden="true">
        Voir →
      </span>
    </Link>
  );
}

function Item({ tone, href, title, detail, cta }: { tone: 'red' | 'yellow'; href: string; title: string; detail: string; cta?: string }) {
  return (
    <div className={`${styles.item} ${tone === 'red' ? styles.itemRed : styles.itemYellow}`}>
      <div>
        <strong>{title}</strong>
        <p className="small muted">{detail}</p>
      </div>
      <Link href={href} className="btn btn-sm">
        {cta ?? 'Voir'}
      </Link>
    </div>
  );
}
