'use client';

import Link from 'next/link';
import styles from './not-found.module.css';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="section">
      <div className={`container-narrow ${styles.box}`}>
        <p className="eyebrow">Oups</p>
        <h1>Une erreur est survenue</h1>
        <p className="lead">Le chargement de la page a échoué. Réessayez dans un instant.</p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={reset}>
            Réessayer
          </button>
          <Link href="/" className="btn btn-secondary">
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </section>
  );
}
