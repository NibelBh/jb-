export type FineDefaults = {
  vehicleId?: number;
  noticeNumber?: string | null;
  offenseDay?: string;
  offenseTime?: string;
  noticeSentOn?: string;
  amount?: string;
  location?: string | null;
  description?: string | null;
  hasNotice?: boolean;
};

/** Champs d'un avis de contravention, communs à la création et à la modification. */
export function FineFields({ vehicles, today, defaults }: { vehicles: { id: number; plate: string }[]; today: string; defaults: FineDefaults }) {
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
              <label htmlFor="noticeNumber">Numéro de l’avis</label>
              <input id="noticeNumber" name="noticeNumber" className="input mono" defaultValue={defaults.noticeNumber ?? ''} />
            </div>
            <div className="field">
              <label htmlFor="offenseDay">Date de l’infraction</label>
              <input id="offenseDay" name="offenseDay" type="date" className="input" max={today} defaultValue={defaults.offenseDay ?? ''} required />
            </div>
            <div className="field">
              <label htmlFor="offenseTime">Heure de l’infraction</label>
              <input id="offenseTime" name="offenseTime" type="time" className="input" defaultValue={defaults.offenseTime ?? ''} required />
            </div>
            <div className="field">
              <label htmlFor="noticeSentOn">Date d’envoi de l’avis</label>
              <input id="noticeSentOn" name="noticeSentOn" type="date" className="input" max={today} defaultValue={defaults.noticeSentOn ?? ''} required />
              <span className="hint">Le délai de 45 jours court à partir de cette date.</span>
            </div>
            <div className="field">
              <label htmlFor="amount">Montant (€)</label>
              <input id="amount" name="amount" className="input" inputMode="decimal" defaultValue={defaults.amount ?? ''} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="location">Lieu</label>
            <input id="location" name="location" className="input" defaultValue={defaults.location ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="description">Nature de l’infraction</label>
            <input id="description" name="description" className="input" defaultValue={defaults.description ?? ''} placeholder="Ex. excès de vitesse inférieur à 20 km/h" />
          </div>
          <div className="field">
            <label htmlFor="notice">{defaults.hasNotice ? 'Remplacer le scan de l’avis' : 'Scan ou photo de l’avis'}</label>
            <input id="notice" name="notice" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="input" />
          </div>
    </>
  );
}
