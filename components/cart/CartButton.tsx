'use client';

import { getItemCount } from '@/lib/cart';
import { IconBag } from '../icons';
import { useCartLines, useCartUi } from './CartProvider';
import styles from './CartButton.module.css';

export function CartButton() {
  const { openCart } = useCartUi();
  const count = getItemCount(useCartLines());
  const label = count === 0 ? 'Ouvrir le panier (vide)' : `Ouvrir le panier (${count} article${count > 1 ? 's' : ''})`;

  return (
    <button type="button" className={styles.button} onClick={openCart} aria-label={label}>
      <IconBag />
      <span className={styles.text}>Panier</span>
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
}
