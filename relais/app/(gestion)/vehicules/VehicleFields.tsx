import type { VehicleRow } from '@/lib/data/vehicles';
import { ENERGIES, VEHICLE_TYPES } from '@/lib/domain/labels';

export function VehicleFields({ vehicle }: { vehicle?: VehicleRow }) {
  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="plate">Immatriculation</label>
          <input id="plate" name="plate" className="input mono" defaultValue={vehicle?.plate} placeholder="AB-123-CD" required />
        </div>
        <div className="field">
          <label htmlFor="vin">VIN</label>
          <input id="vin" name="vin" className="input mono" defaultValue={vehicle?.vin ?? ''} maxLength={17} />
        </div>
        <div className="field">
          <label htmlFor="brand">Marque</label>
          <input id="brand" name="brand" className="input" defaultValue={vehicle?.brand ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="model">Modèle</label>
          <input id="model" name="model" className="input" defaultValue={vehicle?.model ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="year">Année</label>
          <input id="year" name="year" type="number" className="input" defaultValue={vehicle?.year ?? ''} min={1990} max={2100} />
        </div>
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" className="input" defaultValue={vehicle?.type ?? 'fourgon'}>
            {VEHICLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="energy">Énergie</label>
          <select id="energy" name="energy" className="input" defaultValue={vehicle?.energy ?? 'diesel'}>
            {ENERGIES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="first_registration_on">Première immatriculation</label>
          <input id="first_registration_on" name="first_registration_on" type="date" className="input" defaultValue={vehicle?.first_registration_on ?? ''} />
          <span className="hint">Sert à calculer l’échéance du contrôle technique.</span>
        </div>
        <div className="field">
          <label htmlFor="initial_km">Kilométrage à l’entrée dans la flotte</label>
          <input id="initial_km" name="initial_km" type="number" min={0} className="input" defaultValue={vehicle?.initial_km ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="owner">Propriétaire ou loueur</label>
          <input id="owner" name="owner" className="input" defaultValue={vehicle?.owner ?? ''} />
        </div>
      </div>

      <fieldset className="form-grid" style={{ border: '1px solid var(--grey-200)', borderRadius: 8, padding: 14 }}>
        <legend className="small" style={{ fontWeight: 800, padding: '0 6px' }}>
          Assurance
        </legend>
        <div className="field">
          <label htmlFor="insurer">Assureur</label>
          <input id="insurer" name="insurer" className="input" defaultValue={vehicle?.insurer ?? ''} placeholder="Ex. AXA Flotte" />
        </div>
        <div className="field">
          <label htmlFor="insurance_policy">N° de contrat</label>
          <input id="insurance_policy" name="insurance_policy" className="input mono" defaultValue={vehicle?.insurance_policy ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="insurance_start_on">Date de début</label>
          <input id="insurance_start_on" name="insurance_start_on" type="date" className="input" defaultValue={vehicle?.insurance_start_on ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="insurance_end_on">Date d’échéance</label>
          <input id="insurance_end_on" name="insurance_end_on" type="date" className="input" defaultValue={vehicle?.insurance_end_on ?? ''} />
          <span className="hint">Assurance expirée : le véhicule ne peut plus être planifié ni pris.</span>
        </div>
      </fieldset>

      <fieldset className="form-grid" style={{ border: '1px solid var(--grey-200)', borderRadius: 8, padding: 14 }}>
        <legend className="small" style={{ fontWeight: 800, padding: '0 6px' }}>
          Contrôle technique
        </legend>
        <div className="field">
          <label htmlFor="ct_last_on">Date du dernier contrôle</label>
          <input id="ct_last_on" name="ct_last_on" type="date" className="input" defaultValue={vehicle?.ct_last_on ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="ct_expires_on">Date d’échéance</label>
          <input id="ct_expires_on" name="ct_expires_on" type="date" className="input" defaultValue={vehicle?.ct_expires_on ?? ''} />
          <span className="hint">Vide : calculée depuis la première immatriculation (4 ans) ou le dernier contrôle (2 ans).</span>
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" className="input" defaultValue={vehicle?.notes ?? ''} />
      </div>
    </>
  );
}
