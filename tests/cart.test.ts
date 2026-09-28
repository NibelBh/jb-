import { describe, expect, it } from 'vitest';
import { cartReducer, getItemCount, getSubtotal, MAX_QUANTITY, parseStoredCart } from '@/lib/cart';

describe('cartReducer', () => {
  it('ajoute un article puis cumule les quantités', () => {
    let lines = cartReducer([], { type: 'add', id: 'fontaine-inox' });
    lines = cartReducer(lines, { type: 'add', id: 'fontaine-inox', quantity: 2 });
    expect(lines).toEqual([{ id: 'fontaine-inox', quantity: 3 }]);
  });

  it('plafonne la quantité', () => {
    const lines = cartReducer([{ id: 'fontaine-inox', quantity: 9 }], {
      type: 'add',
      id: 'fontaine-inox',
      quantity: 5,
    });
    expect(lines[0].quantity).toBe(MAX_QUANTITY);
  });

  it('retire la ligne quand la quantité passe à zéro', () => {
    const lines = cartReducer([{ id: 'fontaine-inox', quantity: 2 }], {
      type: 'setQuantity',
      id: 'fontaine-inox',
      quantity: 0,
    });
    expect(lines).toEqual([]);
  });

  it('vide le panier', () => {
    expect(cartReducer([{ id: 'fontaine-inox', quantity: 2 }], { type: 'clear' })).toEqual([]);
  });
});

describe('parseStoredCart', () => {
  it('ignore les données illisibles', () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart('pas du json')).toEqual([]);
    expect(parseStoredCart('{"id":"x"}')).toEqual([]);
  });

  it('écarte les produits inconnus, les doublons et les quantités invalides', () => {
    const raw = JSON.stringify([
      { id: 'fontaine-inox', quantity: 2 },
      { id: 'fontaine-inox', quantity: 4 },
      { id: 'produit-supprime', quantity: 1 },
      { id: 'sacs-litiere', quantity: -3 },
      { id: 'filtres-fontaine', quantity: 99 },
    ]);
    expect(parseStoredCart(raw)).toEqual([
      { id: 'fontaine-inox', quantity: 2 },
      { id: 'filtres-fontaine', quantity: MAX_QUANTITY },
    ]);
  });
});

describe('totaux', () => {
  it('calcule le sous-total et le nombre d’articles depuis le catalogue', () => {
    const lines = [
      { id: 'fontaine-inox', quantity: 2 },
      { id: 'sacs-litiere', quantity: 1 },
    ];
    expect(getSubtotal(lines)).toBe(4490 * 2 + 1290);
    expect(getItemCount(lines)).toBe(3);
  });
});
