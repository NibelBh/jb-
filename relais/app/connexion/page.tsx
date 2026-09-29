import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { Logo } from '@/components/Logo';
import { getSession, homeFor } from '@/lib/auth';
import { APP_TAGLINE } from '@/lib/config';
import { DEMO_DRIVER_CODE, DEMO_PASSWORD } from '@/lib/db/seed';
import { loginAction } from './actions';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage() {
  const ctx = await getSession();
  if (ctx) redirect(homeFor(ctx));
  const demo = process.env.RELAIS_DEMO !== '0';

  return (
    <main id="contenu" className={styles.page}>
      <section className={styles.brand}>
        <Logo size={34} inverted />
        <p className={styles.tagline}>{APP_TAGLINE}</p>
        <div className={styles.lines} aria-hidden="true" />
      </section>
      <section className={styles.panel}>
        <h1>Connexion</h1>
        <ActionForm action={loginAction} submitLabel="Se connecter" pendingLabel="Connexion…" submitClassName="btn btn-yellow btn-block">
          <div className="field">
            <label htmlFor="login">Identifiant</label>
            <input id="login" name="login" className="input" autoComplete="username" autoCapitalize="none" required />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe ou code chauffeur</label>
            <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
          </div>
        </ActionForm>
        {demo && (
          <div className={styles.demo}>
            <h2>Comptes de démonstration</h2>
            <ul>
              <li>
                Dirigeant : <code>admin@demo.fr</code> / <code>{DEMO_PASSWORD}</code>
              </li>
              <li>
                Exploitation : <code>exploitation@demo.fr</code> / <code>{DEMO_PASSWORD}</code>
              </li>
              <li>
                Flotte : <code>flotte@demo.fr</code> / <code>{DEMO_PASSWORD}</code>
              </li>
              <li>
                Chauffeur : <code>lucas</code> ou <code>samir</code> / <code>{DEMO_DRIVER_CODE}</code>
              </li>
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
