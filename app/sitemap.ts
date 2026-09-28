import type { MetadataRoute } from 'next';
import { categories, products } from '@/lib/products';
import { getSiteUrl } from '@/lib/url';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const pages = ['', '/boutique', '/a-propos', '/faq', '/contact', '/livraison-retours', '/cgv', '/mentions-legales', '/confidentialite'];

  return [
    ...pages.map((path) => ({ url: `${base}${path}`, changeFrequency: 'monthly' as const, priority: path === '' ? 1 : 0.5 })),
    ...categories.map((category) => ({
      url: `${base}/boutique/${category.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${base}/produit/${product.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
