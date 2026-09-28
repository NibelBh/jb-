'use client';

import { useCartUi } from '../cart/CartProvider';
import { IconPlus } from '../icons';
import styles from './ProductCard.module.css';

type Props = { productId: string; productName: string; inStock: boolean };

export function QuickAddButton({ productId, productName, inStock }: Props) {
  const { addToCart } = useCartUi();

  if (!inStock) {
    return <span className={styles.soldOut}>Épuisé</span>;
  }

  return (
    <button
      type="button"
      className={styles.add}
      onClick={() => addToCart(productId)}
      aria-label={`Ajouter ${productName} au panier`}
    >
      <IconPlus />
      <span>Ajouter</span>
    </button>
  );
}
