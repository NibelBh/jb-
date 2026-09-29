import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listAbsences, listEmployees } from '@/lib/data/employees';
import { dayBoard, weekGrid } from '@/lib/data/planning';
import { listVehicles } from '@/lib/data/vehicles';
import { addDays, formatDate, formatLongDate, formatWeekday, isIsoDate, parisDate, startOfWeek } from '@/lib/domain/dates';
import { ABSENCE_TYPES, DRIVING_POSITIONS, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { addAbsenceAction, addRouteAction, assignRouteAction, deleteAbsenceAction, deleteRouteAction, importRoutesAction, setDayStatusAction } from './actions';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Planning' };

export default async function PlanningPage(props: PageProps<'/planning'>) {
  const ctx = await requireModule('planning');
  const params = await props.searchParams;
  const today = parisDate();
  const day = typeof params.jour === 'string' && isIsoDate(params.jour) ? params.jour : today;
  const week = params.vue === 'semaine';
  const editable = can(ctx.roles, 'planning.modifier');
  const db = getDb();

  const step = week ? 7 : 1;
  const nav = (
    <div className="btn-row">
      <Link className="btn btn-ghost btn-sm" href={`/planning?jour=${addDays(day, -step)}${week ? '&vue=semaine' : ''}`}>
        ← {week ? 'Semaine précédente' : 'Veille'}
      </Link>
      <Link className="btn btn-ghost btn-sm" href={`/planning?jour=${today}${week ? '&vue=semaine' : ''}`}>
        Aujourd’hui
      </Link>
      <Link className="btn btn-ghost btn-sm" href={`/planning?jour=${addDays(day, step)}${week ? '&vue=semaine' : ''}`}>
        {week ? 'Semaine suivante' : 'Lendemain'} →
      </Link>
      <span className={styles.toggle}>
        <Link href={`/planning?jour=${day}`} className={week ? '' : styles.on} aria-current={week ? undefined : 'page'}>
          Jour
        </Link>
        <Link href={`/planning?jour=${day}&vue=semaine`} className={week ? styles.on : ''} aria-current={week ? 'page' : undefined}>
          Semaine
        </Link>
      </span>
    </div>
  );

  if (week) {
    const monday = startOfWeek(day);
    const grid = weekGrid(db, ctx.orgId, monday);
    return (
      <>
        <PageHeader title="Planning de la semaine" subtitle={`Du ${formatDate(monday)} au ${formatDate(addDays(monday, 6))}`} actions={nav} />
        <section className="card table-wrap">
          <table className={`table ${styles.week}`}>
            <thead>
              <tr>
                <th>Chauffeur</th>
                {grid.days.map((d) => (
                  <th key={d} className={d === today ? styles.todayCol : ''}>
                    <Link href={`/planning?jour=${d}`}>{formatWeekday(d)}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.employee_id}>
                  <td className="nowrap">
                    <Link className="row-link" href={`/personnel/${row.employee_id}`}>
                      {row.name}
                    </Link>
                  </td>
                  {row.cells.map((c, i) => (
                    <td key={grid.days[i]} className={grid.days[i] === today ? styles.todayCol : ''}>
                      {c.absence && c.absence !== 'retard' ? (
                        <span className="badge badge-red">{labelOf(ABSENCE_TYPES, c.absence)}</span>
                      ) : c.status === 'travail' ? (
                        <span className={`badge ${c.route_code ? 'badge-black' : ''}`}>{c.route_code ?? 'Travail'}</span>
                      ) : c.status === 'repos' ? (
                        <span className="badge badge-soft">Repos</span>
                      ) : (
                        <span className="muted small">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </>
    );
  }

  const board = dayBoard(db, ctx.orgId, day);
  const drivers = listEmployees(db, ctx.orgId).filter((e) => DRIVING_POSITIONS.includes(e.position));
  const vehicles = listVehicles(db, ctx.orgId);
  const absences = listAbsences(db, ctx.orgId, { from: day, to: day });

  return (
    <>
      <PageHeader title="Planning" subtitle={formatLongDate(day)} actions={nav} />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="section-title">Tournées</h2>
          <span className="small muted">
            {board.routes.length} tournée{board.routes.length > 1 ? 's' : ''}, {board.unassignedRoutes} sans chauffeur
          </span>
        </div>
        {board.routes.length === 0 ? (
          <p className="empty">Aucune tournée ce jour. Ajoutez-les une par une ou importez le fichier du donneur d’ordre ci-dessous.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tournée</th>
                  <th>Départ</th>
                  <th>Affectation</th>
                  <th>Alertes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {board.routes.map((r) => (
                  <tr key={r.id} className={r.issues.length ? styles.issueRow : ''}>
                    <td>
                      <strong>{r.code}</strong>
                      <div className="small muted">{[r.client, r.depot].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="mono">{r.start_time ?? ''}</td>
                    <td>
                      {editable ? (
                        <ActionForm action={assignRouteAction} submitLabel="OK" submitClassName="btn btn-sm" className={styles.assign}>
                          <input type="hidden" name="routeId" value={r.id} />
                          <select name="employeeId" className="input" defaultValue={r.employee_id ?? ''} aria-label={`Chauffeur de la tournée ${r.code}`}>
                            <option value="">Chauffeur…</option>
                            {drivers.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.first_name} {e.last_name}
                              </option>
                            ))}
                          </select>
                          <select name="vehicleId" className="input" defaultValue={r.vehicle_id ?? ''} aria-label={`Véhicule de la tournée ${r.code}`}>
                            <option value="">Véhicule…</option>
                            {vehicles.map((v) => (
                              <option key={v.id} value={v.id} disabled={v.status === 'immobilise' || v.status === 'bloque'}>
                                {v.plate}
                                {v.status === 'immobilise' ? ' (immobilisé)' : v.status === 'bloque' ? ' (bloqué)' : ''}
                              </option>
                            ))}
                          </select>
                        </ActionForm>
                      ) : (
                        <span>
                          {r.employee_name ?? 'Sans chauffeur'} · <span className="mono">{r.plate ?? 'sans véhicule'}</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <div className={styles.issues}>
                        {r.issues.map((i) => (
                          <span key={i} className={`badge ${i.startsWith('Chauffeur absent') || i.startsWith('Permis') || i === 'Véhicule indisponible' ? 'badge-red' : 'badge-yellow'}`}>
                            {i}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="nowrap">
                      {board.toReplace.includes(r) && (
                        <Link className="btn btn-yellow btn-sm" href={`/planning/remplacement?jour=${day}&tournee=${r.id}`}>
                          Remplacer
                        </Link>
                      )}
                      {editable && (
                        <ActionForm action={deleteRouteAction} submitLabel="Supprimer" submitClassName="btn btn-ghost btn-sm" className={styles.inline} confirmMessage={`Supprimer la tournée ${r.code} ?`}>
                          <input type="hidden" name="routeId" value={r.id} />
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Chauffeurs</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Ce jour</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody>
                {board.people.map((p) => (
                  <tr key={p.employee_id}>
                    <td>
                      <Link className="row-link" href={`/personnel/${p.employee_id}`}>
                        {p.name}
                      </Link>
                    </td>
                    <td>
                      {p.absence_type ? (
                        <span className={`badge ${p.absence_type === 'retard' ? 'badge-yellow' : 'badge-red'}`}>{labelOf(ABSENCE_TYPES, p.absence_type)}</span>
                      ) : p.plan_status === 'travail' ? (
                        <span className="badge badge-black">{p.route_code ?? 'Travail, sans tournée'}</span>
                      ) : p.plan_status === 'repos' ? (
                        <span className="badge badge-soft">Repos</span>
                      ) : (
                        <span className="badge badge-soft">Non planifié</span>
                      )}
                    </td>
                    {editable && (
                      <td className="nowrap">
                        <ActionForm action={setDayStatusAction} submitLabel={p.plan_status === 'repos' ? 'Mettre au travail' : 'Mettre au repos'} submitClassName="btn btn-ghost btn-sm" className={styles.inline}>
                          <input type="hidden" name="day" value={day} />
                          <input type="hidden" name="employeeId" value={p.employee_id} />
                          <input type="hidden" name="status" value={p.plan_status === 'repos' ? 'travail' : 'repos'} />
                        </ActionForm>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2 className="section-title">Absences ce jour</h2>
            </div>
            <div className="card-body stack">
              {absences.length === 0 && <p className="muted">Aucune absence enregistrée.</p>}
              {absences.map((a) => (
                <div key={a.id} className={styles.absence}>
                  <div>
                    <strong>{a.employee_name}</strong> <span className="badge">{labelOf(ABSENCE_TYPES, a.type)}</span>
                    <div className="small muted">
                      Du {formatDate(a.start_on)} au {formatDate(a.end_on)}
                      {a.note ? `. ${a.note}` : ''}
                    </div>
                  </div>
                  {can(ctx.roles, 'absence.modifier') && (
                    <ActionForm action={deleteAbsenceAction} submitLabel="Retirer" submitClassName="btn btn-ghost btn-sm" className={styles.inline} confirmMessage="Retirer cette absence ?">
                      <input type="hidden" name="absenceId" value={a.id} />
                    </ActionForm>
                  )}
                </div>
              ))}
              {can(ctx.roles, 'absence.modifier') && (
                <details className="disclosure">
                  <summary>Déclarer une absence ou un retard</summary>
                  <ActionForm action={addAbsenceAction} submitLabel="Enregistrer l’absence" resetOnSuccess>
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="abs-employee">Salarié</label>
                        <select id="abs-employee" name="employeeId" className="input" required>
                          {drivers.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.first_name} {e.last_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="abs-type">Type</label>
                        <select id="abs-type" name="type" className="input">
                          {ABSENCE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="abs-start">Du</label>
                        <input id="abs-start" name="startOn" type="date" className="input" defaultValue={day} required />
                      </div>
                      <div className="field">
                        <label htmlFor="abs-end">Au</label>
                        <input id="abs-end" name="endOn" type="date" className="input" defaultValue={day} />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="abs-note">Commentaire</label>
                      <input id="abs-note" name="note" className="input" placeholder="Ex. prévenu par SMS à 6 h 10" />
                      <span className="hint">Ne saisissez jamais de motif médical.</span>
                    </div>
                  </ActionForm>
                </details>
              )}
            </div>
          </section>

          {editable && (
            <section className="card">
              <div className="card-head">
                <h2 className="section-title">Ajouter des tournées</h2>
              </div>
              <div className="card-body stack">
                <ActionForm action={addRouteAction} submitLabel="Ajouter la tournée" resetOnSuccess>
                  <input type="hidden" name="day" value={day} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="r-code">Code</label>
                      <input id="r-code" name="code" className="input" placeholder="A09" required />
                    </div>
                    <div className="field">
                      <label htmlFor="r-time">Départ</label>
                      <input id="r-time" name="startTime" type="time" className="input" />
                    </div>
                    <div className="field">
                      <label htmlFor="r-client">Donneur d’ordre</label>
                      <input id="r-client" name="client" className="input" placeholder="Amazon, Chronopost…" />
                    </div>
                    <div className="field">
                      <label htmlFor="r-depot">Agence</label>
                      <input id="r-depot" name="depot" className="input" />
                    </div>
                  </div>
                </ActionForm>
                <details className="disclosure">
                  <summary>Importer un fichier (CSV ou copier-coller depuis Excel)</summary>
                  <ActionForm action={importRoutesAction} submitLabel="Importer" pendingLabel="Import…">
                    <input type="hidden" name="day" value={day} />
                    <p className="small muted">
                      Colonnes reconnues : <code>tournee</code> (obligatoire), <code>heure</code>, <code>client</code>, <code>agence</code>, <code>chauffeur</code> (nom ou identifiant), <code>vehicule</code>. Séparateur <code>;</code> ou <code>,</code>.{' '}
                      <a href="/api/modeles/tournees" download>
                        Télécharger le modèle
                      </a>
                      .
                    </p>
                    <div className="field">
                      <label htmlFor="imp-file">Fichier CSV</label>
                      <input id="imp-file" name="file" type="file" accept=".csv,text/csv,text/plain" className="input" />
                    </div>
                    <div className="field">
                      <label htmlFor="imp-csv">Ou collez le contenu</label>
                      <textarea id="imp-csv" name="csv" className="input" placeholder={'tournee;heure;chauffeur;vehicule\nA01;07:00;Samir Benali;FG-481-KL'} />
                    </div>
                  </ActionForm>
                </details>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
