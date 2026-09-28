'use client';

import { useEffect } from 'react';
import { dispatchCart } from '@/lib/cart-store';

/** Vide le panier une fois la commande confirmée. */
export function ClearCart() {
  useEffect(() => {
    dispatchCart({ type: 'clear' });
  }, []);
  return null;
}
