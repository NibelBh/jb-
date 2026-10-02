import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportForm } from '@/components/ImportForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { IMPORT_KINDS, type ImportKind, importColumns } from '@/lib/data/imports';
import { can, canAccess } from '@/lib/domain/roles';
import { importAction } from './actions';

export const metadata: Metadata = { title: 'Imports CSV' };

const ORDER: ImportKind[] = ['personnel', 'vehicules', 'planning', 'absences', 'documents'];

export default async function ImportsPage(props: PageProps<'/imports'>) {
  const ctx = await requireModule('imports');
  const params = await props.searchParams;
  const kinds = ORDER.filter((k) => can(ctx.roles, IMPORT_KINDS[k].action));
  const kind = kinds.find((k) => k === params.type) ?? kinds[0];

  return (
    <>
      <PageHeader
        title="Imports CSV"
        subtitle="Reprenez vos fichiers Excel au lieu de tout ressaisir. Téléchargez le modèle, remplissez-le, puis vérifiez-le : rien n’est enregistré avant que vous cliquiez sur « Importer »."
      />

      <nav className="tabs" aria-label="Type d’import">
        {kinds.map((k) => (
          <Link key={k} href={`/imports?type=${k}`} className={k === kind ? 'tab tab-on' : 'tab'} aria-current={k === kind ? 'page' : undefined}>
            {IMPORT_KINDS[k].label}
          </Link>
        ))}
      </nav>

      {kind && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <section className="card">
            <div className="card-head">
              <h2>1. Préparer le fichier</h2>
              <a href={`/api/modeles/${kind}`} download className="btn btn-yellow btn-sm">
                Télécharger le modèle CSV
              </a>
            </div>
            <div className="card-body stack">
              <p>{IMPORT_KINDS[kind].help}</p>
              <p className="small muted">
                Le modèle contient les bonnes colonnes et une ligne d’exemple à remplacer. Une colonne marquée * est obligatoire ; les autres peuvent rester vides. Gardez la
                première ligne telle quelle : c’est elle qui permet au logiciel de reconnaître les colonnes.
              </p>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Colonne</th>
                      <th>Format attendu</th>
                      <th>Exemple</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importColumns(kind).map((c) => (
                      <tr key={c.header}>
                        <td className="nowrap">
                          <strong>{c.header}</strong>
                          {c.required && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>obligatoire</span>}
                        </td>
                        <td className="small">{[c.format, c.hint].filter(Boolean).join(' · ') || <span className="muted">Texte libre</span>}</td>
                        <td className="small mono">{c.example || <span className="muted">·</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>2. Vérifier puis importer</h2>
            </div>
            <div className="card-body stack">
              <ImportForm key={kind} action={importAction}>
                <input type="hidden" name="kind" value={kind} />
              </ImportForm>
              <div className="small muted stack-sm">
                <p>La vérification signale, ligne par ligne : les colonnes obligatoires absentes, les colonnes inconnues (ignorées), les valeurs au mauvais format, les doublons et les champs obligatoires vides.</p>
                <p>Ordre conseillé pour démarrer : personnel, véhicules, planning, puis absences et documents.</p>
                {canAccess(ctx.roles, 'paie') && (
                  <p>
                    Le journal de paie (brut, net, coût employeur) s’importe depuis la page <Link href="/paie">Paie</Link>.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
