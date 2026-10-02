import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AbsenceActions } from '@/components/AbsenceActions';
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
import { currentSituation, fullName, getEmployee, listAbsences, userForEmployee } from '@/lib/data/employees';
import { listShifts } from '@/lib/data/planning';
import { assignmentHistory, getVehicle } from '@/lib/data/vehicles';
import { addDays, daysBetween, formatDate, formatDateTime, formatWeekday, parisDate } from '@/lib/domain/dates';
import { formatDuration, formatRange, workedMinutes } from '@/lib/domain/shifts';
import { expiryStatus } from '@/lib/domain/documents';
import { ABSENCE_TYPES, CONTRACT_TYPES, DAMAGE_TYPES, DRIVING_POSITIONS, EMPLOYEE_STATUSES, FINE_STATUSES, POSITIONS, labelOf } from '@/lib/domain/labels';
import { can, canAccess } from '@/lib/domain/roles';
import { addAbsenceAction } from '../../planning/actions';
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
  const absences = listAbsences(db, ctx.orgId, { from: addDays(today, -365), to: addDays(today, 365), employeeId: employee.id }).reverse();
  const situation = currentSituation(db, ctx.orgId, employee, today);
  const vehicle = employee.vehicle_id ? getVehicle(db, ctx.orgId, employee.vehicle_id) : undefined;
  const params = await props.searchParams;
  const upcoming = listShifts(db, ctx.orgId, { from: today, to: addDays(today, 13), employeeId: employee.id });
  const month = today.slice(0, 7);
  const monthShifts = listShifts(db, ctx.orgId, { from: `${month}-01`, to: today, employeeId: employee.id });
  const done = monthShifts.filter((s) => s.status === 'realise');
  const monthStats = {
    days: new Set(done.map((s) => s.day)).size,
    routes: done.filter((s) => s.route_name).length,
    minutes: done.reduce((sum, s) => sum + workedMinutes(s), 0),
    pending: new Set(monthShifts.filter((s) => s.status !== 'realise' && s.day < today).map((s) => s.day)).size,
  };
  const history = assignmentHistory(db, ctx.orgId, { employeeId: employee.id, limit: 15 });
  const damages = canAccess(ctx.roles, 'dommages') ? listDamages(db, ctx.orgId, { employeeId: employee.id }) : [];
  const fines = canAccess(ctx.roles, 'amendes') ? listFines(db, ctx.orgId, { employeeId: employee.id }) : [];
  const canEdit = can(ctx.roles, 'personnel.modifier');
  const suggestedLogin = employee.first_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
              Modifier
            </Link>
          )
        }
      />

      {params.enregistre === '1' && (
        <p className="alert alert-ok" role="status" style={{ marginBottom: 12 }}>
          Modifications enregistrées.
          {Number(params.deplaces) > 0 && ` ${params.deplaces} planification(s) à venir passent sur ${vehicle?.plate ?? 'le nouveau véhicule'}.`}
          {Number(params.ignores) > 0 && ` ${params.ignores} n’ont pas pu changer de véhicule (déjà pris sur les mêmes horaires) : vérifiez le planning.`}
        </p>
      )}
      <p className={`alert ${situation.tone === 'ok' ? 'alert-ok' : situation.tone === 'off' ? 'alert-error' : ''}`} style={{ marginBottom: 16 }}>
        Aujourd’hui : <strong>{situation.label}</strong>
        {situation.until ? ` (jusqu’au ${formatDate(situation.until)} inclus)` : ''}.{' '}
        {situation.tone !== 'ok' && 'Le salarié ne peut pas être planifié sur cette période.'}
      </p>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Informations personnelles</h2>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Date de naissance</dt>
              <dd>
                {formatDate(employee.birth_date) || '·'}
                {employee.birth_place ? ` à ${employee.birth_place}` : ''}
              </dd>
              <dt>Nationalité</dt>
              <dd>{employee.nationality || '·'}</dd>
              <dt>Adresse</dt>
              <dd>{[employee.address, [employee.postal_code, employee.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '·'}</dd>
              <dt>Téléphone</dt>
              <dd>{employee.phone ? <a href={`tel:${employee.phone.replace(/\s/g, '')}`}>{employee.phone}</a> : '·'}</dd>
              <dt>E-mail</dt>
              <dd>{employee.email || '·'}</dd>
              <dt>En cas d’urgence</dt>
              <dd>
                {employee.emergency_name || '·'}
                {employee.emergency_phone ? (
                  <>
                    {' '}
                    <a href={`tel:${employee.emergency_phone.replace(/\s/g, '')}`}>{employee.emergency_phone}</a>
                  </>
                ) : null}
              </dd>
            </dl>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Poste et contrat</h2>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Poste</dt>
              <dd>{labelOf(POSITIONS, employee.position)}</dd>
              <dt>Matricule paie</dt>
              <dd className="mono">{employee.payroll_id || 'Non renseigné'}</dd>
              <dt>Contrat</dt>
              <dd>{labelOf(CONTRACT_TYPES, employee.contract_type) || '·'}</dd>
              <dt>Véhicule attribué</dt>
              <dd>{vehicle ? <Link href={`/vehicules/${vehicle.id}`}>{vehicle.plate}</Link> : 'Aucun'}</dd>
              <dt>Date d’arrivée</dt>
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
              <dt>Date d’obtention</dt>
              <dd>{formatDate(employee.licence_issued_on) || '·'}</dd>
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
            <h2 className="section-title">Situations et absences</h2>
            <span className="small muted">Arrêt maladie, accident du travail, formation, congés… 12 derniers mois et à venir</span>
          </div>
          <div className="card-body stack">
            {absences.length === 0 && <p className="muted">Aucune absence.</p>}
            {absences.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <span className={`badge ${a.start_on <= today && a.end_on >= today ? 'badge-red' : ''}`}>{labelOf(ABSENCE_TYPES, a.type)}</span>{' '}
                  <span className="small">
                    du {formatDate(a.start_on)} au {formatDate(a.end_on)} ({daysBetween(a.start_on, a.end_on) + 1} j)
                    {a.note ? `. ${a.note}` : ''}
                  </span>
                </div>
                {can(ctx.roles, 'absence.modifier') && <AbsenceActions absence={a} />}
              </div>
            ))}
            {can(ctx.roles, 'absence.modifier') && (
              <details className="disclosure">
                <summary>Déclarer une situation (arrêt, accident du travail, formation, congé…)</summary>
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
                    <span className="hint">Aucun motif médical. Les créneaux déjà planifiés sur la période sont libérés et signalés « À pourvoir ».</span>
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

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="section-title">Planning et présence</h2>
          <Link href={`/planning?jour=${today}&vue=semaine`} className="small">
            Planning de la semaine
          </Link>
        </div>
        <div className="card-body grid-2">
          <div>
            <h3 style={{ marginBottom: 8 }}>Ce mois-ci (présence réelle)</h3>
            <dl className="kv">
              <dt>Journées travaillées</dt>
              <dd>{monthStats.days}</dd>
              <dt>Tournées réalisées</dt>
              <dd>{monthStats.routes}</dd>
              <dt>Heures travaillées</dt>
              <dd>{formatDuration(monthStats.minutes)}</dd>
              <dt>Présences à confirmer</dt>
              <dd>{monthStats.pending ? <span className="badge badge-yellow">{monthStats.pending} jour(s)</span> : 'Aucune'}</dd>
            </dl>
          </div>
          <div>
            <h3 style={{ marginBottom: 8 }}>14 prochains jours</h3>
            {upcoming.length === 0 ? (
              <p className="muted small">Aucune planification.</p>
            ) : (
              <ul className="stack-sm" style={{ margin: 0, paddingLeft: 16 }}>
                {upcoming.map((s) => (
                  <li key={s.id} className="small">
                    <Link href={`/planning?jour=${s.day}`}>{formatWeekday(s.day)}</Link> {formatRange(s.start_time, s.end_time)}
                    {s.route_name ? `, tournée ${s.route_name}` : ''}
                    {s.plate ? `, ${s.plate}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

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
