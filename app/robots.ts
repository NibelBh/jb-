import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/panier', '/commande/'] },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
