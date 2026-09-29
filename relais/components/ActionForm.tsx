'use client';

import { type ReactNode, startTransition, useActionState, useEffect, useRef } from 'react';
import type { FormState } from '@/lib/forms';

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  submitClassName?: string;
  className?: string;
  confirmMessage?: string;
  resetOnSuccess?: boolean;
  /** Contenu affiché quand le serveur demande une confirmation (ex. kilométrage inhabituel). */
  confirmation?: ReactNode;
};

/**
 * Formulaire relié à une Server Action : affiche l'erreur ou le succès renvoyé,
 * désactive le bouton pendant l'envoi et demande confirmation si besoin.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = 'Enregistrement…',
  submitClassName = 'btn btn-yellow',
  className = 'form',
  confirmMessage,
  resetOnSuccess = false,
  confirmation,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(event) => {
        // Envoi manuel : React ne vide pas le formulaire, la saisie reste en place si le serveur renvoie une erreur.
        event.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {state?.needsConfirmation && confirmation}
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
        <ul className="small" style={{ margin: 0, paddingLeft: 18, maxHeight: 200, overflowY: 'auto' }}>
          {state.details.map((d, i) => (
            <li key={`${i}-${d}`}>{d}</li>
          ))}
        </ul>
      )}
      <div className="btn-row">
        <button type="submit" className={submitClassName} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
