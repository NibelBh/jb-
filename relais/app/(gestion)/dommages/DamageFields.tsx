import { ZonePicker } from '@/components/ZonePicker';
import { DAMAGE_TYPES, SEVERITIES } from '@/lib/domain/labels';

export type DamageDefaults = {
  vehicleId?: number | null;
  employeeId?: number | null;
  type?: string;
  severity?: string;
  day: string;
  time: string;
  zones?: string[];
  location?: string | null;
  description?: string;
};

/** Champs d'un dossier dommage, communs à la création et à la modification. */
export function DamageFields({
  vehicles,
  drivers,
  defaults,
}: {
  vehicles: { id: number; plate: string }[];
  drivers: { id: number; first_name: string; last_name: string }[];
  defaults: DamageDefaults;
}) {
  return (
    <>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="vehicleId">Véhicule</label>
              <select id="vehicleId" name="vehicleId" className="input" defaultValue={defaults.vehicleId ?? ''} required>
                <option value="">Choisir…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="employeeId">Chauffeur concerné</label>
              <select id="employeeId" name="employeeId" className="input" defaultValue={defaults.employeeId ?? ''}>
                <option value="">Inconnu ou aucun</option>
                {drivers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="type">Type</label>
              <select id="type" name="type" className="input" defaultValue={defaults.type ?? 'autre'}>
                {DAMAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="severity">Gravité</label>
              <select id="severity" name="severity" className="input" defaultValue={defaults.severity ?? 'moyen'}>
                {SEVERITIES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="day">Date du constat</label>
              <input id="day" name="day" type="date" className="input" defaultValue={defaults.day} required />
            </div>
            <div className="field">
              <label htmlFor="time">Heure</label>
              <input id="time" name="time" type="time" className="input" defaultValue={defaults.time} required />
            </div>
          </div>
          <div className="field">
            <span className="label">Localisation sur le véhicule</span>
            <ZonePicker defaultValue={defaults.zones ?? []} />
          </div>
          <div className="field">
            <label htmlFor="location">Lieu</label>
            <input id="location" name="location" className="input" defaultValue={defaults.location ?? ''} placeholder="Ex. parking du dépôt, rue de la République" />
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" className="input" defaultValue={defaults.description ?? ''} required />
          </div>
    </>
  );
}
