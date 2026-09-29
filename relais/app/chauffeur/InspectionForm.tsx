'use client';

import { startTransition, useActionState, useState } from 'react';
import { PhotoInput } from '@/components/PhotoInput';
import { CHECKLIST, type ItemResult, REQUIRED_PHOTOS } from '@/lib/domain/inspection';
import type { FormState } from '@/lib/forms';
import styles from './inspection.module.css';

const CHOICES: { value: ItemResult; label: string }[] = [
  { value: 'ok', label: 'OK' },
  { value: 'mineur', label: 'À surveiller' },
  { value: 'bloquant', label: 'Bloquant' },
];

/**
 * Inspection en trois blocs : photos, kilométrage, points de contrôle.
 * Tout est « OK » par défaut : le chauffeur ne touche que ce qui pose problème.
 */
export function InspectionForm({
  action,
  vehicleId,
  lastKm,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  vehicleId?: number;
  lastKm: number;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [results, setResults] = useState<Record<string, ItemResult>>(() => Object.fromEntries(CHECKLIST.map((c) => [c.key, 'ok'])));
  const problems = Object.values(results).filter((r) => r !== 'ok').length;
  const blocking = Object.values(results).includes('bloquant');

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
      {vehicleId && <input type="hidden" name="vehicleId" value={vehicleId} />}

      <fieldset className={styles.block}>
        <legend>1. Photos du véhicule</legend>
        <p className={styles.help}>Les photos datées prouvent l’état du véhicule quand vous le prenez ou le rendez.</p>
        <div className={styles.photos}>
          {REQUIRED_PHOTOS.map((p) => (
            <PhotoInput key={p.key} name={`photo_${p.key}`} label={p.label} required />
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.block}>
        <legend>2. Kilométrage</legend>
        <label htmlFor="odometer" className={styles.help}>
          Relevé au compteur (dernier connu : {new Intl.NumberFormat('fr-FR').format(lastKm)} km)
        </label>
        <input id="odometer" name="odometer" type="number" inputMode="numeric" min={0} className={`input ${styles.km}`} required />
        {state?.needsConfirmation && (
          <label className="checkbox">
            <input type="checkbox" name="confirmOdometer" /> Je confirme ce kilométrage
          </label>
        )}
      </fieldset>

      <fieldset className={styles.block}>
        <legend>3. Contrôles</legend>
        <ul className={styles.items}>
          {CHECKLIST.map((item) => (
            <li key={item.key} className={styles.item}>
              <span className={styles.itemLabel}>{item.label}</span>
              <div className={styles.choices} role="radiogroup" aria-label={item.label}>
                {CHOICES.map((c) => (
                  <label key={c.value} className={`${styles.choice} ${results[item.key] === c.value ? styles[`on_${c.value}`] : ''}`}>
                    <input
                      type="radio"
                      name={`item_${item.key}`}
                      value={c.value}
                      checked={results[item.key] === c.value}
                      onChange={() => setResults((r) => ({ ...r, [item.key]: c.value }))}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              {results[item.key] !== 'ok' && (
                <input name={`note_${item.key}`} className="input" placeholder="Précisez (ex. pneu avant droit sous-gonflé)" aria-label={`Précision : ${item.label}`} />
              )}
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="field">
        <label htmlFor="comment" className={styles.help}>
          Commentaire (facultatif)
        </label>
        <textarea id="comment" name="comment" className="input" rows={2} />
      </div>

      {blocking && <p className="alert alert-error">Un problème bloquant sera signalé : le véhicule restera au dépôt jusqu’à la décision de votre responsable.</p>}
      {state?.error && (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Envoi des photos…' : problems ? `${submitLabel} (${problems} problème${problems > 1 ? 's' : ''})` : submitLabel}
      </button>
    </form>
  );
}
