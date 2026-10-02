import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpiryBadge } from '@/components/badges';
import { ExportLink } from '@/components/ExportLink';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { currentSituation, listEmployees } from '@/lib/data/employees';
import { listVehicles } from '@/lib/data/vehicles';
import { formatDate, parisDate } from '@/lib/domain/dates';
import { expiryStatus } from '@/lib/domain/documents';
import { DRIVING_POSITIONS, POSITIONS, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';

export const metadata: Metadata = { title: 'Personnel' };

export default async function StaffPage(props: PageProps<'/personnel'>) {
  const ctx = await requireModule('personnel');
  const params = await props.searchParams;
  const all = params.tous === '1';
  const db = getDb();
  const today = parisDate();
  const employees = listEmployees(db, ctx.orgId, { includeLeft: all });
  const fleet = listVehicles(db, ctx.orgId, { includeRetired: true });
  const onDuty = new Map(fleet.filter((v) => v.driver_id).map((v) => [v.driver_id as number, v.plate]));
  const plates = new Map(fleet.map((v) => [v.id, v.plate]));
  const editable = can(ctx.roles, 'personnel.modifier');

  return (
    <>
      <PageHeader
        title="Personnel"
        subtitle={`${employees.length} salarié${employees.length > 1 ? 's' : ''}${all ? ', anciens salariés compris' : ''}. La situation du jour tient compte des congés, arrêts et formations.`}
        actions={
          <>
            <Link href={all ? '/personnel' : '/personnel?tous=1'} className="btn btn-ghost">
              {all ? 'Masquer les anciens salariés' : 'Afficher les anciens salariés'}
            </Link>
            <ExportLink type="personnel" />
            {can(ctx.roles, 'personnel.modifier') && (
              <Link href="/personnel/nouveau" className="btn btn-yellow">
                Ajouter un salarié
              </Link>
            )}
          </>
        }
      />
      <section className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Salarié</th>
              <th>Matricule</th>
              <th>Aujourd’hui</th>
              <th>Permis</th>
              <th>Véhicule attribué</th>
              <th>Téléphone</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/personnel/${e.id}`} className="row-link">
                    {e.last_name.toUpperCase()} {e.first_name}
                  </Link>
                  <div className="small muted">
                    {labelOf(POSITIONS, e.position)}
                    {e.status === 'periode_essai' ? ', période d’essai' : ''}
                  </div>
                </td>
                <td className="mono small">{e.payroll_id ?? ''}</td>
                <td>
                  {(() => {
                    const sit = currentSituation(db, ctx.orgId, e, today);
                    return (
                      <span className={`badge ${sit.tone === 'off' ? 'badge-red' : sit.tone === 'warn' ? 'badge-yellow' : 'badge-ok'}`}>
                        {sit.label}
                        {sit.until ? ` jusqu’au ${formatDate(sit.until)}` : ''}
                      </span>
                    );
                  })()}
                </td>
                <td>{DRIVING_POSITIONS.includes(e.position) ? <ExpiryBadge status={expiryStatus(e.licence_expires_on, today)} /> : <span className="muted small">·</span>}</td>
                <td className="nowrap">
                  {e.vehicle_id ? <Link href={`/vehicules/${e.vehicle_id}`}>{plates.get(e.vehicle_id)}</Link> : <span className="muted small">·</span>}
                  {onDuty.get(e.id) && <div className="small muted">En tournée avec {onDuty.get(e.id)}</div>}
                </td>
                <td className="nowrap">{e.phone ? <a href={`tel:${e.phone.replace(/\s/g, '')}`}>{e.phone}</a> : ''}</td>
                {editable && (
                  <td>
                    <Link href={`/personnel/${e.id}/modifier`} className="link-action">
                      Modifier
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
