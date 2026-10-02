import type { Metadata } from 'next';
import Link from 'next/link';
import { FineUrgencyBadge } from '@/components/badges';
import { ExportLink } from '@/components/ExportLink';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listFines } from '@/lib/data/cases';
import { fullName, getEmployee } from '@/lib/data/employees';
import { driverAt } from '@/lib/data/operations';
import { formatDate, formatDateTime, parisDate } from '@/lib/domain/dates';
import { DESIGNATION_DELAY_DAYS, designationDeadline, fineUrgency } from '@/lib/domain/fines';
import { FINE_STATUSES, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';

export const metadata: Metadata = { title: 'Amendes' };

export default async function FinesPage() {
  const ctx = await requireModule('amendes');
  const db = getDb();
  const today = parisDate();
  const fines = listFines(db, ctx.orgId);
  const open = fines.filter((f) => f.status === 'a_designer');
  const nameOf = new Map<number, string>();

  return (
    <>
      <PageHeader
        title="Amendes et désignations"
        subtitle={`Vous avez ${DESIGNATION_DELAY_DAYS} jours après l’envoi de l’avis pour désigner le conducteur. Passé ce délai, la société reçoit une nouvelle amende, bien plus lourde.`}
        actions={
          <>
            <ExportLink type="amendes" />
            {can(ctx.roles, 'amende.modifier') && (
              <Link href="/amendes/nouveau" className="btn btn-yellow">
                Enregistrer un avis
              </Link>
            )}
          </>
        }
      />

      <section className="card table-wrap" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="section-title">À désigner</h2>
          <span className="small muted">
            {open.length} avis en attente
          </span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Infraction</th>
              <th>Conducteur probable</th>
              <th>Date limite</th>
              <th>Délai</th>
            </tr>
          </thead>
          <tbody>
            {open.map((f) => {
              const u = fineUrgency(f.notice_sent_on, today);
              const match = driverAt(db, ctx.orgId, f.vehicle_id, f.offense_at);
              let probable = <span className="badge badge-red">Aucune affectation trouvée</span>;
              if (match.kind === 'unique') {
                if (!nameOf.has(match.assignment.employeeId)) {
                  const employee = getEmployee(db, ctx.orgId, match.assignment.employeeId);
                  nameOf.set(match.assignment.employeeId, employee ? fullName(employee) : '');
                }
                probable = <strong>{nameOf.get(match.assignment.employeeId)}</strong>;
              } else if (match.kind === 'ambigu') {
                probable = <span className="badge badge-yellow">Plusieurs conducteurs possibles</span>;
              }
              return (
                <tr key={f.id}>
                  <td>
                    <Link className="row-link mono" href={`/amendes/${f.id}`}>
                      {f.plate}
                    </Link>
                  </td>
                  <td>
                    <span className="small mono">{formatDateTime(f.offense_at)}</span>
                    <div className="small muted">{[f.description, f.location].filter(Boolean).join(', ')}</div>
                  </td>
                  <td>{probable}</td>
                  <td className="mono small">{formatDate(designationDeadline(f.notice_sent_on))}</td>
                  <td>
                    <FineUrgencyBadge urgency={u.urgency} daysLeft={u.daysLeft} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {open.length === 0 && <p className="empty">Aucun avis en attente de désignation.</p>}
      </section>

      <section className="card table-wrap">
        <div className="card-head">
          <h2 className="section-title">Historique</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Infraction</th>
              <th>Statut</th>
              <th>Conducteur désigné</th>
            </tr>
          </thead>
          <tbody>
            {fines
              .filter((f) => f.status !== 'a_designer')
              .map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link className="row-link mono" href={`/amendes/${f.id}`}>
                      {f.plate}
                    </Link>
                  </td>
                  <td className="small mono">{formatDateTime(f.offense_at)}</td>
                  <td>
                    <span className="badge">{labelOf(FINE_STATUSES, f.status)}</span>
                  </td>
                  <td>
                    {f.employee_name ?? ''}
                    {f.designated_on && <span className="small muted"> le {formatDate(f.designated_on)}</span>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
