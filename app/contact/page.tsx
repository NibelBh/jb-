import type { Metadata } from 'next';
import Link from 'next/link';
import { IconClock, IconMail, IconPhone } from '@/components/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { site } from '@/lib/site';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Une question sur une commande ou un produit ? Contactez l’équipe ${site.name}.`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  const { email, phone, hours, responseTime } = site.contact;
  const subject = encodeURIComponent('Question sur ma commande');

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Une question ? Écrivez-nous"
        intro="Conseil avant achat, suivi de commande, retour : nous répondons à tous les messages."
        breadcrumbs={[{ label: 'Accueil', href: '/' }, { label: 'Contact' }]}
      />

      <section className="section">
        <div className={`container ${styles.grid}`}>
          <div className={styles.cards}>
            <a href={`mailto:${email}?subject=${subject}`} className={styles.card}>
              <span className={styles.icon}>
                <IconMail />
              </span>
              <span>
                <span className={styles.label}>Par e-mail</span>
                <strong>{email}</strong>
                <span className={styles.hint}>{responseTime}</span>
              </span>
            </a>
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, '')}`} className={styles.card}>
                <span className={styles.icon}>
                  <IconPhone />
                </span>
                <span>
                  <span className={styles.label}>Par téléphone</span>
                  <strong>{phone}</strong>
                  <span className={styles.hint}>{hours}</span>
                </span>
              </a>
            )}
            <div className={styles.card}>
              <span className={styles.icon}>
                <IconClock />
              </span>
              <span>
                <span className={styles.label}>Horaires du service client</span>
                <strong>{hours}</strong>
                <span className={styles.hint}>Hors jours fériés</span>
              </span>
            </div>
          </div>

          <div className={styles.tips}>
            <h2>Pour une réponse plus rapide</h2>
            <ul>
              <li>Indiquez votre numéro de commande, visible sur le reçu envoyé par e-mail.</li>
              <li>Pour un souci sur un appareil, ajoutez une photo ou une courte vidéo.</li>
              <li>
                Beaucoup de réponses se trouvent déjà dans notre <Link href="/faq">foire aux questions</Link> et sur
                la page <Link href="/livraison-retours">livraison et retours</Link>.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
