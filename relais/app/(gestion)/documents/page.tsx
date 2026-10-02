import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpiryBadge } from '@/components/badges';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { FilterTabs } from '@/components/FilterTabs';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listDeadlines, listDocuments } from '@/lib/data/documents';
import { formatDate, parisDate } from '@/lib/domain/dates';
import { can } from '@/lib/domain/roles';

export const metadata: Metadata = { title: 'Documents et échéances' };

const FILTERS = [
  { value: 'urgent', label: 'Expirés et sous 30 jours' },
  { value: '90', label: 'Sous 90 jours' },
  { value: 'sans_date', label: 'Sans date' },
  { value: 'tout', label: 'Tout' },
] as const;

export default async function DocumentsPage(props: PageProps<'/documents'>) {
  const ctx = await requireModule('documents');
  const params = await props.searchParams;
  const filter = FILTERS.find((f) => f.value === params.filtre)?.value ?? 'urgent';
  const db = getDb();
  const today = parisDate();
  const all = listDeadlines(db, ctx.orgId, today).filter((d) => (d.entity === 'employee' ? can(ctx.roles, 'personnel.voir_documents') : true));
  const rows = all.filter((d) => {
    if (filter === 'urgent') return ['expire', 'j7', 'j15', 'j30'].includes(d.status.level);
    if (filter === '90') return ['expire', 'j7', 'j15', 'j30', 'j90'].includes(d.status.level);
    if (filter === 'sans_date') return d.status.level === 'sans_date';
    return true;
  });
  const expired = all.filter((d) => d.status.level === 'expire').length;

  return (
    <>
      <PageHeader
        title="Documents et échéances"
        subtitle={`${expired ? `${expired} échéance${expired > 1 ? 's' : ''} dépassée${expired > 1 ? 's' : ''}. ` : ''}Vous êtes prévenu 90, 30, 15 et 7 jours avant chaque échéance. Pour modifier un document, ouvrez la fiche du véhicule ou du salarié concerné.`}
      />
      <FilterTabs
        label="Filtrer les échéances"
        items={FILTERS.map((f) => ({ href: `/documents?filtre=${f.value}`, label: f.label, active: f.value === filter }))}
      />
      <section className="card table-wrap" style={{ marginBottom: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Concerne</th>
              <th>Échéance</th>
              <th>Date</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.key}>
                <td>
                  <Link href={d.href} className="row-link">
                    {d.entityLabel}
                  </Link>
                  <div className="small muted">{d.entity === 'vehicle' ? 'Véhicule' : d.entity === 'employee' ? 'Salarié' : 'Entreprise'}</div>
                </td>
                <td>
                  {d.label}
                  {d.computed && <span className="small muted"> (calculée)</span>}
                </td>
                <td className="mono small">{formatDate(d.expiresOn)}</td>
                <td>
                  <ExpiryBadge status={d.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">Rien à signaler dans cette catégorie.</p>}
      </section>
      <DocumentsPanel
        entity="organization"
        entityId={ctx.orgId}
        documents={listDocuments(db, ctx.orgId, 'organization', ctx.orgId)}
        today={today}
        editable={can(ctx.roles, 'document.modifier')}
        title={`Documents de l’entreprise (${ctx.orgName})`}
      />
    </>
  );
}
