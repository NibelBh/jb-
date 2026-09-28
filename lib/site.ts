/**
 * Informations générales de la boutique.
 *
 * Les valeurs entre crochets « [ ... ] » sont à remplacer avant la mise en ligne :
 * elles apparaissent telles quelles dans les mentions légales, les CGV et la
 * politique de confidentialité.
 */

export const site = {
  name: 'Tigerz',
  tagline: 'Le confort de votre chat, sans la corvée',
  description:
    'Litières autonettoyantes, fontaines à eau et consommables pour chats. Paiement sécurisé, expédition rapide en France.',
  contact: {
    email: 'contact@tigerz.fr',
    /** Laissez vide pour masquer le téléphone sur le site. */
    phone: '',
    hours: 'Du lundi au vendredi, de 9 h à 18 h',
    responseTime: 'Réponse sous 24 h ouvrées',
  },
  /** Liens vers vos réseaux sociaux. Laissez vide pour masquer. */
  social: {
    instagram: '',
    facebook: '',
    tiktok: '',
  },
};

/** Montants en centimes d'euro, TTC. */
export const shipping = {
  freeShippingThreshold: 4900,
  countries: ['FR', 'BE', 'LU', 'MC'] as const,
  countryNames: 'France métropolitaine, Belgique, Luxembourg et Monaco',
  dispatchDelay: 'Expédition sous 24 à 48 h ouvrées',
  standard: { label: 'Livraison standard', price: 490, minDays: 2, maxDays: 4 },
  express: { label: 'Livraison express', price: 990, minDays: 1, maxDays: 2 },
} as const;

export const returns = {
  /** Délai légal minimum : 14 jours. Vous pouvez l'allonger. */
  days: 14,
} as const;

export const legal = {
  companyName: '[Raison sociale]',
  legalForm: '[Forme juridique et capital social]',
  address: '[Adresse du siège social]',
  siret: '[Numéro SIRET]',
  rcs: '[Ville et numéro RCS, ou « Dispensé d’immatriculation » pour un micro-entrepreneur]',
  vatNumber: '[Numéro de TVA intracommunautaire]',
  publicationDirector: '[Nom du directeur ou de la directrice de la publication]',
  host: {
    name: 'Vercel Inc.',
    address: '[Adresse de l’hébergeur, indiquée sur son site]',
    website: 'https://vercel.com',
  },
  mediator: {
    name: '[Nom du médiateur de la consommation]',
    address: '[Adresse du médiateur]',
    website: '[Site internet du médiateur]',
  },
  lastUpdated: '28 septembre 2026',
} as const;
