import type { Metadata } from 'next';
import Link from 'next/link';
import { AuditList } from '@/components/AuditList';
import { ExportLink } from '@/components/ExportLink';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { countAudit, listAudit } from '@/lib/data/audit';

export const metadata: Metadata = { title: 'Journal' };

/** Le journal affiche les 1 000 derniers événements, 100 par page. Les plus anciens restent en base et dans l'export. */
const SHOWN = 1000;
const PER_PAGE = 100;

const TOPICS = [
  { value: '', label: 'Tout' },
  { value: 'vehicle', label: 'Véhicules' },
  { value: 'employee', label: 'Personnel' },
  { value: 'shift', label: 'Planning' },
  { value: 'damage', label: 'Dommages' },
  { value: 'fine', label: 'Amendes' },
  { value: 'payroll', label: 'Paie' },
  { value: 'user', label: 'Membres' },
  { value: 'import', label: 'Imports' },
] as const;

const nf = new Intl.NumberFormat('fr-FR');

export default async function JournalPage(props: PageProps<'/journal'>) {
  const ctx = await requireModule('journal');
  const params = await props.searchParams;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 80) : '';
  const topic = TOPICS.find((t) => t.value && t.value === params.sujet)?.value ?? '';
  const filter = { q: q || undefined, entityType: topic || undefined };
  const db = getDb();
  const total = countAudit(db, ctx.orgId, filter);
  const available = Math.min(total, SHOWN);
  const pages = Math.max(1, Math.ceil(available / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const rows = listAudit(db, ctx.orgId, { ...filter, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const href = (p: number) => `/journal?${new URLSearchParams({ ...(q ? { q } : {}), ...(topic ? { sujet: topic } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  const from = (page - 1) * PER_PAGE + 1;
  const to = from + rows.length - 1;

  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="Qui a fait quoi, et quand. Chaque modification est enregistrée avec l’ancienne et la nouvelle valeur ; rien ne peut être effacé."
        actions={<ExportLink type="journal" />}
      />

      <form className="toolbar" role="search">
        <label htmlFor="q" className="visually-hidden">
          Rechercher
        </label>
        <input id="q" name="q" className="input" style={{ maxWidth: 320 }} defaultValue={q} placeholder="Immatriculation, nom, action…" />
        <label htmlFor="sujet" className="visually-hidden">
          Sujet
        </label>
        <select id="sujet" name="sujet" className="input" style={{ maxWidth: 200 }} defaultValue={topic}>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          Filtrer
        </button>
        {(q || topic) && (
          <Link href="/journal" className="btn btn-ghost">
            Tout afficher
          </Link>
        )}
      </form>

      <AuditList
        title={total === 0 ? 'Aucun événement' : `Événements ${nf.format(from)} à ${nf.format(to)}, du plus récent au plus ancien`}
        rows={rows}
        empty={q || topic ? 'Aucun événement ne correspond à ce filtre.' : 'Rien n’a encore été enregistré.'}
      />

      {total > 0 && (
        <nav className="pager" aria-label="Pages du journal">
          {page > 1 ? (
            <Link className="btn btn-ghost btn-sm" href={href(page - 1)}>
              Plus récents
            </Link>
          ) : (
            <span />
          )}
          <span className="small muted">
            Page {page} sur {pages}
            {total > SHOWN ? ` · les ${nf.format(SHOWN)} derniers sur ${nf.format(total)} événements enregistrés (les plus anciens restent dans l’export)` : ` · ${nf.format(total)} événement${total > 1 ? 's' : ''}`}
          </span>
          {page < pages ? (
            <Link className="btn btn-ghost btn-sm" href={href(page + 1)}>
              Plus anciens
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
