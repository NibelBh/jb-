'use client';

import { useState } from 'react';
import { useCartUi } from '../cart/CartProvider';
import { QuantityStepper } from '../cart/QuantityStepper';
import { IconBag } from '../icons';
import styles from './AddToCart.module.css';

export function AddToCart({ productId, inStock }: { productId: string; inStock: boolean }) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCartUi();

  if (!inStock) {
    return (
      <button type="button" className="btn btn-primary btn-block" disabled>
        Rupture de stock
      </button>
    );
  }

  return (
    <div className={styles.row}>
      <QuantityStepper value={quantity} onChange={setQuantity} label="Quantité" />
      <button
        type="button"
        className={`btn btn-primary ${styles.button}`}
        onClick={() => {
          addToCart(productId, quantity);
          setQuantity(1);
        }}
      >
        <IconBag />
        Ajouter au panier
      </button>
    </div>
  );
}
