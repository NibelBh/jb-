import 'server-only';
import Stripe from 'stripe';

let client: Stripe | null = null;

/** Renvoie le client Stripe, ou null tant que STRIPE_SECRET_KEY n'est pas définie. */
export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  client ??= new Stripe(secretKey);
  return client;
}

/**
 * Adresse publique du site, utilisée pour les liens de retour Stripe.
 * NEXT_PUBLIC_SITE_URL a la priorité ; sinon on reprend l'adresse de la requête.
 */
export function getBaseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(request.url).origin;
}

export type OrderSummary = {
  complete: boolean;
  paid: boolean;
  customerName: string | null;
  email: string | null;
  items: { description: string; quantity: number; total: number }[];
  shipping: number;
  total: number;
};

export async function getOrderSummary(sessionId: string): Promise<OrderSummary | null> {
  const stripe = getStripe();
  if (!stripe || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
    const fullName = session.customer_details?.name ?? null;
    return {
      complete: session.status === 'complete',
      paid: session.payment_status === 'paid' || session.payment_status === 'no_payment_required',
      customerName: fullName ? fullName.split(' ')[0] : null,
      email: session.customer_details?.email ?? null,
      items: (session.line_items?.data ?? []).map((item) => ({
        description: item.description ?? 'Article',
        quantity: item.quantity ?? 1,
        total: item.amount_total,
      })),
      shipping: session.shipping_cost?.amount_total ?? 0,
      total: session.amount_total ?? 0,
    };
  } catch (error) {
    console.error('[commande] Impossible de lire la session Stripe', error);
    return null;
  }
}
