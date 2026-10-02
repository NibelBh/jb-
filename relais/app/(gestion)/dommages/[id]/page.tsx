import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { DamageStatusBadge, SeverityBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { VehicleSvg } from '@/components/VehicleMap';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { damageEvents, getDamage } from '@/lib/data/cases';
import { openImmobilization } from '@/lib/data/vehicles';
import { formatDateTime } from '@/lib/domain/dates';
import { DAMAGE_STATUSES, DAMAGE_TYPES, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { parseZones, zonesLabel } from '@/lib/domain/zones';
import { addDamagePhotosAction, attachToDamageAction, changeDamageStatusAction, removeDamagePhotoAction, setDamageCostsAction } from '../actions';

export const metadata: Metadata = { title: 'Dossier dommage' };

function eurosInput(cents: number | null) {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

export default async function DamagePage(props: PageProps<'/dommages/[id]'>) {
  const ctx = await requireModule('dommages');
  const damageId = Number((await props.params).id);
  const params = await props.searchParams;
  const db = getDb();
  const damage = Number.isInteger(damageId) ? getDamage(db, ctx.orgId, damageId) : undefined;
  if (!damage) notFound();
  const events = damageEvents(db, ctx.orgId, damage.id);
  const photos = JSON.parse(damage.photos) as number[];
  const editable = can(ctx.roles, 'dommage.modifier');
  const immobilization = openImmobilization(db, ctx.orgId, damage.vehicle_id);

  return (
    <>
      <PageHeader
        title={`Dossier n° ${damage.id} · ${labelOf(DAMAGE_TYPES, damage.type)}`}
        subtitle={
          <>
            <Link href={`/vehicules/${damage.vehicle_id}`} className="mono">
              {damage.plate}
            </Link>{' '}
            · <DamageStatusBadge status={damage.status} /> <SeverityBadge severity={damage.severity} />
          </>
        }
        back={{ href: '/dommages', label: 'Dommages' }}
        actions={
          editable && (
            <Link href={`/dommages/${damage.id}/modifier`} className="btn btn-ghost">
              Modifier le dossier
            </Link>
          )
        }
      />
      {params.enregistre === '1' && (
        <p className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>
          Modifications enregistrées.
        </p>
      )}

      {damage.injured === 1 && (
        <p className="alert alert-error" style={{ marginBottom: 16 }}>
          Une personne a été blessée. Si c’est un salarié, l’employeur doit déclarer l’accident du travail à la CPAM dans les 48 heures (hors dimanches et jours fériés) après en avoir été informé.
        </p>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Déclaration</h2>
          </div>
          <div className="card-body stack">
            <dl className="kv">
              <dt>Date du constat</dt>
              <dd>{formatDateTime(damage.occurred_at)}</dd>
              <dt>Conducteur</dt>
              <dd>{damage.employee_id ? <Link href={`/personnel/${damage.employee_id}`}>{damage.employee_name}</Link> : 'Non renseigné'}</dd>
              <dt>Déclaré par</dt>
              <dd>{damage.reporter_name ?? 'Non renseigné'}</dd>
              <dt>Zones touchées</dt>
              <dd>{zonesLabel(damage.zones) || 'Non localisé'}</dd>
              <dt>Lieu</dt>
              <dd>
                {damage.location_text ||
                  (damage.latitude !== null && damage.longitude !== null ? (
                    <a href={`https://www.openstreetmap.org/?mlat=${damage.latitude}&mlon=${damage.longitude}#map=17/${damage.latitude}/${damage.longitude}`} target="_blank" rel="noreferrer">
                      Voir sur la carte
                    </a>
                  ) : (
                    'Non renseigné'
                  ))}
              </dd>
              <dt>Véhicule immobilisé</dt>
              <dd>{immobilization ? `Oui, depuis le ${immobilization.started_on.split('-').reverse().join('/')}` : 'Non'}</dd>
            </dl>
            {damage.zones && (
              <div style={{ maxWidth: 200 }}>
                <VehicleSvg selected={parseZones(damage.zones)} label={`Zones touchées : ${zonesLabel(damage.zones)}`} />
              </div>
            )}
            <p style={{ whiteSpace: 'pre-wrap' }}>{damage.description}</p>
            {photos.length > 0 ? (
              <div className="photos">
                {photos.map((fileId) => (
                  <figure key={fileId} className="photo-card">
                    <a href={`/api/fichiers/${fileId}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/fichiers/${fileId}`} alt="Photo du dommage" loading="lazy" />
                    </a>
                    {editable && (
                      <figcaption>
                        <details className="disclosure small">
                          <summary>Remplacer</summary>
                          <ActionForm action={addDamagePhotosAction} submitLabel="Remplacer" submitClassName="btn btn-sm" resetOnSuccess>
                            <input type="hidden" name="damageId" value={damage.id} />
                            <input type="hidden" name="replaceId" value={fileId} />
                            <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" className="input" required aria-label="Nouvelle photo" />
                          </ActionForm>
                        </details>
                        <ActionForm action={removeDamagePhotoAction} submitLabel="Retirer" submitClassName="btn btn-ghost btn-sm" className="btn-row" confirmMessage="Retirer cette photo du dossier ?">
                          <input type="hidden" name="damageId" value={damage.id} />
                          <input type="hidden" name="fileId" value={fileId} />
                        </ActionForm>
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            ) : (
              <p className="muted small">Aucune photo pour l’instant.</p>
            )}
            {editable && (
              <details className="disclosure">
                <summary>Ajouter des photos</summary>
                <ActionForm action={addDamagePhotosAction} submitLabel="Ajouter" resetOnSuccess>
                  <input type="hidden" name="damageId" value={damage.id} />
                  <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="input" required aria-label="Photos" />
                </ActionForm>
              </details>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Suivi</h2>
          </div>
          <div className="card-body stack">
            {editable && (
              <ActionForm action={changeDamageStatusAction} submitLabel="Mettre à jour" resetOnSuccess>
                <input type="hidden" name="damageId" value={damage.id} />
                <div className="field">
                  <label htmlFor="status">Statut</label>
                  <select id="status" name="status" className="input" defaultValue={damage.status}>
                    {DAMAGE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="text">Commentaire</label>
                  <textarea id="text" name="text" className="input" placeholder="Ex. devis reçu, rendez-vous garage jeudi 9 h" />
                </div>
              </ActionForm>
            )}
            {editable && !immobilization && damage.status !== 'cloture' && (
              <p className="small">
                Le véhicule doit rester au dépôt ? <Link href={`/vehicules/${damage.vehicle_id}`}>Immobilisez-le depuis sa fiche</Link>.
              </p>
            )}
            {editable && (
              <details className="disclosure">
                <summary>Coûts</summary>
                <ActionForm action={setDamageCostsAction} submitLabel="Enregistrer les coûts">
                  <input type="hidden" name="damageId" value={damage.id} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="estimated">Coût estimé (€ HT)</label>
                      <input id="estimated" name="estimated" className="input" inputMode="decimal" defaultValue={eurosInput(damage.estimated_cost_cents)} />
                    </div>
                    <div className="field">
                      <label htmlFor="final">Coût final (€ HT)</label>
                      <input id="final" name="final" className="input" inputMode="decimal" defaultValue={eurosInput(damage.final_cost_cents)} />
                    </div>
                  </div>
                  <p className="small muted">
                    Rappel : un employeur ne peut pas retenir le coût d’un dommage sur le salaire à titre de sanction (sanctions pécuniaires interdites). Faites valider toute refacturation par votre conseil.
                  </p>
                </ActionForm>
              </details>
            )}
            {editable && (
              <details className="disclosure">
                <summary>Joindre un document (devis, facture, constat)</summary>
                <ActionForm action={attachToDamageAction} submitLabel="Joindre" resetOnSuccess>
                  <input type="hidden" name="damageId" value={damage.id} />
                  <div className="field">
                    <label htmlFor="file">Fichier</label>
                    <input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="input" required />
                  </div>
                  <div className="field">
                    <label htmlFor="ftext">Description</label>
                    <input id="ftext" name="text" className="input" placeholder="Ex. devis carrosserie" />
                  </div>
                </ActionForm>
              </details>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="section-title">Historique du dossier</h2>
        </div>
        <div className="card-body">
          <ol className="timeline">
            {events.map((e) => (
              <li key={e.id}>
                <div>
                  {e.kind === 'statut' && e.to_status && (
                    <strong>
                      {e.from_status ? `${labelOf(DAMAGE_STATUSES, e.from_status)} → ` : ''}
                      {labelOf(DAMAGE_STATUSES, e.to_status)}
                    </strong>
                  )}
                  {e.kind === 'piece' && e.file_id && (
                    <a href={`/api/fichiers/${e.file_id}`} target="_blank" rel="noreferrer">
                      Pièce jointe : {e.file_name}
                    </a>
                  )}
                  {e.text && <div>{e.text}</div>}
                </div>
                <div className="small muted">
                  {formatDateTime(e.created_at)} · {e.author}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
