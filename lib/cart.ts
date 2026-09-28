import { getProductById, type Product } from './products';

export const MAX_QUANTITY = 10;

export type CartLine = { id: string; quantity: number };

export type CartAction =
  | { type: 'add'; id: string; quantity?: number }
  | { type: 'setQuantity'; id: string; quantity: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

function clampQuantity(quantity: number): number {
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
}

export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const quantity = clampQuantity(action.quantity ?? 1);
      const existing = lines.find((line) => line.id === action.id);
      if (!existing) return [...lines, { id: action.id, quantity }];
      return lines.map((line) =>
        line.id === action.id ? { ...line, quantity: clampQuantity(line.quantity + quantity) } : line,
      );
    }
    case 'setQuantity': {
      if (action.quantity < 1) return lines.filter((line) => line.id !== action.id);
      return lines.map((line) =>
        line.id === action.id ? { ...line, quantity: clampQuantity(action.quantity) } : line,
      );
    }
    case 'remove':
      return lines.filter((line) => line.id !== action.id);
    case 'clear':
      return [];
  }
}

/**
 * Relit un panier sauvegardé dans le navigateur. Tout ce qui n'est pas
 * reconnu (produit supprimé du catalogue, quantité invalide) est ignoré.
 */
export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const lines: CartLine[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, quantity } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof quantity !== 'number' || !Number.isFinite(quantity)) continue;
    if (quantity < 1 || !getProductById(id) || lines.some((line) => line.id === id)) continue;
    lines.push({ id, quantity: clampQuantity(quantity) });
  }
  return lines;
}

export type DetailedCartLine = CartLine & { product: Product; total: number };

export function getDetailedLines(lines: CartLine[]): DetailedCartLine[] {
  return lines.flatMap((line) => {
    const product = getProductById(line.id);
    return product ? [{ ...line, product, total: product.price * line.quantity }] : [];
  });
}

export function getSubtotal(lines: CartLine[]): number {
  return getDetailedLines(lines).reduce((sum, line) => sum + line.total, 0);
}

export function getItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
