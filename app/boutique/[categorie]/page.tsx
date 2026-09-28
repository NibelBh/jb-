import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryPills } from '@/components/product/CategoryPills';
import { ProductGrid } from '@/components/product/ProductGrid';
import { PageHeader } from '@/components/ui/PageHeader';
import { categories, getCategory } from '@/lib/products';
import { openGraph, shareImage } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return categories.map((category) => ({ categorie: category.slug }));
}

export async function generateMetadata(props: PageProps<'/boutique/[categorie]'>): Promise<Metadata> {
  const { categorie } = await props.params;
  const category = getCategory(categorie);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/boutique/${category.slug}` },
    openGraph: openGraph({
      title: category.name,
      description: category.description,
      images: [shareImage(category.image, category.name)],
    }),
  };
}

export default async function CategoryPage(props: PageProps<'/boutique/[categorie]'>) {
  const { categorie } = await props.params;
  const category = getCategory(categorie);
  if (!category) notFound();

  return (
    <>
      <PageHeader
        title={category.name}
        intro={category.description}
        breadcrumbs={[
          { label: 'Accueil', href: '/' },
          { label: 'Boutique', href: '/boutique' },
          { label: category.name },
        ]}
      >
        <CategoryPills />
      </PageHeader>
      <section className="section" aria-label="Produits">
        <div className="container">
          <ProductGrid category={category.slug} />
        </div>
      </section>
    </>
  );
}
