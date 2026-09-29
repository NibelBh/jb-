import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportForm } from '@/components/ImportForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { IMPORT_KINDS, type ImportKind } from '@/lib/data/imports';
import { can, canAccess } from '@/lib/domain/roles';
import { importAction } from './actions';

export const metadata: Metadata = { title: 'Imports CSV' };

const ORDER: ImportKind[] = ['personnel', 'vehicules', 'documents', 'absences'];

export default async function ImportsPage() {
  const ctx = await requireModule('imports');
  const kinds = ORDER.filter((k) => can(ctx.roles, IMPORT_KINDS[k].action));

  return (
    <>
      <PageHeader
        title="Imports CSV"
        subtitle="Reprenez vos fichiers Excel existants plutôt que de tout ressaisir. Chaque import se vérifie d’abord : le rapport indique ce qui sera créé, mis à jour ou refusé, ligne par ligne, avant tout enregistrement."
      />

      <p className="alert" style={{ marginBottom: 16 }}>
        Ordre conseillé pour démarrer : personnel, puis véhicules, puis documents et échéances, puis absences. Les colonnes marquées d’un astérisque sont obligatoires ; les autres peuvent rester vides ou absentes.
      </p>

      <div className="grid-2">
        {kinds.map((kind) => {
          const k = IMPORT_KINDS[kind];
          return (
            <section key={kind} className="card">
              <div className="card-head">
                <h2 className="section-title">{k.label}</h2>
              </div>
              <div className="card-body stack">
                <p className="small">{k.help}</p>
                <p className="small">
                  <strong>Colonnes :</strong>{' '}
                  {k.columns.map((c, i) => (
                    <span key={c}>
                      {i > 0 && ', '}
                      <code style={{ fontWeight: c.endsWith('*') ? 800 : 400 }}>{c}</code>
                    </span>
                  ))}
                </p>
                <ImportForm action={importAction} templateHref={`/api/modeles/${kind}`}>
                  <input type="hidden" name="kind" value={kind} />
                </ImportForm>
              </div>
            </section>
          );
        })}

        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Autres imports</h2>
          </div>
          <div className="card-body stack-sm small">
            {canAccess(ctx.roles, 'planning') && (
              <p>
                <strong>Tournées du jour</strong> (fichier du donneur d’ordre) : depuis le <Link href="/planning">planning</Link>, bloc « Ajouter des tournées ».
              </p>
            )}
            {canAccess(ctx.roles, 'paie') && (
              <p>
                <strong>Journal de paie</strong> (brut, net, coût employeur) : depuis la page <Link href="/paie">Paie</Link>.
              </p>
            )}
            <p className="muted">Chaque import est tracé dans le journal d’audit, avec son auteur et son résultat.</p>
          </div>
        </section>
      </div>
    </>
  );
}
