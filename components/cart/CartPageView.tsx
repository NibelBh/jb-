'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { getDetailedLines, getSubtotal } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { getShippingOptions, qualifiesForFreeShipping } from '@/lib/shipping';
import { returns } from '@/lib/site';
import { IconArrowLeft, IconBag, IconLock, IconReturn } from '../icons';
import { CartLineItem } from './CartLineItem';
import { useCartLines, useHydrated } from './CartProvider';
import { FreeShippingMeter } from './FreeShippingMeter';
import styles from './CartPageView.module.css';

export function CartPageView({ cancelled }: { cancelled: boolean }) {
  const hydrated = useHydrated();
  const lines = useCartLines();
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  const detailed = getDetailedLines(lines);
  const subtotal = getSubtotal(lines);
  const [standard] = getShippingOptions(subtotal);
  const freeShipping = qualifiesForFreeShipping(subtotal);

  async function startCheckout() {
    if (!accepted) {
      setError('Cochez la case pour accepter les conditions générales de vente.');
      termsRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines }),
      });
    } catch {
      setError('Connexion impossible. Vérifiez votre accès à internet puis réessayez.');
      setPending(false);
      return;
    }

    const data: { url?: string; error?: string } = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) {
      setError(data.error ?? 'Le paiement n’a pas pu démarrer. Réessayez dans quelques instants.');
      setPending(false);
      return;
    }
    window.location.assign(data.url);
  }

  if (!hydrated) {
    return <p className={styles.loading}>Chargement de votre panier…</p>;
  }

  return (
    <>
      {cancelled && (
        <p className={styles.notice} role="status">
          Le paiement a été annulé. Votre panier est conservé : vous pouvez reprendre votre commande quand vous voulez.
        </p>
      )}

      {detailed.length === 0 ? (
        <div className={styles.empty}>
          <IconBag />
          <h2>Votre panier est vide</h2>
          <p>Parcourez nos litières, fontaines et consommables pour le remplir.</p>
          <Link href="/boutique" className="btn btn-primary">
            Découvrir la boutique
          </Link>
        </div>
      ) : (
        <div className={styles.layout}>
          <section aria-labelledby="cart-lines-title">
            <h2 id="cart-lines-title" className="sr-only">
              Articles
            </h2>
            <ul role="list" className={styles.lines}>
              {detailed.map((line) => (
                <CartLineItem key={line.id} line={line} />
              ))}
            </ul>
            <Link href="/boutique" className={styles.back}>
              <IconArrowLeft />
              Continuer mes achats
            </Link>
          </section>

          <aside className={styles.summary} aria-labelledby="cart-summary-title">
            <h2 id="cart-summary-title" className={styles.summaryTitle}>
              Récapitulatif
            </h2>
            <dl className={styles.rows}>
              <div>
                <dt>Sous-total</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div>
                <dt>Livraison</dt>
                <dd>{freeShipping ? 'Offerte' : `Dès ${formatPrice(standard.price)}`}</dd>
              </div>
              <div className={styles.total}>
                <dt>Total estimé</dt>
                <dd>{formatPrice(subtotal + standard.price)}</dd>
              </div>
            </dl>
            <p className={styles.tax}>Prix TTC. Le mode de livraison se choisit à l’étape du paiement.</p>

            <FreeShippingMeter subtotal={subtotal} />

            <label className="checkbox">
              <input
                ref={termsRef}
                type="checkbox"
                checked={accepted}
                onChange={(event) => {
                  setAccepted(event.target.checked);
                  if (event.target.checked) setError(null);
                }}
                aria-describedby={error ? 'checkout-error' : undefined}
              />
              <span>
                J’ai lu et j’accepte les{' '}
                <Link href="/cgv" target="_blank">
                  conditions générales de vente
                </Link>
                .
              </span>
            </label>

            {error && (
              <p id="checkout-error" className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={startCheckout}
              disabled={pending}
              aria-busy={pending}
            >
              <IconLock />
              {pending ? 'Redirection vers le paiement…' : 'Payer ma commande'}
            </button>

            <ul role="list" className={styles.assurance}>
              <li>
                <IconLock />
                Paiement sécurisé par Stripe : carte bancaire, Apple Pay, Google Pay.
              </li>
              <li>
                <IconReturn />
                {returns.days} jours pour changer d’avis après réception.
              </li>
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
