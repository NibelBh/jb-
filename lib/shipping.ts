import { shipping } from './site';

export type ShippingOption = {
  id: 'standard' | 'express';
  label: string;
  price: number;
  minDays: number;
  maxDays: number;
};

export function qualifiesForFreeShipping(subtotal: number): boolean {
  return subtotal >= shipping.freeShippingThreshold;
}

export function amountLeftForFreeShipping(subtotal: number): number {
  return Math.max(0, shipping.freeShippingThreshold - subtotal);
}

/** Options proposées au client, de la moins chère à la plus rapide. */
export function getShippingOptions(subtotal: number): ShippingOption[] {
  const free = qualifiesForFreeShipping(subtotal);
  return [
    {
      id: 'standard',
      label: free ? `${shipping.standard.label} offerte` : shipping.standard.label,
      price: free ? 0 : shipping.standard.price,
      minDays: shipping.standard.minDays,
      maxDays: shipping.standard.maxDays,
    },
    {
      id: 'express',
      label: shipping.express.label,
      price: shipping.express.price,
      minDays: shipping.express.minDays,
      maxDays: shipping.express.maxDays,
    },
  ];
}
