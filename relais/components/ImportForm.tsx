'use client';

import { type ReactNode, startTransition, useActionState, useId } from 'react';
import type { FormState } from '@/lib/forms';

/**
 * Formulaire d'import en deux temps : « Vérifier » simule l'import et affiche le rapport
 * sans rien enregistrer, « Importer » l'exécute. Le fichier choisi reste en place entre les deux.
 */
export function ImportForm({
  action,
  children,
  templateHref,
  templateLabel = 'Télécharger le modèle',
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children?: ReactNode;
  templateHref?: string;
  templateLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const id = useId();

  return (
    <form
      className="form"
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const data = new FormData(event.currentTarget, submitter);
        if (data.get('mode') === 'importer' && !state?.verified && !window.confirm('Importer sans vérification préalable ?')) return;
        startTransition(() => formAction(data));
      }}
    >
      {children}
      <div className="field">
        <label htmlFor={`${id}-file`}>Fichier CSV (séparateur ; ou ,)</label>
        <input id={`${id}-file`} name="file" type="file" accept=".csv,text/csv,text/plain" className="input" />
        <span className="hint">
          Depuis Excel : Fichier, Enregistrer sous, « CSV (séparateur : point-virgule) ». Les accents sont conservés.
          {templateHref && (
            <>
              {' '}
              <a href={templateHref} download>
                {templateLabel}
              </a>
              .
            </>
          )}
        </span>
      </div>
      <details className="disclosure">
        <summary>Ou coller le contenu</summary>
        <textarea name="csv" className="input" rows={5} aria-label="Contenu CSV" style={{ marginTop: 8 }} />
      </details>

      {state?.error && (
        <p className="alert alert-error" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="alert alert-ok" role="status">
          {state.ok}
        </p>
      )}
      {state?.details && state.details.length > 0 && (
        <ul className="small" style={{ margin: 0, paddingLeft: 18, maxHeight: 220, overflowY: 'auto' }}>
          {state.details.map((d, i) => (
            <li key={`${i}-${d}`}>{d}</li>
          ))}
        </ul>
      )}

      <div className="btn-row">
        <button type="submit" name="mode" value="verifier" className="btn btn-ghost" disabled={pending}>
          {pending ? 'Traitement…' : 'Vérifier le fichier'}
        </button>
        <button type="submit" name="mode" value="importer" className={state?.verified ? 'btn btn-yellow' : 'btn'} disabled={pending}>
          Importer
        </button>
      </div>
    </form>
  );
}
