import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpiryBadge } from '@/components/badges';
import { ExportLink } from '@/components/ExportLink';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listEmployees } from '@/lib/data/employees';
import { listVehicles } from '@/lib/data/vehicles';
import { parisDate } from '@/lib/domain/dates';
import { expiryStatus } from '@/lib/domain/documents';
import { DRIVING_POSITIONS, EMPLOYEE_STATUSES, POSITIONS, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';

export const metadata: Metadata = { title: 'Personnel' };

export default async function StaffPage(props: PageProps<'/personnel'>) {
  const ctx = await requireModule('personnel');
  const params = await props.searchParams;
  const all = params.tous === '1';
  const db = getDb();
  const today = parisDate();
  const employees = listEmployees(db, ctx.orgId, { includeLeft: all });
  const onDuty = new Map(listVehicles(db, ctx.orgId).filter((v) => v.driver_id).map((v) => [v.driver_id as number, v.plate]));

  return (
    <>
      <PageHeader
        title="Personnel"
        subtitle={`${employees.length} salarié${employees.length > 1 ? 's' : ''}${all ? ', y compris sortis' : ''}.`}
        actions={
          <>
            <Link href={all ? '/personnel' : '/personnel?tous=1'} className="btn btn-ghost">
              {all ? 'Masquer les sortis' : 'Afficher les sortis'}
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
              <th>Nom</th>
              <th>Matricule</th>
              <th>Poste</th>
              <th>Statut</th>
              <th>Permis</th>
              <th>Véhicule en cours</th>
              <th>Téléphone</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/personnel/${e.id}`} className="row-link">
                    {e.last_name.toUpperCase()} {e.first_name}
                  </Link>
                </td>
                <td className="mono small">{e.payroll_id ?? ''}</td>
                <td>{labelOf(POSITIONS, e.position)}</td>
                <td>
                  <span className={`badge ${e.status === 'sorti' ? 'badge-soft' : e.status === 'suspendu' ? 'badge-red' : ''}`}>{labelOf(EMPLOYEE_STATUSES, e.status)}</span>
                </td>
                <td>{DRIVING_POSITIONS.includes(e.position) ? <ExpiryBadge status={expiryStatus(e.licence_expires_on, today)} /> : <span className="muted small">·</span>}</td>
                <td className="mono">{onDuty.get(e.id) ?? ''}</td>
                <td className="nowrap">{e.phone ? <a href={`tel:${e.phone.replace(/\s/g, '')}`}>{e.phone}</a> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
