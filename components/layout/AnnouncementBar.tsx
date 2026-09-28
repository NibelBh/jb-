import { formatPrice } from '@/lib/format';
import { returns, shipping } from '@/lib/site';
import styles from './AnnouncementBar.module.css';

export function AnnouncementBar() {
  return (
    <div className={styles.bar}>
      <p className={styles.inner}>
        <span>Livraison offerte dès {formatPrice(shipping.freeShippingThreshold)} d’achat</span>
        <span className={styles.extra} aria-hidden="true">
          ·
        </span>
        <span className={styles.extra}>{shipping.dispatchDelay}</span>
        <span className={styles.extra} aria-hidden="true">
          ·
        </span>
        <span className={styles.extra}>{returns.days} jours pour changer d’avis</span>
      </p>
    </div>
  );
}
