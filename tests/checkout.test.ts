import { describe, expect, it } from 'vitest';
import { buildCheckoutSessionParams, validateCart } from '@/lib/checkout';
import { getProductById } from '@/lib/products';

describe('validateCart', () => {
  it('refuse un panier mal formé', () => {
    expect(validateCart(null).ok).toBe(false);
    expect(validateCart({ items: 'x' }).ok).toBe(false);
    expect(validateCart({ items: [] })).toEqual({ ok: false, error: 'Votre panier est vide.' });
    expect(validateCart({ items: [{ id: 'fontaine-inox', quantity: 1.5 }] }).ok).toBe(false);
    expect(validateCart({ items: [{ id: 'fontaine-inox', quantity: 0 }] }).ok).toBe(false);
  });

  it('refuse un produit inconnu', () => {
    const result = validateCart({ items: [{ id: 'inconnu', quantity: 1 }] });
    expect(result.ok).toBe(false);
  });

  it('regroupe les doublons et applique la quantité maximale', () => {
    const merged = validateCart({
      items: [
        { id: 'fontaine-inox', quantity: 2 },
        { id: 'fontaine-inox', quantity: 3 },
      ],
    });
    expect(merged.ok && merged.lines).toEqual([{ product: getProductById('fontaine-inox'), quantity: 5 }]);

    const tooMany = validateCart({ items: [{ id: 'fontaine-inox', quantity: 11 }] });
    expect(tooMany.ok).toBe(false);
  });

  it('calcule le sous-total avec les prix du catalogue, pas ceux du client', () => {
    const result = validateCart({ items: [{ id: 'sacs-litiere', quantity: 2, price: 1 }] });
    expect(result.ok && result.subtotal).toBe(1290 * 2);
  });
});

describe('buildCheckoutSessionParams', () => {
  const inox = getProductById('fontaine-inox')!;
  const dome = getProductById('litiere-dome')!;

  it('construit les lignes et les liens de retour', () => {
    const params = buildCheckoutSessionParams([{ product: inox, quantity: 2 }], 'https://tigerz.example');
    expect(params.mode).toBe('payment');
    expect(params.locale).toBe('fr');
    expect(params.line_items).toEqual([
      {
        quantity: 2,
        price_data: {
          currency: 'eur',
          unit_amount: 4490,
          product_data: { name: inox.name, images: undefined, metadata: { product_id: 'fontaine-inox' } },
        },
      },
    ]);
    expect(params.success_url).toBe(
      'https://tigerz.example/commande/confirmation?session_id={CHECKOUT_SESSION_ID}',
    );
    expect(params.cancel_url).toBe('https://tigerz.example/panier?paiement=annule');
  });

  it('facture la livraison sous le seuil et l’offre au-dessus', () => {
    const small = buildCheckoutSessionParams([{ product: inox, quantity: 1 }], 'https://tigerz.example');
    const large = buildCheckoutSessionParams([{ product: dome, quantity: 1 }], 'https://tigerz.example');
    const standardPrice = (params: typeof small) =>
      params.shipping_options?.[0].shipping_rate_data?.fixed_amount?.amount;
    expect(standardPrice(small)).toBe(490);
    expect(standardPrice(large)).toBe(0);
  });

  it('n’envoie à Stripe que des images publiques au format photo', () => {
    const photo = { ...inox, images: ['/images/products/fontaine.jpg'] };
    const params = buildCheckoutSessionParams([{ product: photo, quantity: 1 }], 'https://tigerz.example');
    expect(params.line_items?.[0].price_data?.product_data?.images).toEqual([
      'https://tigerz.example/images/products/fontaine.jpg',
    ]);
    const local = buildCheckoutSessionParams([{ product: photo, quantity: 1 }], 'http://localhost:3000');
    expect(local.line_items?.[0].price_data?.product_data?.images).toBeUndefined();
  });
});
