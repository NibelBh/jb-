import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpiryBadge, VehicleStatusBadge } from '@/components/badges';
import { ExportLink } from '@/components/ExportLink';
import { FilterTabs } from '@/components/FilterTabs';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listDeadlines } from '@/lib/data/documents';
import { listVehicles } from '@/lib/data/vehicles';
import { formatDate, parisDate } from '@/lib/domain/dates';
import { needsAttention } from '@/lib/domain/documents';
import { formatKm } from '@/lib/domain/inspection';
import { ENERGIES, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { vehicleCompliance } from '@/lib/domain/vehicles';

export const metadata: Metadata = { title: 'Véhicules' };

export default async function VehiclesPage(props: PageProps<'/vehicules'>) {
  const ctx = await requireModule('vehicules');
  const params = await props.searchParams;
  const db = getDb();
  const today = parisDate();
  const fleet = listVehicles(db, ctx.orgId, { includeRetired: true });
  const deadlines = listDeadlines(db, ctx.orgId, today).filter((d) => d.entity === 'vehicle' && needsAttention(d.status));
  const hasAlert = (v: (typeof fleet)[number]) => vehicleCompliance(v, today).blocking.length > 0 || deadlines.some((d) => d.entityId === v.id);
  const FILTERS = [
    { value: 'tous', label: 'En service', test: (v: (typeof fleet)[number]) => v.status !== 'sorti' },
    { value: 'en_tournee', label: 'En tournée', test: (v: (typeof fleet)[number]) => v.status === 'en_tournee' },
    { value: 'disponible', label: 'Disponibles', test: (v: (typeof fleet)[number]) => v.status === 'disponible' },
    { value: 'indisponibles', label: 'Bloqués ou immobilisés', test: (v: (typeof fleet)[number]) => v.status === 'bloque' || v.status === 'immobilise' },
    { value: 'alertes', label: 'Assurance, CT ou document à revoir', test: (v: (typeof fleet)[number]) => v.status !== 'sorti' && hasAlert(v) },
    { value: 'sortis', label: 'Sortis de flotte', test: (v: (typeof fleet)[number]) => v.status === 'sorti' },
  ];
  const current = FILTERS.find((f) => f.value === params.statut) ?? FILTERS[0];
  const vehicles = fleet.filter(current.test);
  const editable = can(ctx.roles, 'vehicule.modifier');

  return (
    <>
      <PageHeader
        title="Véhicules"
        subtitle="Votre flotte, son état du jour et ses échéances administratives."
        actions={
          <>
            <ExportLink type="vehicules" />
            {can(ctx.roles, 'vehicule.modifier') && (
              <Link href="/vehicules/nouveau" className="btn btn-yellow">
                Ajouter un véhicule
              </Link>
            )}
          </>
        }
      />
      <FilterTabs
        label="Filtrer les véhicules"
        items={FILTERS.map((f) => ({ href: f.value === 'tous' ? '/vehicules' : `/vehicules?statut=${f.value}`, label: f.label, count: fleet.filter(f.test).length, active: f === current }))}
      />
      <section className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Immatriculation</th>
              <th>Modèle</th>
              <th>Statut</th>
              <th>Attribué à</th>
              <th className="num">Kilométrage</th>
              <th>Assurance</th>
              <th>Contrôle technique</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const alerts = deadlines.filter((d) => d.entityId === v.id && d.label !== 'Assurance' && d.label !== 'Contrôle technique');
              const c = vehicleCompliance(v, today);
              return (
                <tr key={v.id}>
                  <td className="nowrap">
                    <Link href={`/vehicules/${v.id}`} className="row-link mono">
                      {v.plate}
                    </Link>
                    {alerts.map((a) => (
                      <div key={a.key} className="small" style={{ color: 'var(--red-ink)' }}>
                        {a.label} : {a.status.level === 'expire' ? 'expiré' : `${a.status.daysLeft} j`}
                      </div>
                    ))}
                  </td>
                  <td>
                    {[v.brand, v.model].filter(Boolean).join(' ')}
                    <div className="small muted">{labelOf(ENERGIES, v.energy)}</div>
                  </td>
                  <td className="nowrap">
                    <VehicleStatusBadge status={v.status} />
                    {v.driver_name && <div className="small muted">avec {v.driver_name}</div>}
                  </td>
                  <td>{v.holder_id ? <Link href={`/personnel/${v.holder_id}`}>{v.holder_name}</Link> : <span className="muted">Personne</span>}</td>
                  <td className="num">{formatKm(v.current_km)}</td>
                  <td className="nowrap">
                    <ExpiryBadge status={c.insurance} />
                    {v.insurance_end_on && <div className="small muted">{formatDate(v.insurance_end_on)}</div>}
                  </td>
                  <td className="nowrap">
                    <ExpiryBadge status={c.ct} />
                    {c.ctDue && <div className="small muted">{formatDate(c.ctDue)}</div>}
                  </td>
                  {editable && (
                    <td>
                      <Link href={`/vehicules/${v.id}/modifier`} className="link-action">
                        Modifier
                      </Link>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {vehicles.length === 0 &&
          (fleet.length === 0 ? (
            <div className="empty-state">
              <strong>Aucun véhicule pour l’instant</strong>
              <p>Ajoutez vos véhicules un par un, ou importez votre liste depuis un fichier Excel.</p>
              {editable && (
                <div className="btn-row">
                  <Link href="/vehicules/nouveau" className="btn btn-yellow">
                    Ajouter un véhicule
                  </Link>
                  <Link href="/imports" className="btn btn-ghost">
                    Importer un fichier
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <strong>Aucun véhicule dans cette catégorie</strong>
              <p>
                <Link href="/vehicules">Voir toute la flotte</Link>
              </p>
            </div>
          ))}
      </section>
    </>
  );
}
