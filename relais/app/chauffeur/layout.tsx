import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { requireDriver } from '@/lib/auth';
import { isManager } from '@/lib/domain/roles';
import { logoutAction } from '../connexion/actions';
import styles from './driver.module.css';

export default async function DriverLayout({ children }: LayoutProps<'/chauffeur'>) {
  const ctx = await requireDriver();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/chauffeur" aria-label="Accueil chauffeur">
          <Logo inverted size={20} />
        </Link>
        <div className={styles.headRight}>
          {isManager(ctx.roles) && (
            <Link href="/aujourdhui" className={styles.headLink}>
              Back-office
            </Link>
          )}
          <form action={logoutAction}>
            <button type="submit" className={styles.headLink}>
              Quitter
            </button>
          </form>
        </div>
      </header>
      <div className={styles.speed} aria-hidden="true" />
      <main id="contenu" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
