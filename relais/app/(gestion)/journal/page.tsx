import type { Metadata } from 'next';
import { AuditList } from '@/components/AuditList';
import { ExportLink } from '@/components/ExportLink';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listAudit } from '@/lib/data/audit';

export const metadata: Metadata = { title: 'Journal' };

export default async function JournalPage(props: PageProps<'/journal'>) {
  const ctx = await requireModule('journal');
  const params = await props.searchParams;
  const q = typeof params.q === 'string' ? params.q.slice(0, 80) : '';
  const rows = listAudit(getDb(), ctx.orgId, { q: q || undefined, limit: 300 });

  return (
    <>
      <PageHeader
        title="Journal d’audit"
        subtitle="Chaque modification importante est enregistrée avec son auteur, sa date et l’ancienne valeur. Le journal ne peut être ni modifié ni effacé."
        actions={
          <ExportLink type="journal" />
        }
      />
      <form className="btn-row" style={{ marginBottom: 16 }} role="search">
        <label htmlFor="q" className="visually-hidden">
          Rechercher
        </label>
        <input id="q" name="q" className="input" style={{ maxWidth: 360 }} defaultValue={q} placeholder="Immatriculation, nom, action…" />
        <button type="submit" className="btn">
          Rechercher
        </button>
      </form>
      <AuditList title={q ? `Résultats pour « ${q} »` : '300 derniers événements'} rows={rows} />
    </>
  );
}
