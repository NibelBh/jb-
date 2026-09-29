import type { Metadata } from 'next';
import Link from 'next/link';
import { DamageStatusBadge, SeverityBadge } from '@/components/badges';
import { ExportLink } from '@/components/ExportLink';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listDamages } from '@/lib/data/cases';
import { formatDateTime } from '@/lib/domain/dates';
import { DAMAGE_TYPES, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { zonesLabel } from '@/lib/domain/zones';

export const metadata: Metadata = { title: 'Dommages' };

function euros(cents: number | null) {
  if (cents === null) return '';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export default async function DamagesPage(props: PageProps<'/dommages'>) {
  const ctx = await requireModule('dommages');
  const params = await props.searchParams;
  const all = params.tous === '1';
  const damages = listDamages(getDb(), ctx.orgId, { open: !all });

  return (
    <>
      <PageHeader
        title="Dommages et sinistres"
        subtitle={all ? 'Tous les dossiers.' : 'Dossiers ouverts.'}
        actions={
          <>
            <Link href={all ? '/dommages' : '/dommages?tous=1'} className="btn btn-ghost">
              {all ? 'Dossiers ouverts' : 'Tous les dossiers'}
            </Link>
            <ExportLink type="dommages" />
            {can(ctx.roles, 'dommage.modifier') && (
              <Link href="/dommages/nouveau" className="btn btn-yellow">
                Ouvrir un dossier
              </Link>
            )}
          </>
        }
      />
      <section className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Véhicule</th>
              <th>Type</th>
              <th>Gravité</th>
              <th>Déclaré par</th>
              <th>Survenu le</th>
              <th>Statut</th>
              <th className="num">Coût</th>
            </tr>
          </thead>
          <tbody>
            {damages.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/dommages/${d.id}`} className="row-link">
                    {d.id}
                  </Link>
                </td>
                <td className="mono">{d.plate}</td>
                <td>
                  <Link href={`/dommages/${d.id}`} className="row-link">
                    {labelOf(DAMAGE_TYPES, d.type)}
                  </Link>
                  {d.injured === 1 && <span className="badge badge-red" style={{ marginLeft: 6 }}>Blessé</span>}
                  {d.zones && <div className="small muted">{zonesLabel(d.zones)}</div>}
                </td>
                <td>
                  <SeverityBadge severity={d.severity} />
                </td>
                <td>{d.employee_name ?? ''}</td>
                <td className="small mono">{formatDateTime(d.occurred_at)}</td>
                <td>
                  <DamageStatusBadge status={d.status} />
                </td>
                <td className="num">{euros(d.final_cost_cents ?? d.estimated_cost_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {damages.length === 0 && <p className="empty">Aucun dossier {all ? '' : 'ouvert'}.</p>}
      </section>
    </>
  );
}
