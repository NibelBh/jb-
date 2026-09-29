import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { AuditList } from '@/components/AuditList';
import { DamageStatusBadge, ExpiryBadge, VehicleStatusBadge } from '@/components/badges';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { InspectionSummary } from '@/components/InspectionSummary';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listAudit } from '@/lib/data/audit';
import { listDamages } from '@/lib/data/cases';
import { listDocuments } from '@/lib/data/documents';
import { listEmployees } from '@/lib/data/employees';
import { listInspections } from '@/lib/data/operations';
import { assignmentHistory, getVehicle, lastTechnicalInspection, listImmobilizations } from '@/lib/data/vehicles';
import { formatDate, formatDateTime, parisDate } from '@/lib/domain/dates';
import { expiryStatus, technicalInspectionDue } from '@/lib/domain/documents';
import { formatKm } from '@/lib/domain/inspection';
import { DAMAGE_TYPES, DRIVING_POSITIONS, ENERGIES, VEHICLE_TYPES, labelOf } from '@/lib/domain/labels';
import { can, canAccess } from '@/lib/domain/roles';
import { correctOdometerAction, recordPastAssignmentAction, reviewInspectionAction, setVehicleStatusAction } from '../actions';

export const metadata: Metadata = { title: 'Véhicule' };

export default async function VehiclePage(props: PageProps<'/vehicules/[id]'>) {
  const ctx = await requireModule('vehicules');
  const vehicleId = Number((await props.params).id);
  const db = getDb();
  const vehicle = Number.isInteger(vehicleId) ? getVehicle(db, ctx.orgId, vehicleId) : undefined;
  if (!vehicle) notFound();

  const today = parisDate();
  const history = assignmentHistory(db, ctx.orgId, { vehicleId: vehicle.id, limit: 25 });
  const current = history.find((a) => a.ended_at === null);
  const inspections = listInspections(db, ctx.orgId, { vehicleId: vehicle.id, limit: 8 });
  const pending = inspections.find((i) => i.status === 'en_attente');
  const damages = canAccess(ctx.roles, 'dommages') ? listDamages(db, ctx.orgId, { vehicleId: vehicle.id }) : [];
  const ctDue = technicalInspectionDue(vehicle.first_registration_on, lastTechnicalInspection(db, ctx.orgId, vehicle.id));
  const immobilizations = listImmobilizations(db, ctx.orgId, vehicle.id);
  const drivers = listEmployees(db, ctx.orgId).filter((e) => DRIVING_POSITIONS.includes(e.position));
  const canEdit = can(ctx.roles, 'vehicule.modifier');
  const canOperate = can(ctx.roles, 'vehicule.debloquer');

  return (
    <>
      <PageHeader
        title={<span className="mono">{vehicle.plate}</span>}
        subtitle={
          <>
            {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ')} · <VehicleStatusBadge status={vehicle.status} />
          </>
        }
        back={{ href: '/vehicules', label: 'Véhicules' }}
        actions={
          canEdit && (
            <Link href={`/vehicules/${vehicle.id}/modifier`} className="btn btn-ghost">
              Modifier la fiche
            </Link>
          )
        }
      />

      {pending && (
        <section className="card" style={{ marginBottom: 16, borderColor: 'var(--red)', borderWidth: 2 }}>
          <div className="stripes" />
          <div className="card-head">
            <h2 className="section-title">Inspection bloquante : décision attendue</h2>
          </div>
          <div className="card-body stack">
            <InspectionSummary inspection={pending} />
            {canOperate && (
              <div className="grid-2">
                <ActionForm action={reviewInspectionAction} submitLabel="Autoriser le départ" submitClassName="btn">
                  <input type="hidden" name="inspectionId" value={pending.id} />
                  <input type="hidden" name="decision" value="autoriser" />
                  <div className="field">
                    <label htmlFor="note-ok">Justification (obligatoire)</label>
                    <input id="note-ok" name="note" className="input" placeholder="Ex. voyant vérifié, niveau complété" />
                  </div>
                </ActionForm>
                <ActionForm action={reviewInspectionAction} submitLabel="Refuser le départ" submitClassName="btn btn-danger">
                  <input type="hidden" name="inspectionId" value={pending.id} />
                  <input type="hidden" name="decision" value="refuser" />
                  <div className="field">
                    <label htmlFor="note-ko">Commentaire</label>
                    <input id="note-ko" name="note" className="input" placeholder="Ex. garage demain matin" />
                  </div>
                </ActionForm>
              </div>
            )}
          </div>
        </section>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Fiche</h2>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Chauffeur actuel</dt>
              <dd>{current ? `${current.employee_name} depuis le ${formatDateTime(current.started_at)}` : 'Aucun'}</dd>
              <dt>Kilométrage</dt>
              <dd className="mono">
                {formatKm(vehicle.current_km)} <span className="muted small">(entrée : {formatKm(vehicle.initial_km)})</span>
              </dd>
              <dt>Type, énergie</dt>
              <dd>
                {labelOf(VEHICLE_TYPES, vehicle.type)}, {labelOf(ENERGIES, vehicle.energy)}
              </dd>
              <dt>VIN</dt>
              <dd className="mono">{vehicle.vin || '·'}</dd>
              <dt>1re immatriculation</dt>
              <dd>{formatDate(vehicle.first_registration_on) || '·'}</dd>
              <dt>Contrôle technique</dt>
              <dd>
                {ctDue ? (
                  <>
                    avant le {formatDate(ctDue)} <ExpiryBadge status={expiryStatus(ctDue, today)} />
                  </>
                ) : (
                  'Renseignez la date de première immatriculation'
                )}
              </dd>
              <dt>Propriétaire ou loueur</dt>
              <dd>{vehicle.owner || '·'}</dd>
              {vehicle.notes && (
                <>
                  <dt>Notes</dt>
                  <dd style={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>{vehicle.notes}</dd>
                </>
              )}
            </dl>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Statut</h2>
            <VehicleStatusBadge status={vehicle.status} />
          </div>
          <div className="card-body stack">
            {canOperate && (vehicle.status === 'bloque' || vehicle.status === 'immobilise') && (
              <ActionForm action={setVehicleStatusAction} submitLabel="Remettre en service" submitClassName="btn btn-yellow">
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <input type="hidden" name="status" value="disponible" />
                <div className="field">
                  <label htmlFor="reason-ok">Commentaire</label>
                  <input id="reason-ok" name="reason" className="input" placeholder="Ex. réparation terminée, facture reçue" />
                </div>
              </ActionForm>
            )}
            {canOperate && vehicle.status !== 'immobilise' && vehicle.status !== 'en_tournee' && vehicle.status !== 'sorti' && (
              <details className="disclosure">
                <summary>Immobiliser le véhicule</summary>
                <ActionForm action={setVehicleStatusAction} submitLabel="Immobiliser" submitClassName="btn">
                  <input type="hidden" name="vehicleId" value={vehicle.id} />
                  <input type="hidden" name="status" value="immobilise" />
                  <div className="field">
                    <label htmlFor="reason-immo">Motif</label>
                    <input id="reason-immo" name="reason" className="input" required placeholder="Ex. attente pièce, contrôle technique" />
                  </div>
                </ActionForm>
              </details>
            )}
            {canEdit && vehicle.status !== 'sorti' && vehicle.status !== 'en_tournee' && (
              <details className="disclosure">
                <summary>Sortir le véhicule de la flotte</summary>
                <ActionForm action={setVehicleStatusAction} submitLabel="Sortir de la flotte" submitClassName="btn btn-danger" confirmMessage={`Sortir ${vehicle.plate} de la flotte ? L’historique est conservé.`}>
                  <input type="hidden" name="vehicleId" value={vehicle.id} />
                  <input type="hidden" name="status" value="sorti" />
                  <div className="field">
                    <label htmlFor="reason-out">Motif</label>
                    <input id="reason-out" name="reason" className="input" placeholder="Ex. fin de location, restitution au loueur" />
                  </div>
                </ActionForm>
              </details>
            )}
            <div>
              <h3 style={{ marginBottom: 8 }}>Immobilisations</h3>
              {immobilizations.length === 0 ? (
                <p className="muted small">Aucune immobilisation.</p>
              ) : (
                <ul className="timeline">
                  {immobilizations.map((im) => (
                    <li key={im.id}>
                      <strong>
                        Du {formatDate(im.started_on)} {im.ended_on ? `au ${formatDate(im.ended_on)}` : '(en cours)'}
                      </strong>
                      <div className="small muted">
                        {im.reason}
                        {im.damage_id && (
                          <>
                            {' · '}
                            <Link href={`/dommages/${im.damage_id}`}>dossier n° {im.damage_id}</Link>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canEdit && (
              <details className="disclosure">
                <summary>Corriger le kilométrage</summary>
                <ActionForm action={correctOdometerAction} submitLabel="Corriger">
                  <input type="hidden" name="vehicleId" value={vehicle.id} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="km">Kilométrage réel</label>
                      <input id="km" name="km" type="number" min={0} className="input" defaultValue={vehicle.current_km} required />
                    </div>
                    <div className="field">
                      <label htmlFor="km-reason">Motif</label>
                      <input id="km-reason" name="reason" className="input" required placeholder="Ex. erreur de saisie du chauffeur" />
                    </div>
                  </div>
                </ActionForm>
              </details>
            )}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="section-title">Qui conduisait, et quand</h2>
          <span className="small muted">Sert à désigner le conducteur sur un avis de contravention</span>
        </div>
        {history.length === 0 ? (
          <p className="empty">Aucune affectation enregistrée.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Chauffeur</th>
                  <th>Début</th>
                  <th>Fin</th>
                  <th className="num">Km</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link className="row-link" href={`/personnel/${a.employee_id}`}>
                        {a.employee_name}
                      </Link>
                    </td>
                    <td className="mono small">{formatDateTime(a.started_at)}</td>
                    <td className="mono small">{a.ended_at ? formatDateTime(a.ended_at) : <span className="badge badge-black">En cours</span>}</td>
                    <td className="num">{a.start_km !== null && a.end_km !== null ? a.end_km - a.start_km : ''}</td>
                    <td className="small muted">{a.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canOperate && (
          <div className="card-body" style={{ borderTop: '1px solid var(--color-border)' }}>
            <details className="disclosure">
              <summary>Enregistrer une affectation passée (oubli de l’application)</summary>
              <ActionForm action={recordPastAssignmentAction} submitLabel="Enregistrer" resetOnSuccess>
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="pa-emp">Chauffeur</label>
                    <select id="pa-emp" name="employeeId" className="input" required>
                      {drivers.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.first_name} {e.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="pa-day">Date</label>
                    <input id="pa-day" name="day" type="date" className="input" max={today} required />
                  </div>
                  <div className="field">
                    <label htmlFor="pa-start">De</label>
                    <input id="pa-start" name="start" type="time" className="input" defaultValue="07:00" required />
                  </div>
                  <div className="field">
                    <label htmlFor="pa-end">À</label>
                    <input id="pa-end" name="end" type="time" className="input" defaultValue="18:00" required />
                  </div>
                </div>
              </ActionForm>
            </details>
          </div>
        )}
      </section>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Dernières inspections</h2>
          </div>
          <div className="card-body stack">
            {inspections.length === 0 && <p className="muted">Aucune inspection pour le moment.</p>}
            {inspections
              .filter((i) => i !== pending)
              .map((i) => (
                <div key={i.id} style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
                  <InspectionSummary inspection={i} />
                </div>
              ))}
          </div>
        </section>

        {canAccess(ctx.roles, 'dommages') && (
          <section className="card">
            <div className="card-head">
              <h2 className="section-title">Dommages</h2>
              {can(ctx.roles, 'dommage.modifier') && (
                <Link href={`/dommages/nouveau?vehicule=${vehicle.id}`} className="btn btn-sm">
                  Ouvrir un dossier
                </Link>
              )}
            </div>
            <div className="card-body stack-sm">
              {damages.length === 0 && <p className="muted">Aucun dommage déclaré.</p>}
              {damages.map((d) => (
                <Link key={d.id} href={`/dommages/${d.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, textDecoration: 'none' }}>
                  <span>
                    <strong>{labelOf(DAMAGE_TYPES, d.type)}</strong> <span className="small muted">{formatDate(d.occurred_at.slice(0, 10))}</span>
                  </span>
                  <DamageStatusBadge status={d.status} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="grid-2">
        <DocumentsPanel entity="vehicle" entityId={vehicle.id} documents={listDocuments(db, ctx.orgId, 'vehicle', vehicle.id)} today={today} editable={can(ctx.roles, 'document.modifier')} />
        <AuditList title="Historique de la fiche" rows={listAudit(db, ctx.orgId, { entityType: 'vehicle', entityId: vehicle.id, limit: 30 })} />
      </div>
    </>
  );
}
