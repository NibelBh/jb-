import { formatPrice } from '@/lib/format';
import { returns, shipping, site } from '@/lib/site';
import { IconChat, IconLock, IconReturn, IconTruck } from './icons';
import styles from './Reassurance.module.css';

const items = [
  {
    icon: IconTruck,
    title: `Livraison offerte dès ${formatPrice(shipping.freeShippingThreshold)}`,
    text: `Sinon ${formatPrice(shipping.standard.price)}, livré en ${shipping.standard.minDays} à ${shipping.standard.maxDays} jours ouvrés`,
  },
  {
    icon: IconReturn,
    title: `${returns.days} jours pour changer d’avis`,
    text: 'Retour accepté sans avoir à vous justifier',
  },
  {
    icon: IconLock,
    title: 'Paiement sécurisé',
    text: 'Carte bancaire, Apple Pay et Google Pay via Stripe',
  },
  {
    icon: IconChat,
    title: 'Une question ?',
    text: site.contact.responseTime,
  },
];

export function Reassurance({ variant = 'band' }: { variant?: 'band' | 'compact' }) {
  const list = variant === 'compact' ? items.slice(0, 3) : items;
  return (
    <ul role="list" className={styles.list} data-variant={variant}>
      {list.map(({ icon: Icon, title, text }) => (
        <li key={title} className={styles.item}>
          <span className={styles.icon}>
            <Icon />
          </span>
          <span>
            <strong>{title}</strong>
            <span className={styles.text}>{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
