import type { EmployeeRow } from '@/lib/data/employees';
import { CONTRACT_TYPES, EMPLOYEE_STATUSES, POSITIONS } from '@/lib/domain/labels';

const CATEGORIES = ['B', 'BE', 'C1', 'C', 'CE', 'D'];

export function EmployeeFields({ employee }: { employee?: EmployeeRow }) {
  const cats = new Set((employee?.licence_categories ?? 'B').split(',').filter(Boolean));
  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="first_name">Prénom</label>
          <input id="first_name" name="first_name" className="input" defaultValue={employee?.first_name} required />
        </div>
        <div className="field">
          <label htmlFor="last_name">Nom</label>
          <input id="last_name" name="last_name" className="input" defaultValue={employee?.last_name} required />
        </div>
        <div className="field">
          <label htmlFor="phone">Téléphone</label>
          <input id="phone" name="phone" type="tel" className="input" defaultValue={employee?.phone ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" className="input" defaultValue={employee?.email ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="position">Poste</label>
          <select id="position" name="position" className="input" defaultValue={employee?.position ?? 'chauffeur'}>
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="contract_type">Contrat</label>
          <select id="contract_type" name="contract_type" className="input" defaultValue={employee?.contract_type ?? ''}>
            <option value="">Non renseigné</option>
            {CONTRACT_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Statut</label>
          <select id="status" name="status" className="input" defaultValue={employee?.status ?? 'actif'}>
            {EMPLOYEE_STATUSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="hint">« Sorti » coupe immédiatement l’accès à l’application.</span>
        </div>
        <div className="field">
          <label htmlFor="hired_on">Date d’embauche</label>
          <input id="hired_on" name="hired_on" type="date" className="input" defaultValue={employee?.hired_on ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="left_on">Date de sortie</label>
          <input id="left_on" name="left_on" type="date" className="input" defaultValue={employee?.left_on ?? ''} />
        </div>
      </div>

      <fieldset className="form-grid" style={{ border: '1px solid var(--grey-200)', borderRadius: 8, padding: 14 }}>
        <legend className="small" style={{ fontWeight: 800, padding: '0 6px' }}>
          Permis de conduire
        </legend>
        <div className="field">
          <label htmlFor="licence_number">Numéro</label>
          <input id="licence_number" name="licence_number" className="input mono" defaultValue={employee?.licence_number ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="licence_expires_on">Date de fin de validité</label>
          <input id="licence_expires_on" name="licence_expires_on" type="date" className="input" defaultValue={employee?.licence_expires_on ?? ''} />
        </div>
        <div className="field">
          <span className="label">Catégories</span>
          <div className="btn-row">
            {CATEGORIES.map((c) => (
              <label key={c} className="checkbox">
                <input type="checkbox" name="licence_categories" value={c} defaultChecked={cats.has(c)} /> {c}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" className="input" defaultValue={employee?.notes ?? ''} />
        <span className="hint">Informations utiles à l’exploitation uniquement. Aucune donnée de santé.</span>
      </div>
    </>
  );
}
