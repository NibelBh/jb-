import { formatPrice } from '@/lib/format';
import { amountLeftForFreeShipping } from '@/lib/shipping';
import { shipping } from '@/lib/site';
import { IconTruck } from '../icons';
import styles from './FreeShippingMeter.module.css';

export function FreeShippingMeter({ subtotal }: { subtotal: number }) {
  const left = amountLeftForFreeShipping(subtotal);
  const progress = Math.min(100, Math.round((subtotal / shipping.freeShippingThreshold) * 100));

  return (
    <div className={styles.meter} data-done={left === 0}>
      <p className={styles.text}>
        <IconTruck />
        {left === 0 ? (
          <span>
            <strong>Livraison standard offerte</strong> pour cette commande.
          </span>
        ) : (
          <span>
            Plus que <strong>{formatPrice(left)}</strong> pour profiter de la livraison offerte.
          </span>
        )}
      </p>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.bar} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
