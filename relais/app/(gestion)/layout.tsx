import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { unreadCount } from '@/lib/data/notifications';
import { type Module, canAccess, isManager, roleLabel } from '@/lib/domain/roles';
import { logoutAction } from '../connexion/actions';
import { SideNav } from './SideNav';
import styles from './layout.module.css';

const NAV: { module: Module; href: string; label: string }[] = [
  { module: 'aujourdhui', href: '/aujourdhui', label: 'Aujourd’hui' },
  { module: 'planning', href: '/planning', label: 'Planning' },
  { module: 'vehicules', href: '/vehicules', label: 'Véhicules' },
  { module: 'personnel', href: '/personnel', label: 'Personnel' },
  { module: 'dommages', href: '/dommages', label: 'Dommages' },
  { module: 'amendes', href: '/amendes', label: 'Amendes' },
  { module: 'documents', href: '/documents', label: 'Documents' },
  { module: 'journal', href: '/journal', label: 'Journal' },
  { module: 'parametres', href: '/parametres', label: 'Paramètres' },
];

export default async function GestionLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSession();
  if (!ctx) redirect('/connexion');
  if (!isManager(ctx.roles)) redirect('/chauffeur');

  const items = NAV.filter((n) => canAccess(ctx.roles, n.module)).map(({ href, label }) => ({ href, label }));
  const unread = unreadCount(getDb(), ctx);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Link href="/" aria-label="Accueil">
            <Logo inverted />
          </Link>
        </div>
        <p className={styles.org}>{ctx.orgName}</p>
        <SideNav items={items} />
        <div className={styles.sideFoot}>
          {ctx.employeeId !== null && (
            <Link href="/chauffeur" className={styles.driverLink}>
              Application chauffeur
            </Link>
          )}
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.stripes} aria-hidden="true" />
          <div className={styles.user}>
            <Link href="/notifications" className={styles.bell} aria-label={`Notifications, ${unread} non lue${unread > 1 ? 's' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
              {unread > 0 && <span className={styles.count}>{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <div className={styles.who}>
              <strong>{ctx.name}</strong>
              <span className="small muted">{ctx.roles.map(roleLabel).join(', ')}</span>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-ghost btn-sm">
                Déconnexion
              </button>
            </form>
          </div>
        </header>
        <main id="contenu" className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
