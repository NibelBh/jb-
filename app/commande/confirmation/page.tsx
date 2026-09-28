import type { Metadata } from 'next';
import Link from 'next/link';
import { ClearCart } from '@/components/cart/ClearCart';
import { IconCheckCircle, IconMail } from '@/components/icons';
import { formatPrice } from '@/lib/format';
import { shipping, site } from '@/lib/site';
import { getOrderSummary } from '@/lib/stripe';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Confirmation de commande',
  robots: { index: false },
};

export default async function ConfirmationPage(props: PageProps<'/commande/confirmation'>) {
  const { session_id: sessionId } = await props.searchParams;
  const order = typeof sessionId === 'string' ? await getOrderSummary(sessionId) : null;

  if (!order || !order.complete) {
    return (
      <section className="section">
        <div className={`container-narrow ${styles.card}`}>
          <span className={styles.icon} data-tone="neutral">
            <IconMail />
          </span>
          <h1 className={styles.title}>Nous ne retrouvons pas cette commande</h1>
          <p className="lead">
            Si vous venez de payer, pas d’inquiétude : un reçu vous a été envoyé par e-mail. Pour toute question,
            écrivez-nous à <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>.
          </p>
          <div className={styles.actions}>
            <Link href="/" className="btn btn-primary">
              Retour à l’accueil
            </Link>
            <Link href="/panier" className="btn btn-secondary">
              Voir mon panier
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <ClearCart />
      <div className={`container-narrow ${styles.card}`}>
        <span className={styles.icon}>
          <IconCheckCircle />
        </span>
        <h1 className={styles.title}>
          {order.customerName ? `Merci ${order.customerName} !` : 'Merci pour votre commande !'}
        </h1>
        <p className="lead">
          {order.paid
            ? 'Votre paiement est confirmé et votre commande est enregistrée.'
            : 'Votre commande est enregistrée. Le paiement est en cours de validation par votre banque.'}{' '}
          {order.email && (
            <>
              Vous recevrez un reçu à l’adresse <strong>{order.email}</strong>.
            </>
          )}
        </p>

        <div className={styles.summary}>
          <h2 className={styles.summaryTitle}>Récapitulatif</h2>
          <ul role="list" className={styles.items}>
            {order.items.map((item, index) => (
              <li key={`${item.description}-${index}`}>
                <span>
                  {item.description} <span className={styles.qty}>× {item.quantity}</span>
                </span>
                <span>{formatPrice(item.total)}</span>
              </li>
            ))}
            <li>
              <span>Livraison</span>
              <span>{order.shipping === 0 ? 'Offerte' : formatPrice(order.shipping)}</span>
            </li>
            <li className={styles.total}>
              <span>Total payé</span>
              <span>{formatPrice(order.total)}</span>
            </li>
          </ul>
        </div>

        <p className={styles.next}>
          Nous préparons votre colis. {shipping.dispatchDelay}, et vous recevrez le suivi par e-mail dès son
          départ.
        </p>

        <div className={styles.actions}>
          <Link href="/boutique" className="btn btn-primary">
            Continuer mes achats
          </Link>
          <Link href="/contact" className="btn btn-secondary">
            Une question ?
          </Link>
        </div>
      </div>
    </section>
  );
}
