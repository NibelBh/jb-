import { deleteAbsenceAction, updateAbsenceAction } from '@/app/(gestion)/planning/actions';
import { ActionForm } from '@/components/ActionForm';
import { ABSENCE_TYPES } from '@/lib/domain/labels';

/** « Modifier » (type, dates, commentaire) et « Retirer » pour une absence enregistrée. */
export function AbsenceActions({ absence }: { absence: { id: number; type: string; start_on: string; end_on: string; note: string | null } }) {
  const p = `abs-${absence.id}`;
  return (
    <details className="disclosure small">
      <summary>Modifier</summary>
      <ActionForm action={updateAbsenceAction} submitLabel="Enregistrer" submitClassName="btn btn-sm">
        <input type="hidden" name="absenceId" value={absence.id} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${p}-type`}>Type</label>
            <select id={`${p}-type`} name="type" className="input" defaultValue={absence.type}>
              {ABSENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${p}-start`}>Du</label>
            <input id={`${p}-start`} name="startOn" type="date" className="input" defaultValue={absence.start_on} required />
          </div>
          <div className="field">
            <label htmlFor={`${p}-end`}>Au</label>
            <input id={`${p}-end`} name="endOn" type="date" className="input" defaultValue={absence.end_on} />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${p}-note`}>Commentaire</label>
          <input id={`${p}-note`} name="note" className="input" defaultValue={absence.note ?? ''} />
        </div>
      </ActionForm>
      <ActionForm action={deleteAbsenceAction} submitLabel="Retirer cette absence" submitClassName="btn btn-danger btn-sm" className="btn-row" confirmMessage="Retirer cette absence ? Les créneaux déjà libérés restent à pourvoir.">
        <input type="hidden" name="absenceId" value={absence.id} />
      </ActionForm>
    </details>
  );
}
