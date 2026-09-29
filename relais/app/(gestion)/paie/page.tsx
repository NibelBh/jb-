import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { ImportForm } from '@/components/ImportForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listPayrollExports, listPayrollItems, payrollCodes, payrollMonth } from '@/lib/data/payroll';
import { formatDate, formatDateTime, parisDate } from '@/lib/domain/dates';
import { ABSENCE_VARIABLES, MANUAL_VARIABLES, PAYROLL_VARIABLES, frNumber, isPayrollVariable, isPeriod, periodLabel, shiftPeriod, sumCosts, variableInfo } from '@/lib/domain/payroll';
import { can } from '@/lib/domain/roles';
import { addPayrollItemAction, deletePayrollItemAction, importPayrollJournalAction, savePayrollCodesAction } from './actions';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Paie' };

function euros(cents: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function PayrollPage(props: PageProps<'/paie'>) {
  const ctx = await requireModule('paie');
  const params = await props.searchParams;
  const today = parisDate();
  const current = today.slice(0, 7);
  const period = typeof params.mois === 'string' && isPeriod(params.mois) ? params.mois : current;
  const db = getDb();
  const month = payrollMonth(db, ctx.orgId, period, today);
  const items = listPayrollItems(db, ctx.orgId, period);
  const exports = listPayrollExports(db, ctx.orgId, period);
  const codes = payrollCodes(db, ctx.orgId);
  const editable = can(ctx.roles, 'paie.gerer');

  const totals = {
    worked: month.lines.reduce((s, l) => s + l.workedDays, 0),
    routes: month.lines.reduce((s, l) => s + l.routes, 0),
    hours: month.lines.reduce((s, l) => s + l.hours, 0),
    unconfirmed: month.lines.reduce((s, l) => s + l.unconfirmedDays.length, 0),
    absences: month.lines.reduce((s, l) => s + Object.values(l.absenceDays).reduce((a, b) => a + b, 0), 0),
  };
  const costs = sumCosts(
    [...month.entries.values()].map((e) => ({ grossCents: e.gross_cents, netCents: e.net_cents, employerCostCents: e.employer_cost_cents })),
  );
  const paidRoutes = month.lines.filter((l) => month.entries.has(l.employeeId)).reduce((s, l) => s + l.routes, 0);

  return (
    <>
      <PageHeader
        title={`Paie · ${periodLabel(period)}`}
        subtitle="Relais ne calcule pas les salaires. Il prépare les éléments variables du mois (jours travaillés, tournées, heures, absences datées, retards, primes) dans un fichier que votre logiciel de paie ou votre cabinet importe, puis récupère le journal de paie pour suivre le coût salarial par tournée."
        actions={
          <div className="btn-row">
            <Link className="btn btn-ghost btn-sm" href={`/paie?mois=${shiftPeriod(period, -1)}`}>
              ← {capitalize(periodLabel(shiftPeriod(period, -1)))}
            </Link>
            {period !== current && (
              <Link className="btn btn-ghost btn-sm" href="/paie">
                Mois en cours
              </Link>
            )}
            <Link className="btn btn-ghost btn-sm" href={`/paie?mois=${shiftPeriod(period, 1)}`}>
              {capitalize(periodLabel(shiftPeriod(period, 1)))} →
            </Link>
          </div>
        }
      />

      {month.partial && (
        <p className="alert" style={{ marginBottom: 12 }}>
          Mois en cours : seuls les créneaux déjà réalisés sont comptés ; les absences déjà saisies pour la fin du mois sont incluses.
        </p>
      )}
      <p className="small muted" style={{ marginBottom: 12 }}>
        Journée travaillée : jour où le salarié a été présent (état de fin de journée fait ou présence confirmée par un responsable). Tournée : créneau réalisé
        rattaché à une tournée. Un salarié qui fait deux tournées le même jour compte 1 journée et 2 tournées ; une journée de formation au dépôt compte 1 journée et 0 tournée.
      </p>
      {totals.unconfirmed > 0 && (
        <p className="alert alert-error" style={{ marginBottom: 12 }}>
          {totals.unconfirmed} journée{totals.unconfirmed > 1 ? 's' : ''} planifiée{totals.unconfirmed > 1 ? 's' : ''} sans présence confirmée : elles ne sont pas comptées. Confirmez la présence (ou déclarez
          l’absence) depuis le planning du jour concerné.
        </p>
      )}
      {month.missingPayrollId.length > 0 && (
        <p className="alert alert-error" style={{ marginBottom: 12 }}>
          {month.missingPayrollId.length} salarié{month.missingPayrollId.length > 1 ? 's' : ''} sans matricule de paie : leurs lignes seront refusées par le logiciel de paie.{' '}
          {month.missingPayrollId.map((m, i) => (
            <span key={m.employeeId}>
              {i > 0 && ', '}
              <Link href={`/personnel/${m.employeeId}/modifier`}>{m.name}</Link>
            </span>
          ))}
          .
        </p>
      )}

      <section className={styles.kpis} aria-label="Totaux du mois">
        <div className={styles.kpi}>
          <span className={styles.value}>{month.lines.length}</span>
          <span className={styles.label}>Salariés</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.value}>{totals.worked}</span>
          <span className={styles.label}>Jours travaillés</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.value}>{totals.routes}</span>
          <span className={styles.label}>Tournées</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.value}>{frNumber(Math.round(totals.hours * 100) / 100)}</span>
          <span className={styles.label}>Heures travaillées</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.value}>{totals.absences}</span>
          <span className={styles.label}>Jours d’absence</span>
        </div>
        {month.entries.size > 0 && (
          <>
            <div className={styles.kpi}>
              <span className={styles.value}>{euros(costs.gross)}</span>
              <span className={styles.label}>Masse salariale brute</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.value}>{euros(costs.employer)}</span>
              <span className={styles.label}>Coût employeur</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.value}>{paidRoutes > 0 ? euros(costs.employer / paidRoutes) : '·'}</span>
              <span className={styles.label}>Coût salarial par tournée</span>
            </div>
          </>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="section-title">Fichiers pour la paie</h2>
        </div>
        <div className="card-body stack">
          <div className={styles.files}>
            <div>
              <a className="btn btn-yellow" href={`/api/paie/import?mois=${period}`} download>
                Fichier d’import paie (CSV)
              </a>
              <p className="small muted">Une ligne par salarié et par rubrique, absences datées, avec vos codes rubriques. À importer dans Silae, PayFit, Sage, Cegid… ou à transmettre au cabinet.</p>
            </div>
            <div>
              <a className="btn" href={`/api/paie/recapitulatif?mois=${period}`} download>
                Récapitulatif pour le cabinet (CSV)
              </a>
              <p className="small muted">Une ligne par salarié, lisible dans Excel : jours, tournées, absences, retards, primes, détail des dates.</p>
            </div>
          </div>
          {exports.length > 0 ? (
            <p className="small muted">
              Derniers exports : {exports.slice(0, 3).map((e) => `${e.format === 'import' ? 'import' : 'récapitulatif'} le ${formatDateTime(e.created_at)} par ${e.actor}`).join(' ; ')}.
            </p>
          ) : (
            <p className="small muted">Aucun export pour ce mois.</p>
          )}
        </div>
      </section>

      <section className="card table-wrap" style={{ marginBottom: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Matricule</th>
              <th>Salarié</th>
              <th className="num">Jours trav.</th>
              <th className="num">Tournées</th>
              <th className="num">Heures</th>
              <th>Absences</th>
              <th className="num">Retards</th>
              <th>Éléments saisis</th>
              <th className="num">Coût employeur</th>
            </tr>
          </thead>
          <tbody>
            {month.lines.map((l) => {
              const mine = items.filter((i) => i.employee_id === l.employeeId);
              const entry = month.entries.get(l.employeeId);
              return (
                <tr key={l.employeeId} style={{ verticalAlign: 'top' }}>
                  <td className="mono">{l.payrollId ?? <span className="badge badge-red">Manquant</span>}</td>
                  <td>
                    <Link className="row-link" href={`/personnel/${l.employeeId}`}>
                      {l.lastName.toUpperCase()} {l.firstName}
                    </Link>
                    {l.km > 0 && <div className="small muted">{new Intl.NumberFormat('fr-FR').format(l.km)} km</div>}
                  </td>
                  <td className="num">{l.workedDays}</td>
                  <td className="num">{l.routes}</td>
                  <td className="num">{frNumber(l.hours)}</td>
                  <td>
                    {l.unconfirmedDays.length > 0 && (
                      <div className="small" style={{ marginBottom: 4 }}>
                        <span className="badge badge-yellow">À confirmer</span>{' '}
                        {l.unconfirmedDays.map((d) => (
                          <Link key={d} href={`/planning?jour=${d}`} style={{ marginRight: 4 }}>
                            {formatDate(d)}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className="stack-sm" style={{ gap: 4 }}>
                      {l.absencePeriods
                        .filter((p) => p.type !== 'retard')
                        .map((p) => (
                          <span key={`${p.type}-${p.start}`} className="small">
                            <span className={`badge ${p.type === 'absence_injustifiee' ? 'badge-red' : ''}`}>
                              {isPayrollVariable(p.type) ? variableInfo(p.type).label : p.type} {p.days} j
                            </span>{' '}
                            <span className="muted">
                              {formatDate(p.start)}
                              {p.end !== p.start ? ` au ${formatDate(p.end)}` : ''}
                            </span>
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="num">{l.lateCount || ''}</td>
                  <td>
                    <div className="stack-sm" style={{ gap: 4 }}>
                      {mine.map((i) => (
                        <div key={i.id} className={styles.item}>
                          <span className="small">
                            {isPayrollVariable(i.variable) ? variableInfo(i.variable).label : i.variable} :{' '}
                            <strong>
                              {isPayrollVariable(i.variable) && variableInfo(i.variable).unit === 'euros' ? `${frNumber(i.value)} €` : frNumber(i.value)}
                            </strong>
                            {i.note ? <span className="muted"> ({i.note})</span> : null}
                          </span>
                          {editable && (
                            <ActionForm action={deletePayrollItemAction} submitLabel="×" submitClassName={styles.remove} className={styles.inline} confirmMessage="Retirer cet élément ?">
                              <input type="hidden" name="itemId" value={i.id} />
                            </ActionForm>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="num">{entry ? euros(entry.employer_cost_cents) : <span className="muted">·</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {month.lines.length === 0 && <p className="empty">Aucun salarié présent ce mois-ci.</p>}
        <p className="small muted" style={{ padding: '10px 14px' }}>
          Jours travaillés : jours planifiés sans absence, et jours de prise de véhicule. Tournées : tournées du planning, ou à défaut prises de véhicule. Le temps de travail en heures reste celui de Mobilic ou du livret individuel de contrôle.
        </p>
      </section>

      {editable && (
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <section className="card">
            <div className="card-head">
              <h2 className="section-title">Ajouter un élément variable</h2>
            </div>
            <div className="card-body">
              <ActionForm action={addPayrollItemAction} submitLabel="Ajouter" resetOnSuccess>
                <input type="hidden" name="period" value={period} />
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="pi-emp">Salarié</label>
                    <select id="pi-emp" name="employeeId" className="input" required>
                      {month.lines.map((l) => (
                        <option key={l.employeeId} value={l.employeeId}>
                          {l.firstName} {l.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="pi-var">Élément</label>
                    <select id="pi-var" name="variable" className="input">
                      {MANUAL_VARIABLES.map((v) => (
                        <option key={v.key} value={v.key}>
                          {v.label} ({v.unit === 'euros' ? '€' : v.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="pi-value">Valeur</label>
                    <input id="pi-value" name="value" className="input" inputMode="decimal" placeholder="Ex. 150 ou 7,5" required />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="pi-note">Commentaire</label>
                  <input id="pi-note" name="note" className="input" placeholder="Ex. prime de performance du mois" />
                </div>
              </ActionForm>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="section-title">Importer le journal de paie</h2>
            </div>
            <div className="card-body stack">
              <p className="small">
                Après la paie, importez l’export de votre logiciel ou du cabinet : <code>matricule</code>, <code>brut</code>, <code>net</code> et <code>cout_employeur</code> (ou <code>charges_patronales</code>). La colonne <code>periode</code> est facultative : sans elle, les montants sont rattachés à {periodLabel(period)}.
              </p>
              <ImportForm action={importPayrollJournalAction} templateHref={`/api/modeles/journal-paie?mois=${period}`} templateLabel="Télécharger le modèle (vos salariés)">
                <input type="hidden" name="period" value={period} />
              </ImportForm>
            </div>
          </section>
        </div>
      )}

      {editable && (
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Codes rubriques du logiciel de paie</h2>
          </div>
          <div className="card-body">
            <details className="disclosure">
              <summary>Adapter les codes à votre logiciel de paie ou à votre cabinet</summary>
              <p className="small muted" style={{ margin: '8px 0 12px' }}>
                Les codes par défaut sont génériques. Remplacez-les par les codes rubriques ou codes d’absence de votre logiciel (votre gestionnaire de paie vous les communique) : le fichier d’import sera alors directement reconnu.
              </p>
              <ActionForm action={savePayrollCodesAction} submitLabel="Enregistrer les codes">
                <div className="form-grid">
                  {PAYROLL_VARIABLES.map((v) => (
                    <div key={v.key} className="field">
                      <label htmlFor={`code-${v.key}`}>
                        {v.label}
                        {ABSENCE_VARIABLES.some((a) => a.key === v.key) && v.key !== 'retard' ? ' (absence datée)' : ''}
                      </label>
                      <input id={`code-${v.key}`} name={`code_${v.key}`} className="input mono" defaultValue={codes[v.key]} maxLength={20} required />
                    </div>
                  ))}
                </div>
              </ActionForm>
            </details>
          </div>
        </section>
      )}
    </>
  );
}
