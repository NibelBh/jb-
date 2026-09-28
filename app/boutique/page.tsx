import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product/ProductGrid';
import { CategoryPills } from '@/components/product/CategoryPills';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Boutique',
  description:
    'Tous nos produits pour chats : litières autonettoyantes, fontaines à eau filtrée, sacs, filtres et litière végétale.',
  alternates: { canonical: '/boutique' },
};

export default function ShopPage() {
  return (
    <>
      <PageHeader
        title="La boutique"
        intro="Litières autonettoyantes, fontaines à eau et tous les consommables qui vont avec."
        breadcrumbs={[{ label: 'Accueil', href: '/' }, { label: 'Boutique' }]}
      >
        <CategoryPills />
      </PageHeader>
      <section className="section" aria-label="Produits">
        <div className="container">
          <ProductGrid />
        </div>
      </section>
    </>
  );
}
