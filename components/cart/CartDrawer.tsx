'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { getDetailedLines, getSubtotal } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { getProductById } from '@/lib/products';
import { IconBag, IconCheckCircle, IconClose } from '../icons';
import { CartLineItem } from './CartLineItem';
import { useCartLines, useCartUi } from './CartProvider';
import { FreeShippingMeter } from './FreeShippingMeter';
import styles from './CartDrawer.module.css';

export function CartDrawer() {
  const { isOpen, closeCart, lastAddedId } = useCartUi();
  const lines = useCartLines();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const detailed = getDetailedLines(lines);
  const subtotal = getSubtotal(lines);
  const lastAdded = lastAddedId ? getProductById(lastAddedId) : undefined;

  return (
    <dialog
      ref={dialogRef}
      className={styles.drawer}
      aria-labelledby="cart-drawer-title"
      onClose={closeCart}
      onClick={(event) => {
        // Un clic sur le fond (en dehors du panneau) ferme le panier.
        if (event.target === event.currentTarget) closeCart();
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id="cart-drawer-title" className={styles.title}>
            Votre panier
          </h2>
          <button type="button" className={styles.close} onClick={closeCart} aria-label="Fermer le panier">
            <IconClose />
          </button>
        </header>

        {lastAdded && detailed.some((line) => line.id === lastAdded.id) && (
          <p className={styles.added} role="status">
            <IconCheckCircle />
            <span>
              Article ajouté : <strong>{lastAdded.name}</strong>
            </span>
          </p>
        )}

        {detailed.length === 0 ? (
          <div className={styles.empty}>
            <IconBag />
            <p>Votre panier est vide pour le moment.</p>
            <Link href="/boutique" className="btn btn-primary" onClick={closeCart}>
              Découvrir la boutique
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.content}>
              <FreeShippingMeter subtotal={subtotal} />
              <ul role="list" className={styles.lines}>
                {detailed.map((line) => (
                  <CartLineItem key={line.id} line={line} onNavigate={closeCart} />
                ))}
              </ul>
            </div>
            <footer className={styles.footer}>
              <div className={styles.subtotal}>
                <span>Sous-total</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <p className={styles.note}>Livraison calculée à l’étape suivante. Prix TTC.</p>
              <Link href="/panier" className="btn btn-primary btn-block" onClick={closeCart}>
                Finaliser ma commande
              </Link>
              <button type="button" className="text-button" onClick={closeCart}>
                Continuer mes achats
              </button>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
