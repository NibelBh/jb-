import type { Metadata } from 'next';
import { CartPageView } from '@/components/cart/CartPageView';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Mon panier',
  robots: { index: false },
};

export default async function CartPage(props: PageProps<'/panier'>) {
  const { paiement } = await props.searchParams;
  return (
    <>
      <PageHeader title="Mon panier" breadcrumbs={[{ label: 'Accueil', href: '/' }, { label: 'Panier' }]} />
      <section className="section">
        <div className="container">
          <CartPageView cancelled={paiement === 'annule'} />
        </div>
      </section>
    </>
  );
}
