export type NavItem = { href: string; label: string };

export const mainNav: NavItem[] = [
  { href: '/boutique', label: 'Boutique' },
  { href: '/boutique/litieres-autonettoyantes', label: 'Litières' },
  { href: '/boutique/fontaines-a-eau', label: 'Fontaines' },
  { href: '/boutique/consommables', label: 'Consommables' },
  { href: '/a-propos', label: 'À propos' },
];

export const helpNav: NavItem[] = [
  { href: '/faq', label: 'Questions fréquentes' },
  { href: '/livraison-retours', label: 'Livraison et retours' },
  { href: '/contact', label: 'Contact' },
];

export const legalNav: NavItem[] = [
  { href: '/cgv', label: 'Conditions générales de vente' },
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite', label: 'Confidentialité' },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === '/boutique') return pathname === '/boutique';
  return pathname === href || pathname.startsWith(`${href}/`);
}
