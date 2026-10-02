import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { AuditList } from '@/components/AuditList';
import { FineUrgencyBadge } from '@/components/badges';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listAudit } from '@/lib/data/audit';
import { getFine } from '@/lib/data/cases';
import { fullName, getEmployee, listEmployees } from '@/lib/data/employees';
import { driverAt } from '@/lib/data/operations';
import { formatDate, formatDateTime, parisDate } from '@/lib/domain/dates';
import { designationDeadline, fineUrgency } from '@/lib/domain/fines';
import { FINE_STATUSES, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { designateAction, setFineStatusAction } from '../actions';

export const metadata: Metadata = { title: 'Avis de contravention' };

export default async function FinePage(props: PageProps<'/amendes/[id]'>) {
  const ctx = await requireModule('amendes');
  const params = await props.searchParams;
  const fineId = Number((await props.params).id);
  const db = getDb();
  const fine = Number.isInteger(fineId) ? getFine(db, ctx.orgId, fineId) : undefined;
  if (!fine) notFound();

  const today = parisDate();
  const urgency = fineUrgency(fine.notice_sent_on, today);
  const match = driverAt(db, ctx.orgId, fine.vehicle_id, fine.offense_at);
  const candidateIds = match.kind === 'unique' ? [match.assignment.employeeId] : match.kind === 'ambigu' ? [...new Set(match.assignments.map((a) => a.employeeId))] : [];
  const candidates = candidateIds.map((cid) => getEmployee(db, ctx.orgId, cid)).filter((e) => e !== undefined);
  const employees = listEmployees(db, ctx.orgId, { includeLeft: true });
  const editable = can(ctx.roles, 'amende.modifier');
  const suggested = fine.employee_id ?? (match.kind === 'unique' ? match.assignment.employeeId : undefined);
  const designated = fine.employee_id ? getEmployee(db, ctx.orgId, fine.employee_id) : undefined;

  return (
    <>
      <PageHeader
        title={`Avis ${fine.notice_number ?? `n° ${fine.id}`}`}
        subtitle={
          <>
            <Link href={`/vehicules/${fine.vehicle_id}`} className="mono">
              {fine.plate}
            </Link>{' '}
            · <span className="badge">{labelOf(FINE_STATUSES, fine.status)}</span>{' '}
            {fine.status === 'a_designer' && <FineUrgencyBadge urgency={urgency.urgency} daysLeft={urgency.daysLeft} />}
          </>
        }
        back={{ href: '/amendes', label: 'Amendes' }}
        actions={
          editable && (
            <Link href={`/amendes/${fine.id}/modifier`} className="btn btn-ghost">
              Modifier l’avis
            </Link>
          )
        }
      />
      {params.enregistre === '1' && (
        <p className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>
          Modifications enregistrées.
        </p>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Avis</h2>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Infraction</dt>
              <dd>{formatDateTime(fine.offense_at)}</dd>
              <dt>Nature</dt>
              <dd>{fine.description || '·'}</dd>
              <dt>Lieu</dt>
              <dd>{fine.location || '·'}</dd>
              <dt>Montant</dt>
              <dd>{fine.amount_cents !== null ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(fine.amount_cents / 100) : '·'}</dd>
              <dt>Avis envoyé le</dt>
              <dd>{formatDate(fine.notice_sent_on)}</dd>
              <dt>Désigner avant le</dt>
              <dd>{formatDate(designationDeadline(fine.notice_sent_on))}</dd>
              <dt>Document</dt>
              <dd>
                {fine.notice_file_id ? (
                  <a href={`/api/fichiers/${fine.notice_file_id}`} target="_blank" rel="noreferrer">
                    Ouvrir l’avis
                  </a>
                ) : (
                  'Non joint'
                )}
              </dd>
              {fine.proof_file_id && (
                <>
                  <dt>Preuve de désignation</dt>
                  <dd>
                    <a href={`/api/fichiers/${fine.proof_file_id}`} target="_blank" rel="noreferrer">
                      Ouvrir
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Conducteur</h2>
          </div>
          <div className="card-body stack">
            {designated ? (
              <p className="alert alert-ok">
                {fullName(designated)} désigné(e) le {formatDate(fine.designated_on)}.
              </p>
            ) : match.kind === 'unique' ? (
              <p className="alert">
                D’après l’historique, <strong>{candidates[0] ? fullName(candidates[0]) : ''}</strong> conduisait {fine.plate} à ce moment (prise en charge le {formatDateTime(match.assignment.startedAt)}).
              </p>
            ) : match.kind === 'ambigu' ? (
              <p className="alert">Plusieurs affectations se chevauchent à cette heure : {candidates.map(fullName).join(', ')}. Vérifiez avant de désigner.</p>
            ) : (
              <p className="alert alert-error">
                Aucune affectation enregistrée pour ce véhicule à cette heure. Complétez l’historique depuis la <Link href={`/vehicules/${fine.vehicle_id}`}>fiche du véhicule</Link> ou désignez manuellement.
              </p>
            )}

            {editable && fine.status === 'a_designer' && (
              <>
                <p className="small">
                  La désignation se fait sur le site de l’ANTAI (
                  <a href="https://www.antai.gouv.fr" target="_blank" rel="noreferrer">
                    antai.gouv.fr
                  </a>
                  ) avec le numéro d’avis et l’identité complète du conducteur. Enregistrez-la ensuite ici avec la preuve.
                </p>
                {suggested && (
                  <dl className="kv small">
                    {(() => {
                      const e = getEmployee(db, ctx.orgId, suggested);
                      return e ? (
                        <>
                          <dt>Nom, prénom</dt>
                          <dd>
                            {e.last_name.toUpperCase()} {e.first_name}
                          </dd>
                          <dt>N° de permis</dt>
                          <dd className="mono">{e.licence_number || 'Non renseigné'}</dd>
                        </>
                      ) : null;
                    })()}
                  </dl>
                )}
                <ActionForm action={designateAction} submitLabel="Enregistrer la désignation">
                  <input type="hidden" name="fineId" value={fine.id} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="employeeId">Conducteur désigné</label>
                      <select id="employeeId" name="employeeId" className="input" defaultValue={suggested ?? ''} required>
                        <option value="">Choisir…</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.first_name} {e.last_name}
                            {candidateIds.includes(e.id) ? ' (historique)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="designatedOn">Désigné le</label>
                      <input id="designatedOn" name="designatedOn" type="date" className="input" defaultValue={today} max={today} required />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="proof">Preuve (accusé de désignation)</label>
                    <input id="proof" name="proof" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="input" />
                  </div>
                </ActionForm>
                <details className="disclosure">
                  <summary>Autre issue (contestation, paiement par la société, classement)</summary>
                  <ActionForm action={setFineStatusAction} submitLabel="Enregistrer" submitClassName="btn">
                    <input type="hidden" name="fineId" value={fine.id} />
                    <div className="field">
                      <label htmlFor="status">Statut</label>
                      <select id="status" name="status" className="input">
                        {FINE_STATUSES.filter((s) => s.value !== 'designe' && s.value !== 'a_designer').map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="note">Commentaire</label>
                      <input id="note" name="note" className="input" />
                    </div>
                  </ActionForm>
                </details>
              </>
            )}
          </div>
        </section>
      </div>

      <AuditList title="Historique" rows={listAudit(db, ctx.orgId, { entityType: 'fine', entityId: fine.id })} />
    </>
  );
}
