import type { Metadata } from 'next';
import Link from 'next/link';
import { AbsenceActions } from '@/components/AbsenceActions';
import { ActionForm } from '@/components/ActionForm';
import { FilterTabs } from '@/components/FilterTabs';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { type Db, all, getDb } from '@/lib/db';
import { employeeAvailability, fullName, listAbsences, listEmployees } from '@/lib/data/employees';
import { dayBoard, getShift, weekGrid } from '@/lib/data/planning';
import { listVehicles } from '@/lib/data/vehicles';
import { addDays, formatDate, formatLongDate, formatTime, formatWeekday, isIsoDate, parisClock, parisDate, startOfWeek } from '@/lib/domain/dates';
import { ABSENCE_TYPES, DRIVING_POSITIONS, labelOf } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { SHIFT_STATUSES, formatDuration, formatRange } from '@/lib/domain/shifts';
import { vehicleCompliance } from '@/lib/domain/vehicles';
import {
  addAbsenceAction,
  confirmPresenceAction,
  createShiftAction,
  deleteShiftAction,
  markAbsentAction,
  updateShiftAction,
} from './actions';
import styles from './page.module.css';
import { type EmployeeOption, ShiftFields, type VehicleOption } from './ShiftFields';

export const metadata: Metadata = { title: 'Planning' };

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function options(db: Db, orgId: number, day: string) {
  const employees: EmployeeOption[] = listEmployees(db, orgId).map((e) => {
    const a = employeeAvailability(db, orgId, e, day);
    return { id: e.id, name: fullName(e), unavailable: a.available ? null : a.reason.replace(/^est /, ''), driver: DRIVING_POSITIONS.includes(e.position), vehicleId: e.vehicle_id };
  });
  employees.sort((a, b) => Number(b.driver) - Number(a.driver) || a.name.localeCompare(b.name, 'fr'));
  const vehicles: VehicleOption[] = listVehicles(db, orgId).map((v) => {
    const c = vehicleCompliance(v, day);
    const problem = c.blocking.length ? c.blocking.join(', ').toLowerCase() : null;
    return { id: v.id, plate: v.plate, problem };
  });
  const routes = all<{ route_name: string }>(
    db,
    `SELECT route_name FROM shifts WHERE org_id = ? AND route_name IS NOT NULL GROUP BY route_name ORDER BY MAX(day) DESC, route_name LIMIT 60`,
    orgId,
  ).map((r) => r.route_name);
  return { employees, vehicles, routes };
}

export default async function PlanningPage(props: PageProps<'/planning'>) {
  const ctx = await requireModule('planning');
  const params = await props.searchParams;
  const today = parisDate();
  const day = typeof params.jour === 'string' && isIsoDate(params.jour) ? params.jour : today;
  const week = params.vue === 'semaine';
  const editable = can(ctx.roles, 'planning.modifier');
  const canAbsence = can(ctx.roles, 'absence.modifier');
  const canPresence = can(ctx.roles, 'presence.confirmer');
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
      {editable && (
        <Link className="btn btn-yellow btn-sm" href={`/planning?jour=${day}&nouveau=1#nouvelle`}>
          Créer une nouvelle planification
        </Link>
      )}
    </div>
  );

  if (week) {
    const monday = startOfWeek(day);
    const grid = weekGrid(db, ctx.orgId, monday);
    return (
      <>
        <PageHeader title="Planning de la semaine" subtitle={`Du ${formatDate(monday)} au ${formatDate(addDays(monday, 6))}. Cliquez sur un créneau pour le modifier.`} actions={nav} />
        <section className="card table-wrap">
          <table className={`table ${styles.week}`}>
            <thead>
              <tr>
                <th>Salarié</th>
                {grid.days.map((d) => (
                  <th key={d} className={d === today ? styles.todayCol : ''}>
                    <Link href={`/planning?jour=${d}`}>{formatWeekday(d)}</Link>
                  </th>
                ))}
                <th className="num">Heures prévues</th>
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
                      <div className={styles.cell}>
                        {c.absence ? (
                          <span className="badge badge-red">{labelOf(ABSENCE_TYPES, c.absence)}</span>
                        ) : c.unavailable ? (
                          <span className="badge badge-soft" title={c.unavailable}>
                            Indisponible
                          </span>
                        ) : null}
                        {c.shifts.map((s) => (
                          <Link
                            key={s.id}
                            href={`/planning?jour=${s.day}&modifier=${s.id}#modifier`}
                            className={`badge ${s.status === 'realise' ? '' : s.route_name ? 'badge-black' : 'badge-yellow'}`}
                            title={labelOf(SHIFT_STATUSES, s.status)}
                          >
                            {formatRange(s.start_time, s.end_time)}
                            {s.route_name ? ` ${s.route_name}` : ''}
                          </Link>
                        ))}
                        {!c.absence && !c.unavailable && c.shifts.length === 0 && <span className="muted small">·</span>}
                      </div>
                    </td>
                  ))}
                  <td className="num nowrap">{row.minutes ? formatDuration(row.minutes) : ''}</td>
                </tr>
              ))}
              {grid.unassigned.length > 0 && (
                <tr>
                  <td>
                    <strong>À pourvoir</strong>
                  </td>
                  {grid.days.map((d) => (
                    <td key={d}>
                      <div className={styles.cell}>
                        {grid.unassigned
                          .filter((s) => s.day === d)
                          .map((s) => (
                            <Link key={s.id} href={`/planning/remplacement?creneau=${s.id}`} className="badge badge-red">
                              {s.route_name ?? formatRange(s.start_time, s.end_time)}
                            </Link>
                          ))}
                      </div>
                    </td>
                  ))}
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <p className="small muted" style={{ marginTop: 8 }}>
          Noir : créneau avec tournée. Jaune : créneau sans tournée (dépôt, formation). Blanc : créneau réalisé. Rouge : tournée sans salarié ou salarié absent.
        </p>
      </>
    );
  }

  const board = dayBoard(db, ctx.orgId, day, today);
  const opts = options(db, ctx.orgId, day);
  const absences = listAbsences(db, ctx.orgId, { from: day, to: day });
  const editId = Number(params.modifier);
  const editing = Number.isInteger(editId) ? getShift(db, ctx.orgId, editId) : undefined;
  const editOpts = editing && editing.day !== day ? options(db, ctx.orgId, editing.day) : opts;
  const creating = params.nouveau === '1' || board.shifts.length === 0;
  const FILTERS = [
    { value: '', label: 'Toutes', test: () => true },
    { value: 'tournees', label: 'Tournées', test: (s: (typeof board.shifts)[number]) => !!s.route_name },
    { value: 'a_couvrir', label: 'À régler', test: (s: (typeof board.shifts)[number]) => s.blocking || board.toReplace.includes(s) },
    { value: 'a_confirmer', label: 'Présence à confirmer', test: (s: (typeof board.shifts)[number]) => board.toConfirm.includes(s) && s.status === 'prevu' && day < today },
  ];
  const filter = FILTERS.find((f) => f.value && f.value === params.filtre) ?? FILTERS[0];
  const shown = board.shifts.filter(filter.test);

  return (
    <>
      <PageHeader
        title="Planning"
        subtitle={`${capitalize(formatLongDate(day))} · ${board.shifts.length} planification${board.shifts.length > 1 ? 's' : ''}${board.unassigned ? `, dont ${board.unassigned} sans salarié` : ''}`}
        actions={nav}
      />

      {editable && editing && (
        <section className="card" style={{ marginBottom: 16 }} id="modifier">
          <div className="card-head">
            <h2 className="section-title">Modifier la planification</h2>
            <Link href={`/planning?jour=${day}`} className="small">
              Annuler
            </Link>
          </div>
          <div className="card-body">
            {editing.status !== 'prevu' ? (
              <p className="alert">
                Ce créneau est {labelOf(SHIFT_STATUSES, editing.status).toLowerCase()} : il n’est plus modifiable depuis le planning. Corrigez les heures avec « Confirmer la présence ».
              </p>
            ) : (
              <ActionForm action={updateShiftAction} submitLabel="Enregistrer les modifications" submitClassName="btn btn-yellow">
                <input type="hidden" name="shiftId" value={editing.id} />
                <ShiftFields
                  prefix="edit"
                  employees={editOpts.employees}
                  vehicles={editOpts.vehicles}
                  routes={editOpts.routes}
                  defaults={{
                    day: editing.day,
                    employeeId: editing.employee_id,
                    startTime: editing.start_time,
                    endTime: editing.end_time,
                    routeName: editing.route_name,
                    vehicleId: editing.vehicle_id,
                    notes: editing.notes,
                  }}
                />
              </ActionForm>
            )}
          </div>
        </section>
      )}

      {editable && !editing && (
        <details className={`card ${styles.create}`} id="nouvelle" open={creating}>
          <summary className="card-head">
            <h2 className="section-title">Créer une nouvelle planification</h2>
            <span className="small muted">Salarié, jour, horaires, tournée</span>
          </summary>
          <div className="card-body">
            <ActionForm action={createShiftAction} submitLabel="Créer la planification" submitClassName="btn btn-yellow" resetOnSuccess>
              <ShiftFields prefix="new" employees={opts.employees} vehicles={opts.vehicles} routes={opts.routes} defaults={{ day }} repeat />
            </ActionForm>
          </div>
        </details>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="section-title">Planifications du jour</h2>
          <span className="small muted">« En cours » dès que le chauffeur prend son véhicule, « Réalisé » après l’état de fin de journée.</span>
        </div>
        {board.shifts.length > 0 && (
          <div style={{ padding: '6px 20px 0' }}>
            <FilterTabs
              label="Filtrer les planifications"
              items={FILTERS.map((f) => ({
                href: `/planning?jour=${day}${f.value ? `&filtre=${f.value}` : ''}`,
                label: f.label,
                count: board.shifts.filter(f.test).length,
                active: f === filter,
              }))}
            />
          </div>
        )}
        {board.shifts.length === 0 ? (
          <div className="empty-state">
            <strong>Personne n’est planifié ce jour-là</strong>
            <p>Créez les planifications une par une, répétez celles d’un salarié sur la semaine, ou importez le planning depuis un fichier.</p>
            {editable && (
              <div className="btn-row">
                <Link className="btn btn-yellow" href={`/planning?jour=${day}&nouveau=1#nouvelle`}>
                  Créer une planification
                </Link>
                <Link className="btn btn-ghost" href="/imports">
                  Importer un planning
                </Link>
              </div>
            )}
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <strong>Rien dans cette catégorie</strong>
            <p>
              <Link href={`/planning?jour=${day}`}>Voir toutes les planifications du jour</Link>
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Horaires</th>
                  <th>Salarié</th>
                  <th>Tournée</th>
                  <th>Véhicule</th>
                  <th>Présence</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className={s.blocking ? styles.blockRow : s.issues.length ? styles.issueRow : ''}>
                    <td className="mono nowrap">{formatRange(s.start_time, s.end_time)}</td>
                    <td>
                      {s.employee_id ? (
                        <Link className="row-link nowrap" href={`/personnel/${s.employee_id}`}>
                          {s.employee_name}
                        </Link>
                      ) : (
                        <span className="badge badge-red">À pourvoir</span>
                      )}
                      {s.issues.filter((i) => i !== 'Aucun salarié').length > 0 && (
                        <div className={styles.issues} style={{ marginTop: 4 }}>
                          {s.issues
                            .filter((i) => i !== 'Aucun salarié')
                            .map((i) => (
                              <span key={i} className={`badge ${s.blocking && i !== 'Aucun véhicule' && i !== 'Retard signalé' && i !== 'Présence non confirmée' ? 'badge-red' : 'badge-yellow'}`}>
                                {i}
                              </span>
                            ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {s.route_name ? <strong>{s.route_name}</strong> : <span className="muted small">Sans tournée</span>}
                      {s.notes && <div className="small muted">{s.notes}</div>}
                    </td>
                    <td className="mono nowrap">{s.plate ?? ''}</td>
                    <td className="nowrap">
                      <span className={`badge ${s.status === 'realise' ? '' : s.status === 'en_cours' ? 'badge-black' : 'badge-soft'}`}>{labelOf(SHIFT_STATUSES, s.status)}</span>
                      {(s.actual_start || s.actual_end) && (
                        <div className="small muted">
                          {s.actual_start ? formatTime(s.actual_start) : '?'} à {s.actual_end ? formatTime(s.actual_end) : '…'}
                          {s.closed_by ? ` (${s.closed_by})` : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {board.toReplace.includes(s) && editable && (
                          <Link className="btn btn-yellow btn-sm" href={`/planning/remplacement?creneau=${s.id}`}>
                            {s.employee_id ? 'Remplacer' : 'Affecter'}
                          </Link>
                        )}
                        {editable && s.status === 'prevu' && (
                          <Link className="btn btn-ghost btn-sm" href={`/planning?jour=${day}&modifier=${s.id}#modifier`}>
                            Modifier
                          </Link>
                        )}
                        {editable && s.status === 'prevu' && (
                          <ActionForm
                            action={deleteShiftAction}
                            submitLabel="Supprimer"
                            submitClassName="btn btn-ghost btn-sm"
                            className={styles.inline}
                            confirmMessage={`Supprimer la planification ${formatRange(s.start_time, s.end_time)}${s.employee_name ? ` de ${s.employee_name}` : ''} ?`}
                          >
                            <input type="hidden" name="shiftId" value={s.id} />
                          </ActionForm>
                        )}
                        {canPresence && s.employee_id && s.status !== 'realise' && s.status !== 'en_cours' && day <= today && !s.blocking && (
                          <details className={styles.presence}>
                            <summary className="btn btn-sm">Présence</summary>
                            <ActionForm action={confirmPresenceAction} submitLabel="Confirmer la présence" submitClassName="btn btn-sm" className={styles.presenceForm}>
                              <input type="hidden" name="shiftId" value={s.id} />
                              <label className="small">
                                Arrivée <input name="start" type="time" className="input" defaultValue={s.start_time} required />
                              </label>
                              <label className="small">
                                Départ <input name="end" type="time" className="input" defaultValue={s.end_time} required />
                              </label>
                            </ActionForm>
                            {canAbsence && (
                              <ActionForm action={markAbsentAction} submitLabel="Déclarer absent" submitClassName="btn btn-ghost btn-sm" className={styles.presenceForm}>
                                <input type="hidden" name="shiftId" value={s.id} />
                                <select name="type" className="input" aria-label="Motif d’absence" defaultValue="absence_injustifiee">
                                  {ABSENCE_TYPES.filter((t) => t.value !== 'retard').map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                              </ActionForm>
                            )}
                          </details>
                        )}
                        {canPresence && s.status === 'realise' && s.closed_by !== 'État de fin de journée' && (
                          <details className={styles.presence}>
                            <summary className="btn btn-ghost btn-sm">Corriger les heures</summary>
                            <ActionForm action={confirmPresenceAction} submitLabel="Enregistrer" submitClassName="btn btn-sm" className={styles.presenceForm}>
                              <input type="hidden" name="shiftId" value={s.id} />
                              <label className="small">
                                Arrivée <input name="start" type="time" className="input" defaultValue={s.actual_start ? parisClock(s.actual_start) : s.start_time} required />
                              </label>
                              <label className="small">
                                Départ <input name="end" type="time" className="input" defaultValue={s.actual_end ? parisClock(s.actual_end) : s.end_time} required />
                              </label>
                            </ActionForm>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="card" id="disponibilites">
          <div className="card-head">
            <h2 className="section-title">Disponibilités du jour</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Salarié</th>
                  <th>Ce jour</th>
                  <th className="num">Prévu</th>
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
                        <span className="badge badge-red">{labelOf(ABSENCE_TYPES, p.absence_type)}</span>
                      ) : p.unavailable ? (
                        <span className="badge badge-soft">{p.unavailable.replace(/^est /, '')}</span>
                      ) : p.shifts.length ? (
                        <span className="small">{p.shifts.map((s) => `${formatRange(s.start_time, s.end_time)}${s.route_name ? ` ${s.route_name}` : ''}`).join(' ; ')}</span>
                      ) : (
                        <span className="badge badge-yellow">Disponible, non planifié</span>
                      )}
                      {p.late && <span className="badge badge-yellow">Retard</span>}
                    </td>
                    <td className="num nowrap">{p.minutes ? formatDuration(p.minutes) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

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
                {canAbsence && <AbsenceActions absence={a} />}
              </div>
            ))}
            {canAbsence && (
              <details className="disclosure">
                <summary>Déclarer une absence, un arrêt ou un retard</summary>
                <ActionForm action={addAbsenceAction} submitLabel="Enregistrer" resetOnSuccess>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="abs-employee">Salarié</label>
                      <select id="abs-employee" name="employeeId" className="input" required>
                        {opts.employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
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
                    <span className="hint">Les créneaux prévus sur la période sont libérés et apparaissent « À pourvoir ». Ne saisissez jamais de motif médical.</span>
                  </div>
                </ActionForm>
              </details>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
