import { buildCheckoutSessionParams, validateCart } from '@/lib/checkout';
import { getBaseUrl, getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return Response.json(
      {
        error:
          'Le paiement en ligne n’est pas encore activé sur la boutique. Revenez très vite ou contactez-nous pour commander.',
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const cart = validateCart(payload);
  if (!cart.ok) {
    return Response.json({ error: cart.error }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams(cart.lines, getBaseUrl(request)),
    );
    if (!session.url) throw new Error('Session Stripe sans URL de paiement');
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('[checkout] Création de la session Stripe impossible', error);
    return Response.json(
      { error: 'Le paiement est momentanément indisponible. Réessayez dans quelques instants.' },
      { status: 502 },
    );
  }
}
