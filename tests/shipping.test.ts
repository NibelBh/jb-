import { describe, expect, it } from 'vitest';
import { amountLeftForFreeShipping, getShippingOptions } from '@/lib/shipping';
import { shipping } from '@/lib/site';

describe('livraison', () => {
  it('facture la livraison standard sous le seuil', () => {
    const [standard, express] = getShippingOptions(shipping.freeShippingThreshold - 1);
    expect(standard.price).toBe(shipping.standard.price);
    expect(express.price).toBe(shipping.express.price);
  });

  it('offre la livraison standard à partir du seuil', () => {
    const [standard] = getShippingOptions(shipping.freeShippingThreshold);
    expect(standard.price).toBe(0);
    expect(standard.label).toContain('offerte');
  });

  it('indique le montant restant pour la livraison offerte', () => {
    expect(amountLeftForFreeShipping(1000)).toBe(shipping.freeShippingThreshold - 1000);
    expect(amountLeftForFreeShipping(100000)).toBe(0);
  });
});
