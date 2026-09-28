import { describe, expect, it } from 'vitest';
import { formatPrice } from '@/lib/format';

describe('formatPrice', () => {
  it('formate les centimes en euros à la française', () => {
    expect(formatPrice(36900)).toBe('369,00 €');
    expect(formatPrice(490)).toBe('4,90 €');
    expect(formatPrice(5)).toBe('0,05 €');
  });

  it('sépare les milliers', () => {
    expect(formatPrice(123456789)).toBe('1 234 567,89 €');
  });

  it('gère les montants négatifs', () => {
    expect(formatPrice(-1250)).toBe('-12,50 €');
  });
});
