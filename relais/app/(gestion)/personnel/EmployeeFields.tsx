import type { EmployeeRow } from '@/lib/data/employees';
import { CONTRACT_TYPES, EMPLOYEE_STATUSES, POSITIONS } from '@/lib/domain/labels';

const CATEGORIES = ['AM', 'A', 'B', 'BE', 'B96', 'C1', 'C', 'CE', 'D'];

export function EmployeeFields({ employee }: { employee?: EmployeeRow }) {
  const cats = new Set((employee?.licence_categories ?? 'B').split(',').filter(Boolean));
  return (
    <>
      <fieldset className="form-grid fieldset">
        <legend>Informations personnelles
        </legend>
        <div className="field">
          <label htmlFor="first_name">Prénom</label>
          <input id="first_name" name="first_name" className="input" defaultValue={employee?.first_name} required />
        </div>
        <div className="field">
          <label htmlFor="last_name">Nom</label>
          <input id="last_name" name="last_name" className="input" defaultValue={employee?.last_name} required />
        </div>
        <div className="field">
          <label htmlFor="birth_date">Date de naissance</label>
          <input id="birth_date" name="birth_date" type="date" className="input" defaultValue={employee?.birth_date ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="birth_place">Lieu de naissance</label>
          <input id="birth_place" name="birth_place" className="input" defaultValue={employee?.birth_place ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="nationality">Nationalité</label>
          <input id="nationality" name="nationality" className="input" defaultValue={employee?.nationality ?? ''} />
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
          <label htmlFor="address">Adresse</label>
          <input id="address" name="address" className="input" defaultValue={employee?.address ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="postal_code">Code postal</label>
          <input id="postal_code" name="postal_code" className="input" defaultValue={employee?.postal_code ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="city">Ville</label>
          <input id="city" name="city" className="input" defaultValue={employee?.city ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="emergency_name">Personne à prévenir</label>
          <input id="emergency_name" name="emergency_name" className="input" defaultValue={employee?.emergency_name ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="emergency_phone">Téléphone d’urgence</label>
          <input id="emergency_phone" name="emergency_phone" type="tel" className="input" defaultValue={employee?.emergency_phone ?? ''} />
        </div>
      </fieldset>

      <fieldset className="form-grid fieldset">
        <legend>Poste et contrat
        </legend>
        <div className="field">
          <label htmlFor="payroll_id">Matricule paie</label>
          <input id="payroll_id" name="payroll_id" className="input mono" defaultValue={employee?.payroll_id ?? ''} />
          <span className="hint">Le même que dans votre logiciel de paie : il sert aux fichiers de paie.</span>
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
          <label htmlFor="hired_on">Date d’arrivée (embauche)</label>
          <input id="hired_on" name="hired_on" type="date" className="input" defaultValue={employee?.hired_on ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="left_on">Date de sortie</label>
          <input id="left_on" name="left_on" type="date" className="input" defaultValue={employee?.left_on ?? ''} />
        </div>
      </fieldset>

      <fieldset className="form-grid fieldset">
        <legend>Permis de conduire
        </legend>
        <div className="field">
          <label htmlFor="licence_number">Numéro</label>
          <input id="licence_number" name="licence_number" className="input mono" defaultValue={employee?.licence_number ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="licence_issued_on">Date d’obtention</label>
          <input id="licence_issued_on" name="licence_issued_on" type="date" className="input" defaultValue={employee?.licence_issued_on ?? ''} />
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
        <span className="hint" style={{ gridColumn: '1 / -1' }}>
          Arrêts maladie, accidents du travail, formations, congés et autres situations se déclarent sur la fiche du salarié : ils rendent le salarié indisponible au planning.
        </span>
      </fieldset>

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" className="input" defaultValue={employee?.notes ?? ''} />
        <span className="hint">Informations utiles à l’exploitation uniquement. Aucune donnée de santé.</span>
      </div>
    </>
  );
}
