import Link from 'next/link';
import { LogoMark } from '@/components/brand/LogoMark';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <section className="section">
      <div className={`container-narrow ${styles.box}`}>
        <LogoMark className={styles.mark} />
        <p className="eyebrow">Erreur 404</p>
        <h1>Ce chat s’est caché</h1>
        <p className="lead">La page que vous cherchez n’existe pas ou a été déplacée.</p>
        <div className={styles.actions}>
          <Link href="/" className="btn btn-primary">
            Retour à l’accueil
          </Link>
          <Link href="/boutique" className="btn btn-secondary">
            Voir la boutique
          </Link>
        </div>
      </div>
    </section>
  );
}
