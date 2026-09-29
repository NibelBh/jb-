import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { dayBoard, replacementCandidates } from '@/lib/data/planning';
import { formatLongDate } from '@/lib/domain/dates';
import { formatRange } from '@/lib/domain/shifts';
import { can } from '@/lib/domain/roles';
import { reassignShiftAction } from '../actions';

export const metadata: Metadata = { title: 'Remplacement' };

export default async function ReplacementPage(props: PageProps<'/planning/remplacement'>) {
  const ctx = await requireModule('planning');
  const params = await props.searchParams;
  const shiftId = Number(params.creneau);
  if (!Number.isInteger(shiftId)) notFound();

  const db = getDb();
  const result = replacementCandidates(db, ctx.orgId, shiftId);
  if (!result) notFound();
  const day = result.shift.day;
  const boardRoute = dayBoard(db, ctx.orgId, day).shifts.find((r) => r.id === shiftId);
  const editable = can(ctx.roles, 'planning.modifier');

  return (
    <>
      <PageHeader
        title={`${result.shift.employee_id ? 'Remplacer' : 'Affecter'} : ${result.shift.route_name ? `tournée ${result.shift.route_name}, ` : ''}${formatRange(result.shift.start_time, result.shift.end_time)}`}
        subtitle={`${formatLongDate(day)}${boardRoute?.employee_name ? `. Prévu : ${boardRoute.employee_name}` : ''}${boardRoute?.issues.length ? ` (${boardRoute.issues.join(', ')})` : ''}.`}
        back={{ href: `/planning?jour=${day}`, label: 'Planning du jour' }}
      />

      <p className="alert" style={{ marginBottom: 16 }}>
        Le classement privilégie les chauffeurs libres ce jour (sans chevauchement d’horaires), qui connaissent la tournée et qui ont le moins travaillé cette semaine. Vous choisissez : rien n’est affecté automatiquement.
      </p>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2 className="section-title">Remplaçants possibles</h2>
          <span className="small muted">{result.ranked.length} candidat{result.ranked.length > 1 ? 's' : ''}</span>
        </div>
        {result.ranked.length === 0 ? (
          <p className="empty">Aucun chauffeur disponible, avec un permis valide et libre sur ces horaires.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Chauffeur</th>
                  <th>Pourquoi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.ranked.map((c, index) => (
                  <tr key={c.employeeId}>
                    <td className="mono">{index + 1}</td>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>
                      <div className="btn-row">
                        {c.reasons.map((r) => (
                          <span key={r} className={`badge ${r === 'Libre ce jour' ? 'badge-yellow' : r === 'Connaît la tournée' ? 'badge-black' : ''}`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="nowrap">
                      {editable && (
                        <ActionForm action={reassignShiftAction} submitLabel="Affecter" submitClassName={index === 0 ? 'btn btn-yellow btn-sm' : 'btn btn-sm'} className="btn-row">
                          <input type="hidden" name="shiftId" value={result.shift.id} />
                          <input type="hidden" name="day" value={day} />
                          <input type="hidden" name="employeeId" value={c.employeeId} />
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

      {result.excluded.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2 className="section-title">Écartés</h2>
          </div>
          <ul className="card-body stack-sm" style={{ margin: 0, listStyle: 'none' }}>
            {result.excluded.map((e) => (
              <li key={e.employeeId}>
                <strong>{e.name}</strong> <span className="muted">: {e.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
