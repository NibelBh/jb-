import Link from 'next/link';
import { LogoMark } from './LogoMark';
import styles from './Logo.module.css';

export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <Link href="/" className={styles.logo} data-tone={tone} aria-label="Tigerz, retour à l’accueil">
      <LogoMark className={styles.mark} />
      <span className={styles.word} aria-hidden="true">
        Tiger<span className={styles.z}>z</span>
      </span>
    </Link>
  );
}
