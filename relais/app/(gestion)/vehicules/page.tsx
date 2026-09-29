import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpiryBadge, VehicleStatusBadge } from '@/components/badges';
import { ExportLink } from '@/components/ExportLink';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listDeadlines } from '@/lib/data/documents';
import { listVehicles } from '@/lib/data/vehicles';
import { parisDate } from '@/lib/domain/dates';
import { needsAttention } from '@/lib/domain/documents';
import { formatKm } from '@/lib/domain/inspection';
import { ENERGIES, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';

export const metadata: Metadata = { title: 'Véhicules' };

export default async function VehiclesPage(props: PageProps<'/vehicules'>) {
  const ctx = await requireModule('vehicules');
  const params = await props.searchParams;
  const all = params.tous === '1';
  const db = getDb();
  const today = parisDate();
  const vehicles = listVehicles(db, ctx.orgId, { includeRetired: all });
  const deadlines = listDeadlines(db, ctx.orgId, today).filter((d) => d.entity === 'vehicle' && needsAttention(d.status));

  return (
    <>
      <PageHeader
        title="Véhicules"
        subtitle={`${vehicles.length} véhicule${vehicles.length > 1 ? 's' : ''}${all ? ', y compris sortis de flotte' : ''}.`}
        actions={
          <>
            <Link href={all ? '/vehicules' : '/vehicules?tous=1'} className="btn btn-ghost">
              {all ? 'Masquer les sortis' : 'Afficher les sortis'}
            </Link>
            <ExportLink type="vehicules" />
            {can(ctx.roles, 'vehicule.modifier') && (
              <Link href="/vehicules/nouveau" className="btn btn-yellow">
                Ajouter un véhicule
              </Link>
            )}
          </>
        }
      />
      <section className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Immatriculation</th>
              <th>Modèle</th>
              <th>Statut</th>
              <th>Chauffeur actuel</th>
              <th className="num">Kilométrage</th>
              <th>Alertes</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const alerts = deadlines.filter((d) => d.entityId === v.id);
              return (
                <tr key={v.id}>
                  <td>
                    <Link href={`/vehicules/${v.id}`} className="row-link mono">
                      {v.plate}
                    </Link>
                  </td>
                  <td>
                    {[v.brand, v.model].filter(Boolean).join(' ')}
                    <div className="small muted">{labelOf(ENERGIES, v.energy)}</div>
                  </td>
                  <td>
                    <VehicleStatusBadge status={v.status} />
                  </td>
                  <td>{v.driver_name ?? <span className="muted">Aucun</span>}</td>
                  <td className="num">{formatKm(v.current_km)}</td>
                  <td>
                    <div className="btn-row" style={{ gap: 4 }}>
                      {alerts.map((a) => (
                        <span key={a.key} title={a.label}>
                          <ExpiryBadge status={a.status} /> <span className="small">{a.label}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {vehicles.length === 0 && <p className="empty">Aucun véhicule. Ajoutez votre flotte pour commencer.</p>}
      </section>
    </>
  );
}
