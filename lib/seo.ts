import type { Metadata } from 'next';
import { site } from './site';

type OpenGraph = NonNullable<Metadata['openGraph']>;

export const defaultShareImage = {
  url: '/images/og-tigerz.png',
  width: 1200,
  height: 630,
  alt: `${site.name}, litières autonettoyantes, fontaines à eau et consommables pour chats`,
};

/** Les réseaux sociaux n'affichent que des images JPG, PNG ou WebP. */
export function shareImage(path: string | undefined, alt: string) {
  if (path && /\.(jpe?g|png|webp)$/i.test(path)) return { url: path, alt };
  return defaultShareImage;
}

/**
 * Next.js remplace entièrement l'objet openGraph d'un parent dès qu'une page
 * définit le sien : cette fonction repart toujours des valeurs communes.
 */
export function openGraph(overrides: OpenGraph = {}): OpenGraph {
  return {
    type: 'website',
    locale: 'fr_FR',
    siteName: site.name,
    images: [defaultShareImage],
    ...overrides,
  };
}
