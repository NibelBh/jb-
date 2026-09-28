import Link from 'next/link';
import { helpNav, legalNav } from '@/lib/navigation';
import { categories } from '@/lib/products';
import { site } from '@/lib/site';
import { Logo } from '../brand/Logo';
import { IconLock, IconMail } from '../icons';
import styles from './Footer.module.css';

const socialLinks = [
  { label: 'Instagram', href: site.social.instagram },
  { label: 'Facebook', href: site.social.facebook },
  { label: 'TikTok', href: site.social.tiktok },
].filter((link) => link.href);

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo tone="light" />
          <p>
            Litières autonettoyantes, fontaines à eau et consommables, choisis pour simplifier le quotidien des
            chats et de leurs humains.
          </p>
          <a href={`mailto:${site.contact.email}`} className={styles.mail}>
            <IconMail />
            {site.contact.email}
          </a>
          {socialLinks.length > 0 && (
            <ul role="list" className={styles.social}>
              {socialLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav className={styles.column} aria-labelledby="footer-shop">
          <h2 id="footer-shop">Boutique</h2>
          <ul role="list">
            <li>
              <Link href="/boutique">Tous les produits</Link>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/boutique/${category.slug}`}>{category.name}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className={styles.column} aria-labelledby="footer-help">
          <h2 id="footer-help">Aide</h2>
          <ul role="list">
            {helpNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/a-propos">À propos</Link>
            </li>
          </ul>
        </nav>

        <nav className={styles.column} aria-labelledby="footer-legal">
          <h2 id="footer-legal">Informations</h2>
          <ul role="list">
            {legalNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={styles.bottom}>
        <p>
          © {year} {site.name}. Tous droits réservés.
        </p>
        <p className={styles.secure}>
          <IconLock />
          Paiement sécurisé par Stripe
        </p>
      </div>
    </footer>
  );
}
