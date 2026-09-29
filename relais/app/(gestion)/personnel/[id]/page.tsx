import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { AuditList } from '@/components/AuditList';
import { DamageStatusBadge, ExpiryBadge } from '@/components/badges';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listAudit } from '@/lib/data/audit';
import { listDamages, listFines } from '@/lib/data/cases';
import { listDocuments } from '@/lib/data/documents';
import { fullName, getEmployee, listAbsences, userForEmployee } from '@/lib/data/employees';
import { assignmentHistory } from '@/lib/data/vehicles';
import { addDays, formatDate, formatDateTime, parisDate } from '@/lib/domain/dates';
import { expiryStatus } from '@/lib/domain/documents';
import { ABSENCE_TYPES, CONTRACT_TYPES, DAMAGE_TYPES, DRIVING_POSITIONS, EMPLOYEE_STATUSES, FINE_STATUSES, POSITIONS, labelOf } from '@/lib/domain/labels';
import { can, canAccess } from '@/lib/domain/roles';
import { addAbsenceAction, deleteAbsenceAction } from '../../planning/actions';
import { createDriverAccessAction, licenceCheckAction } from '../actions';

export const metadata: Metadata = { title: 'Salarié' };

export default async function EmployeePage(props: PageProps<'/personnel/[id]'>) {
  const ctx = await requireModule('personnel');
  const employeeId = Number((await props.params).id);
  const db = getDb();
  const employee = Number.isInteger(employeeId) ? getEmployee(db, ctx.orgId, employeeId) : undefined;
  if (!employee) notFound();

  const today = parisDate();
  const name = fullName(employee);
  const isDriver = DRIVING_POSITIONS.includes(employee.position);
  const licence = expiryStatus(employee.licence_expires_on, today);
  const access = userForEmployee(db, ctx.orgId, employee.id);
  const absences = listAbsences(db, ctx.orgId, { from: addDays(today, -60), to: addDays(today, 120), employeeId: employee.id });
  const history = assignmentHistory(db, ctx.orgId, { employeeId: employee.id, limit: 15 });
  const damages = canAccess(ctx.roles, 'dommages') ? listDamages(db, ctx.orgId, { employeeId: employee.id }) : [];
  const fines = canAccess(ctx.roles, 'amendes') ? listFines(db, ctx.orgId, { employeeId: employee.id }) : [];
  const canEdit = can(ctx.roles, 'personnel.modifier');
  const suggestedLogin = employee.first_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

  return (
    <>
      <PageHeader
        title={name}
        subtitle={
          <>
            {labelOf(POSITIONS, employee.position)} · <span className="badge">{labelOf(EMPLOYEE_STATUSES, employee.status)}</span>
          </>
        }
        back={{ href: '/personnel', label: 'Personnel' }}
        actions={
          canEdit && (
            <Link href={`/personnel/${employee.id}/modifier`} className="btn btn-ghost">
              Modifier la fiche
            </Link>
          )
        }
      />

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Fiche</h2>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Téléphone</dt>
              <dd>{employee.phone ? <a href={`tel:${employee.phone.replace(/\s/g, '')}`}>{employee.phone}</a> : '·'}</dd>
              <dt>E-mail</dt>
              <dd>{employee.email || '·'}</dd>
              <dt>Contrat</dt>
              <dd>{labelOf(CONTRACT_TYPES, employee.contract_type) || '·'}</dd>
              <dt>Embauche</dt>
              <dd>{formatDate(employee.hired_on) || '·'}</dd>
              {employee.left_on && (
                <>
                  <dt>Sortie</dt>
                  <dd>{formatDate(employee.left_on)}</dd>
                </>
              )}
              <dt>Accès application</dt>
              <dd>{access ? `${access.login}${access.active ? '' : ' (désactivé)'}${access.last_login_at ? `, dernière connexion le ${formatDateTime(access.last_login_at)}` : ', jamais connecté'}` : 'Aucun'}</dd>
              {employee.notes && (
                <>
                  <dt>Notes</dt>
                  <dd style={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>{employee.notes}</dd>
                </>
              )}
            </dl>
            {!access && can(ctx.roles, 'utilisateur.gerer') && employee.status !== 'sorti' && (
              <details className="disclosure" style={{ marginTop: 14 }}>
                <summary>Créer l’accès à l’application chauffeur</summary>
                <ActionForm action={createDriverAccessAction} submitLabel="Créer l’accès">
                  <input type="hidden" name="employeeId" value={employee.id} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="login">Identifiant</label>
                      <input id="login" name="login" className="input" defaultValue={suggestedLogin} required />
                    </div>
                    <div className="field">
                      <label htmlFor="code">Code à 6 chiffres</label>
                      <input id="code" name="code" className="input mono" inputMode="numeric" pattern="\d{6}" required />
                    </div>
                  </div>
                </ActionForm>
              </details>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Permis de conduire</h2>
            {isDriver && <ExpiryBadge status={licence} />}
          </div>
          <div className="card-body stack">
            <dl className="kv">
              <dt>Numéro</dt>
              <dd className="mono">{employee.licence_number || '·'}</dd>
              <dt>Catégories</dt>
              <dd>{employee.licence_categories || '·'}</dd>
              <dt>Fin de validité</dt>
              <dd>{formatDate(employee.licence_expires_on) || 'Non renseignée'}</dd>
              <dt>Dernière vérification</dt>
              <dd>{formatDate(employee.licence_checked_on) || 'Jamais'}</dd>
            </dl>
            {canEdit && (
              <details className="disclosure">
                <summary>Enregistrer une vérification de validité</summary>
                <p className="small muted" style={{ margin: '8px 0' }}>
                  Les employeurs du transport routier peuvent vérifier la validité d’un permis sur{' '}
                  <a href="https://verif.permisdeconduire.gouv.fr" target="_blank" rel="noreferrer">
                    verif.permisdeconduire.gouv.fr
                  </a>
                  . Reportez ici le résultat : il est tracé dans l’historique.
                </p>
                <ActionForm action={licenceCheckAction} submitLabel="Enregistrer la vérification">
                  <input type="hidden" name="employeeId" value={employee.id} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="checkedOn">Vérifié le</label>
                      <input id="checkedOn" name="checkedOn" type="date" className="input" defaultValue={today} max={today} required />
                    </div>
                    <div className="field">
                      <label htmlFor="valid">Résultat</label>
                      <select id="valid" name="valid" className="input">
                        <option value="oui">Permis valide</option>
                        <option value="non">Permis non valide</option>
                      </select>
                    </div>
                  </div>
                </ActionForm>
              </details>
            )}
          </div>
        </section>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Absences</h2>
            <span className="small muted">60 derniers jours et à venir</span>
          </div>
          <div className="card-body stack">
            {absences.length === 0 && <p className="muted">Aucune absence.</p>}
            {absences.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <span className="badge">{labelOf(ABSENCE_TYPES, a.type)}</span>{' '}
                  <span className="small">
                    du {formatDate(a.start_on)} au {formatDate(a.end_on)}
                    {a.note ? `. ${a.note}` : ''}
                  </span>
                </div>
                {can(ctx.roles, 'absence.modifier') && (
                  <ActionForm action={deleteAbsenceAction} submitLabel="Retirer" submitClassName="btn btn-ghost btn-sm" className="btn-row" confirmMessage="Retirer cette absence ?">
                    <input type="hidden" name="absenceId" value={a.id} />
                  </ActionForm>
                )}
              </div>
            ))}
            {can(ctx.roles, 'absence.modifier') && (
              <details className="disclosure">
                <summary>Ajouter une absence</summary>
                <ActionForm action={addAbsenceAction} submitLabel="Enregistrer" resetOnSuccess>
                  <input type="hidden" name="employeeId" value={employee.id} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="a-type">Type</label>
                      <select id="a-type" name="type" className="input">
                        {ABSENCE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="a-start">Du</label>
                      <input id="a-start" name="startOn" type="date" className="input" defaultValue={today} required />
                    </div>
                    <div className="field">
                      <label htmlFor="a-end">Au</label>
                      <input id="a-end" name="endOn" type="date" className="input" defaultValue={today} />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="a-note">Commentaire</label>
                    <input id="a-note" name="note" className="input" />
                    <span className="hint">Aucun motif médical.</span>
                  </div>
                </ActionForm>
              </details>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Véhicules conduits</h2>
          </div>
          {history.length === 0 ? (
            <p className="empty">Aucune affectation.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Véhicule</th>
                    <th>Début</th>
                    <th>Fin</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link className="row-link mono" href={`/vehicules/${a.vehicle_id}`}>
                          {a.plate}
                        </Link>
                      </td>
                      <td className="small mono">{formatDateTime(a.started_at)}</td>
                      <td className="small mono">{a.ended_at ? formatDateTime(a.ended_at) : <span className="badge badge-black">En cours</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {(damages.length > 0 || fines.length > 0) && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h2 className="section-title">Incidents</h2>
          </div>
          <div className="card-body stack-sm">
            {damages.map((d) => (
              <Link key={`d${d.id}`} href={`/dommages/${d.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, textDecoration: 'none' }}>
                <span>
                  Dommage : <strong>{labelOf(DAMAGE_TYPES, d.type)}</strong> sur <span className="mono">{d.plate}</span>{' '}
                  <span className="small muted">{formatDate(d.occurred_at.slice(0, 10))}</span>
                </span>
                <DamageStatusBadge status={d.status} />
              </Link>
            ))}
            {fines.map((f) => (
              <Link key={`f${f.id}`} href={`/amendes/${f.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, textDecoration: 'none' }}>
                <span>
                  Avis de contravention sur <span className="mono">{f.plate}</span> <span className="small muted">{formatDateTime(f.offense_at)}</span>
                </span>
                <span className="badge">{labelOf(FINE_STATUSES, f.status)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid-2">
        {can(ctx.roles, 'personnel.voir_documents') ? (
          <DocumentsPanel entity="employee" entityId={employee.id} documents={listDocuments(db, ctx.orgId, 'employee', employee.id)} today={today} editable={can(ctx.roles, 'document.modifier')} />
        ) : (
          <section className="card card-body muted">Les documents personnels ne sont visibles que par la direction, les RH et le responsable flotte.</section>
        )}
        <AuditList title="Historique" rows={listAudit(db, ctx.orgId, { entityType: 'employee', entityId: employee.id, limit: 30 })} />
      </div>
    </>
  );
}
