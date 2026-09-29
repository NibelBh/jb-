'use client';

import { startTransition, useActionState, useState } from 'react';
import { PhotoInput } from '@/components/PhotoInput';
import { ZonePicker } from '@/components/ZonePicker';
import { DAMAGE_TYPES } from '@/lib/domain/labels';
import type { FormState } from '@/lib/forms';
import styles from './inspection.module.css';
import report from './report.module.css';

export function ReportForm({
  action,
  vehicles,
  defaultVehicleId,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  vehicles: { id: number; plate: string }[];
  defaultVehicleId?: number;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [type, setType] = useState<string>('');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'error'>('idle');

  function locate() {
    if (!('geolocation' in navigator)) {
      setLocating('error');
      return;
    }
    setLocating('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: Number(p.coords.latitude.toFixed(5)), lng: Number(p.coords.longitude.toFixed(5)) });
        setLocating('idle');
      },
      () => setLocating('error'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <form
      className={styles.form}
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {type === 'accident' && (
        <div className={report.safety} role="note">
          <strong>D’abord la sécurité</strong>
          <ol>
            <li>Allumez les feux de détresse, mettez le gilet.</li>
            <li>Blessé ? Appelez le 112.</li>
            <li>Remplissez le constat amiable avec l’autre conducteur et photographiez-le.</li>
          </ol>
        </div>
      )}

      <fieldset className={styles.block}>
        <legend>1. Quel problème ?</legend>
        <div className={report.types} role="radiogroup" aria-label="Type de problème">
          {DAMAGE_TYPES.map((t) => (
            <label key={t.value} className={`${report.type} ${type === t.value ? (t.value === 'accident' ? report.onRed : report.on) : ''}`}>
              <input type="radio" name="type" value={t.value} required checked={type === t.value} onChange={() => setType(t.value)} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.block}>
        <legend>2. Véhicule</legend>
        <select name="vehicleId" className="input" defaultValue={defaultVehicleId ?? ''} required aria-label="Véhicule concerné">
          <option value="">Choisir…</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className={styles.block}>
        <legend>3. Où sur le véhicule ?</legend>
        <p className={styles.help}>Touchez les zones concernées (facultatif pour une panne mécanique).</p>
        <ZonePicker />
      </fieldset>

      <fieldset className={styles.block}>
        <legend>4. Photos</legend>
        <PhotoInput name="photos" label="Prendre des photos" multiple />
      </fieldset>

      <fieldset className={styles.block}>
        <legend>5. Que s’est-il passé ?</legend>
        <textarea name="description" className="input" rows={3} required aria-label="Description" placeholder="Ex. rétroviseur droit cassé en passant entre deux camions" />
        {type === 'accident' && (
          <label className="checkbox">
            <input type="checkbox" name="injured" /> Quelqu’un est blessé
          </label>
        )}
        <input type="hidden" name="latitude" value={position?.lat ?? ''} />
        <input type="hidden" name="longitude" value={position?.lng ?? ''} />
        <button type="button" className="btn btn-ghost" onClick={locate} disabled={locating === 'busy'}>
          {position ? 'Position enregistrée ✓' : locating === 'busy' ? 'Localisation…' : 'Ajouter ma position (facultatif)'}
        </button>
        {locating === 'error' && <p className="small muted">Position indisponible. Précisez le lieu dans la description.</p>}
        <p className="small muted">La position n’est prise qu’à ce moment, uniquement si vous appuyez sur le bouton.</p>
      </fieldset>

      {state?.error && (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Envoi…' : 'Envoyer le signalement'}
      </button>
    </form>
  );
}
