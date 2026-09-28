import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IconCheck } from '@/components/icons';
import { AddToCart } from '@/components/product/AddToCart';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGallery } from '@/components/product/ProductGallery';
import { Reassurance } from '@/components/Reassurance';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { formatPrice } from '@/lib/format';
import { getCategory, getProductBySlug, getRelatedProducts, products } from '@/lib/products';
import { openGraph, shareImage } from '@/lib/seo';
import { shipping, site } from '@/lib/site';
import { getSiteUrl } from '@/lib/url';
import styles from './page.module.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata(props: PageProps<'/produit/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: `${product.tagline} ${formatPrice(product.price)} TTC.`,
    alternates: { canonical: `/produit/${product.slug}` },
    openGraph: openGraph({
      title: product.name,
      description: product.tagline,
      images: [shareImage(product.images[0], product.name)],
    }),
  };
}

export default async function ProductPage(props: PageProps<'/produit/[slug]'>) {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const category = getCategory(product.category);
  const related = getRelatedProducts(product);
  const siteUrl = getSiteUrl();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.tagline,
    image: product.images.map((image) => new URL(image, siteUrl).toString()),
    sku: product.id,
    brand: { '@type': 'Brand', name: site.name },
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/produit/${product.slug}`,
      priceCurrency: 'EUR',
      price: (product.price / 100).toFixed(2),
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <div className={`container ${styles.top}`}>
        <Breadcrumbs
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Boutique', href: '/boutique' },
            ...(category ? [{ label: category.name, href: `/boutique/${category.slug}` }] : []),
            { label: product.name },
          ]}
        />
      </div>

      <section className={`container ${styles.product}`}>
        <ProductGallery images={product.images} name={product.name} />

        <div className={styles.info}>
          {category && <p className="eyebrow">{category.name}</p>}
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.tagline}>{product.tagline}</p>

          <div className={styles.priceRow}>
            <p className={styles.price}>{formatPrice(product.price)}</p>
            <span className={styles.tax}>TTC</span>
          </div>

          <p className={styles.stock} data-in-stock={product.inStock}>
            <span className={styles.dot} aria-hidden="true" />
            {product.inStock ? `En stock. ${shipping.dispatchDelay}.` : 'Rupture de stock pour le moment.'}
          </p>

          <AddToCart productId={product.id} inStock={product.inStock} />

          <ul role="list" className={styles.highlights}>
            {product.features.map((feature) => (
              <li key={feature}>
                <IconCheck />
                {feature}
              </li>
            ))}
          </ul>

          <div className={styles.assurance}>
            <Reassurance variant="compact" />
          </div>
        </div>
      </section>

      <section className={`container ${styles.details}`} aria-label="Détails du produit">
        <div className={styles.description}>
          <h2>Description</h2>
          {product.description.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {product.inTheBox && (
            <>
              <h3>Dans la boîte</h3>
              <ul>
                {product.inTheBox.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h2>Caractéristiques</h2>
          <dl className={styles.specs}>
            {product.specs.map((spec) => (
              <div key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section section-alt" aria-labelledby="related-title">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">À ajouter à votre commande</p>
                <h2 id="related-title">Produits compatibles</h2>
              </div>
            </div>
            <ul role="list" className={styles.related}>
              {related.map((item) => (
                <li key={item.id}>
                  <ProductCard product={item} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
