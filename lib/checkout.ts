import type Stripe from 'stripe';
import { MAX_QUANTITY } from './cart';
import { getProductById, type Product } from './products';
import { getShippingOptions } from './shipping';
import { shipping } from './site';

export type CheckoutLine = { product: Product; quantity: number };

export type CartValidation =
  | { ok: true; lines: CheckoutLine[]; subtotal: number }
  | { ok: false; error: string };

const MAX_LINES = 50;

/**
 * Vérifie le panier envoyé par le navigateur. Seuls les identifiants et les
 * quantités sont pris en compte : les prix viennent toujours du catalogue,
 * jamais du client.
 */
export function validateCart(payload: unknown): CartValidation {
  const items = (payload as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { ok: false, error: 'Panier invalide.' };
  if (items.length === 0) return { ok: false, error: 'Votre panier est vide.' };
  if (items.length > MAX_LINES) return { ok: false, error: 'Votre panier contient trop d’articles.' };

  const quantities = new Map<string, number>();
  for (const item of items) {
    const { id, quantity } = (item ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, error: 'Panier invalide.' };
    }
    quantities.set(id, (quantities.get(id) ?? 0) + quantity);
  }

  const lines: CheckoutLine[] = [];
  for (const [id, quantity] of quantities) {
    const product = getProductById(id);
    if (!product) {
      return {
        ok: false,
        error: 'Un article de votre panier n’est plus disponible. Retirez-le puis réessayez.',
      };
    }
    if (!product.inStock) {
      return { ok: false, error: `« ${product.name} » est en rupture de stock. Retirez-le pour continuer.` };
    }
    if (quantity > MAX_QUANTITY) {
      return { ok: false, error: `Vous pouvez commander ${MAX_QUANTITY} exemplaires maximum par article.` };
    }
    lines.push({ product, quantity });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  return { ok: true, lines, subtotal };
}

/** Stripe n'affiche que des images publiques en JPG, PNG ou WebP. */
function publicImageUrl(path: string | undefined, baseUrl: string): string[] | undefined {
  if (!path || !baseUrl.startsWith('https://') || !/\.(jpe?g|png|webp)$/i.test(path)) return undefined;
  return [new URL(path, baseUrl).toString()];
}

export function buildCheckoutSessionParams(
  lines: CheckoutLine[],
  baseUrl: string,
): Stripe.Checkout.SessionCreateParams {
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  return {
    mode: 'payment',
    locale: 'fr',
    submit_type: 'pay',
    line_items: lines.map(({ product, quantity }) => ({
      quantity,
      price_data: {
        currency: 'eur',
        unit_amount: product.price,
        product_data: {
          name: product.name,
          images: publicImageUrl(product.images[0], baseUrl),
          metadata: { product_id: product.id },
        },
      },
    })),
    shipping_address_collection: { allowed_countries: [...shipping.countries] },
    shipping_options: getShippingOptions(subtotal).map((option) => ({
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: option.label,
        fixed_amount: { amount: option.price, currency: 'eur' },
        delivery_estimate: {
          minimum: { unit: 'business_day', value: option.minDays },
          maximum: { unit: 'business_day', value: option.maxDays },
        },
      },
    })),
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    success_url: `${baseUrl}/commande/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/panier?paiement=annule`,
    metadata: {
      items: lines.map(({ product, quantity }) => `${product.id}x${quantity}`).join(',').slice(0, 500),
    },
  };
}
