/**
 * Adresse publique du site pour le référencement (sitemap, balises Open Graph).
 * Définissez NEXT_PUBLIC_SITE_URL avec votre nom de domaine ; sur Vercel, le
 * domaine de production est utilisé automatiquement s'il manque.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelDomain) return `https://${vercelDomain}`;
  return 'http://localhost:3000';
}
