/**
 * Catalogue de la boutique.
 *
 * Les produits ci-dessous sont des exemples : remplacez les noms, prix,
 * caractéristiques et images par ceux de vos articles. Les prix sont en
 * centimes d'euro TTC (36900 = 369,00 €).
 *
 * Pour ajouter une photo, déposez le fichier dans public/images/products/
 * puis indiquez son chemin dans `images` (ex. '/images/products/ma-photo.jpg').
 */

export type CategorySlug = 'litieres-autonettoyantes' | 'fontaines-a-eau' | 'consommables';

export type Category = {
  slug: CategorySlug;
  name: string;
  shortName: string;
  description: string;
  image: string;
};

export type Product = {
  /** Identifiant stable, utilisé par le panier. Ne le changez pas une fois la boutique en ligne. */
  id: string;
  /** Partie de l'adresse de la page produit : /produit/<slug> */
  slug: string;
  name: string;
  category: CategorySlug;
  /** Prix en centimes TTC. */
  price: number;
  tagline: string;
  description: string[];
  features: string[];
  specs: { label: string; value: string }[];
  inTheBox?: string[];
  images: string[];
  badge?: string;
  inStock: boolean;
  /** Mis en avant sur la page d'accueil. */
  featured?: boolean;
  /** Identifiants des produits proposés en complément. */
  related?: string[];
};

export const categories: Category[] = [
  {
    slug: 'litieres-autonettoyantes',
    name: 'Litières autonettoyantes',
    shortName: 'Litières',
    description:
      'Le bac se nettoie tout seul après chaque passage de votre chat. Il ne vous reste qu’à vider le tiroir à déchets.',
    image: '/images/products/litiere-dome.svg',
  },
  {
    slug: 'fontaines-a-eau',
    name: 'Fontaines à eau',
    shortName: 'Fontaines',
    description:
      'Une eau filtrée qui circule en continu. Beaucoup de chats boivent plus volontiers une eau en mouvement.',
    image: '/images/products/fontaine-inox.svg',
  },
  {
    slug: 'consommables',
    name: 'Consommables',
    shortName: 'Consommables',
    description:
      'Sacs, filtres, litière et recharges pour que vos appareils restent propres et efficaces.',
    image: '/images/products/litiere-vegetale.svg',
  },
];

const LEGAL_WARRANTY = { label: 'Garantie', value: 'Garantie légale de conformité de 2 ans' };

export const products: Product[] = [
  {
    id: 'litiere-dome',
    slug: 'litiere-autonettoyante-dome',
    name: 'Litière autonettoyante Dôme',
    category: 'litieres-autonettoyantes',
    price: 36900,
    tagline: 'Tambour rotatif, capteurs de sécurité et suivi depuis votre téléphone.',
    description: [
      'Quelques minutes après chaque passage, le Dôme fait tourner son tambour. La litière propre est tamisée et les agglomérats tombent dans un tiroir fermé. Votre chat retrouve un bac net à chaque visite.',
      'Des capteurs de poids et de présence interrompent le cycle dès qu’un chat s’approche. Dans l’application, vous réglez le délai de nettoyage, consultez l’historique des passages et recevez une alerte quand le tiroir est plein.',
    ],
    features: [
      'Nettoyage automatique après chaque passage, délai réglable',
      'Capteurs de poids et infrarouges : le cycle s’arrête si un chat approche',
      'Tiroir à déchets fermé de 9 L',
      'Application mobile avec historique, alertes et mode nuit',
      'Convient aux chats de 1,5 à 10 kg',
    ],
    specs: [
      { label: 'Dimensions', value: '60 × 55 × 62 cm' },
      { label: 'Poids', value: '11,5 kg' },
      { label: 'Litière', value: '6 à 8 L de litière agglomérante' },
      { label: 'Tiroir à déchets', value: '9 L' },
      { label: 'Connectivité', value: 'Wi-Fi 2,4 GHz' },
      { label: 'Alimentation', value: 'Adaptateur secteur 12 V fourni' },
      LEGAL_WARRANTY,
    ],
    inTheBox: [
      'Litière Dôme',
      'Tiroir à déchets',
      '1 rouleau de 10 sacs',
      'Tapis d’entrée',
      'Adaptateur secteur',
      'Guide de démarrage',
    ],
    images: ['/images/products/litiere-dome.svg'],
    badge: 'Coup de cœur',
    inStock: true,
    featured: true,
    related: ['sacs-litiere', 'litiere-vegetale', 'recharges-desodorisantes'],
  },
  {
    id: 'litiere-compacte',
    slug: 'litiere-autonettoyante-compacte',
    name: 'Litière autonettoyante Compacte',
    category: 'litieres-autonettoyantes',
    price: 24900,
    tagline: 'L’essentiel du nettoyage automatique dans moins de 50 cm de large.',
    description: [
      'La Compacte se glisse dans une salle de bain ou un placard aménagé. Après chaque passage, son bac tamiseur pivote pour séparer les agglomérats de la litière propre et les déposer dans un compartiment hermétique.',
      'Pas d’application à installer. Un bouton lance un nettoyage manuel et un voyant vous prévient quand le compartiment doit être vidé.',
    ],
    features: [
      'Format réduit : 48 × 52 × 50 cm',
      'Nettoyage automatique 5 minutes après la sortie du chat',
      'Compartiment à déchets hermétique de 6 L',
      'Capteur de présence et arrêt de sécurité',
      'Utilisation simple, sans application',
    ],
    specs: [
      { label: 'Dimensions', value: '48 × 52 × 50 cm' },
      { label: 'Poids', value: '7,8 kg' },
      { label: 'Litière', value: '4 à 5 L de litière agglomérante' },
      { label: 'Compartiment à déchets', value: '6 L' },
      { label: 'Alimentation', value: 'Adaptateur secteur 12 V fourni' },
      { label: 'Chats', value: 'De 1,5 à 7 kg' },
      LEGAL_WARRANTY,
    ],
    inTheBox: [
      'Litière Compacte',
      '1 rouleau de 10 sacs',
      'Pelle de dépannage',
      'Adaptateur secteur',
      'Notice',
    ],
    images: ['/images/products/litiere-compacte.svg'],
    badge: 'Nouveau',
    inStock: true,
    related: ['sacs-litiere', 'litiere-vegetale', 'recharges-desodorisantes'],
  },
  {
    id: 'litiere-ouverte',
    slug: 'litiere-autonettoyante-ouverte',
    name: 'Litière autonettoyante Ouverte',
    category: 'litieres-autonettoyantes',
    price: 17900,
    tagline: 'Un bac ouvert et un râteau automatique, pour les chats qui fuient les litières couvertes.',
    description: [
      'Certains chats refusent d’entrer dans une litière fermée. L’Ouverte garde la forme d’un bac classique et confie le ramassage à un râteau qui passe lentement quelques minutes après chaque visite.',
      'Les déchets rejoignent un compartiment couvert à l’arrière du bac. Le mécanisme fait peu de bruit et se met en pause si votre chat revient.',
    ],
    features: [
      'Bac ouvert, rassurant pour les chats craintifs',
      'Râteau automatique déclenché après chaque passage',
      'Compartiment à déchets couvert',
      'Détection de présence et pause automatique',
      'Démontage sans outil pour le grand nettoyage',
    ],
    specs: [
      { label: 'Dimensions', value: '68 × 45 × 22 cm' },
      { label: 'Poids', value: '5,2 kg' },
      { label: 'Litière', value: 'Environ 4 L de litière agglomérante' },
      { label: 'Alimentation', value: 'Adaptateur secteur 12 V fourni' },
      LEGAL_WARRANTY,
    ],
    inTheBox: [
      'Bac et râteau motorisé',
      'Compartiment à déchets avec couvercle',
      '1 rouleau de 10 sacs',
      'Adaptateur secteur',
      'Notice',
    ],
    images: ['/images/products/litiere-ouverte.svg'],
    inStock: true,
    related: ['sacs-litiere', 'litiere-vegetale', 'nettoyant-enzymatique'],
  },
  {
    id: 'fontaine-inox',
    slug: 'fontaine-a-eau-inox-2l',
    name: 'Fontaine à eau Inox 2 L',
    category: 'fontaines-a-eau',
    price: 4490,
    tagline: 'Plateau en acier inoxydable, pompe silencieuse et filtration en trois couches.',
    description: [
      'L’eau remonte au centre du plateau puis s’écoule en fine nappe vers le réservoir. Ce mouvement attire la plupart des chats et la circulation continue évite l’eau stagnante.',
      'Le plateau en inox passe au lave-vaisselle. La cartouche filtrante retient les poils et les impuretés. Elle se change toutes les 2 à 4 semaines selon l’usage.',
    ],
    features: [
      'Plateau en acier inoxydable, compatible lave-vaisselle',
      'Pompe silencieuse, moins de 30 dB',
      'Filtre en trois couches : mousse, charbon actif et résine',
      'Réservoir de 2 L, adapté à un ou deux chats',
      'Arrêt automatique quand le niveau d’eau est trop bas',
    ],
    specs: [
      { label: 'Capacité', value: '2 L' },
      { label: 'Dimensions', value: 'Ø 19 × 13 cm' },
      { label: 'Matériaux', value: 'Inox 304, plastique sans BPA' },
      { label: 'Alimentation', value: 'USB 5 V, adaptateur fourni' },
      { label: 'Consommation', value: '1,5 W' },
      LEGAL_WARRANTY,
    ],
    inTheBox: ['Fontaine', 'Pompe', '1 filtre', '1 mousse de pré-filtration', 'Câble USB et adaptateur'],
    images: ['/images/products/fontaine-inox.svg'],
    inStock: true,
    featured: true,
    related: ['filtres-fontaine', 'mousses-prefiltration'],
  },
  {
    id: 'fontaine-sans-fil',
    slug: 'fontaine-a-eau-sans-fil-3l',
    name: 'Fontaine sans fil 3 L',
    category: 'fontaines-a-eau',
    price: 6490,
    tagline: 'Pompe sans fil et batterie rechargeable : installez-la où vous voulez.',
    description: [
      'La pompe est alimentée par induction à travers la paroi du réservoir, donc aucun câble ne trempe dans l’eau. La batterie se recharge en USB-C et tient plusieurs semaines en mode détection.',
      'Dans ce mode, l’eau ne coule que lorsqu’un chat s’approche. Le réservoir translucide permet de vérifier le niveau d’un coup d’œil.',
    ],
    features: [
      'Pompe sans fil alimentée par induction',
      'Batterie rechargeable en USB-C',
      'Écoulement continu ou déclenché à l’approche du chat',
      'Réservoir translucide de 3 L',
      'Témoins de batterie et de niveau d’eau',
    ],
    specs: [
      { label: 'Capacité', value: '3 L' },
      { label: 'Dimensions', value: '20 × 20 × 18 cm' },
      { label: 'Batterie', value: '4 000 mAh' },
      { label: 'Autonomie', value: 'Jusqu’à 30 jours en mode détection, selon l’usage' },
      { label: 'Recharge', value: 'USB-C, câble fourni' },
      LEGAL_WARRANTY,
    ],
    inTheBox: ['Fontaine', 'Module batterie', '1 filtre', 'Câble USB-C', 'Notice'],
    images: ['/images/products/fontaine-sans-fil.svg'],
    badge: 'Nouveau',
    inStock: true,
    featured: true,
    related: ['filtres-fontaine', 'mousses-prefiltration'],
  },
  {
    id: 'fontaine-ceramique',
    slug: 'fontaine-a-eau-ceramique-2-5l',
    name: 'Fontaine en céramique 2,5 L',
    category: 'fontaines-a-eau',
    price: 5990,
    tagline: 'Céramique émaillée vert sauge et petit filet d’eau qui attire l’attention.',
    description: [
      'La céramique ne garde pas les odeurs et se lave facilement, au lave-vaisselle ou à la main. Son poids la rend stable, même face à un chat joueur.',
      'Un bec verseur forme un filet d’eau que beaucoup de chats aiment laper. La pompe se retire en quelques secondes pour l’entretien.',
    ],
    features: [
      'Céramique émaillée, compatible lave-vaisselle',
      'Base lourde et stable',
      'Bec verseur et bassin de 2,5 L',
      'Pompe silencieuse, démontable sans outil',
      'Coloris vert sauge',
    ],
    specs: [
      { label: 'Capacité', value: '2,5 L' },
      { label: 'Dimensions', value: 'Ø 22 × 14 cm' },
      { label: 'Poids', value: '2,3 kg' },
      { label: 'Matériau', value: 'Céramique émaillée' },
      { label: 'Alimentation', value: 'USB 5 V, adaptateur fourni' },
      LEGAL_WARRANTY,
    ],
    inTheBox: ['Fontaine en céramique', 'Pompe', '1 filtre', 'Câble USB et adaptateur'],
    images: ['/images/products/fontaine-ceramique.svg'],
    inStock: true,
    related: ['filtres-fontaine', 'mousses-prefiltration'],
  },
  {
    id: 'sacs-litiere',
    slug: 'sacs-litiere-autonettoyante-x60',
    name: 'Sacs pour litière autonettoyante x60',
    category: 'consommables',
    price: 1290,
    tagline: 'Six rouleaux de 10 sacs à cordon, compatibles avec nos trois litières.',
    description: [
      'Des sacs épais à cordon coulissant, taillés pour les tiroirs de nos litières autonettoyantes. Vous fermez le sac et le retirez sans toucher les déchets.',
      'Le film de 25 microns résiste aux angles du tiroir et limite les fuites d’odeurs quand le sac est fermé.',
    ],
    features: [
      '60 sacs, en 6 rouleaux de 10',
      'Cordon de fermeture intégré',
      'Film épais qui ne se déchire pas',
      'Compatibles Dôme, Compacte et Ouverte',
    ],
    specs: [
      { label: 'Contenu', value: '60 sacs' },
      { label: 'Dimensions', value: '45 × 50 cm' },
      { label: 'Matière', value: 'Polyéthylène, 25 µm' },
    ],
    images: ['/images/products/sacs-litiere.svg'],
    inStock: true,
    featured: true,
    related: ['litiere-vegetale', 'recharges-desodorisantes'],
  },
  {
    id: 'litiere-vegetale',
    slug: 'litiere-vegetale-agglomerante-7l',
    name: 'Litière végétale agglomérante 7 L',
    category: 'consommables',
    price: 1190,
    tagline: 'Fibres de pois, agglomérats solides et très peu de poussière.',
    description: [
      'Cette litière forme des agglomérats compacts que les mécanismes de tamisage séparent sans peine. Ses granulés fins soulèvent peu de poussière et collent peu aux pattes.',
      'Un sac de 7 L suffit à remplir une litière autonettoyante. Avec un chat, il dure en général trois à quatre semaines.',
    ],
    features: [
      'Composée de fibres de pois',
      'Agglomérats solides, faciles à tamiser',
      'Très peu de poussière',
      'Sans parfum ajouté',
      'Adaptée aux litières automatiques',
    ],
    specs: [
      { label: 'Contenance', value: '7 L, soit environ 2,8 kg' },
      { label: 'Granulés', value: '2 mm' },
      { label: 'Composition', value: 'Fibres de pois, amidon de maïs' },
      { label: 'Parfum', value: 'Aucun' },
    ],
    images: ['/images/products/litiere-vegetale.svg'],
    inStock: true,
    related: ['sacs-litiere', 'recharges-desodorisantes'],
  },
  {
    id: 'filtres-fontaine',
    slug: 'filtres-fontaine-x6',
    name: 'Filtres pour fontaine x6',
    category: 'consommables',
    price: 1190,
    tagline: 'Cartouches mousse, charbon actif et résine, compatibles avec toutes nos fontaines.',
    description: [
      'Chaque cartouche associe une mousse qui arrête les poils, du charbon actif qui réduit les goûts et les odeurs, et une résine qui limite le calcaire.',
      'Changez le filtre toutes les 2 à 4 semaines. Un lot de six couvre donc trois à six mois d’utilisation.',
    ],
    features: [
      '6 cartouches filtrantes',
      'Mousse, charbon actif et résine',
      'Compatibles Inox, Sans fil et Céramique',
      'À remplacer toutes les 2 à 4 semaines',
    ],
    specs: [
      { label: 'Contenu', value: '6 filtres' },
      { label: 'Durée d’utilisation', value: '2 à 4 semaines par filtre' },
      { label: 'Compatibilité', value: 'Fontaines Inox 2 L, Sans fil 3 L et Céramique 2,5 L' },
    ],
    images: ['/images/products/filtres-fontaine.svg'],
    inStock: true,
    related: ['mousses-prefiltration'],
  },
  {
    id: 'mousses-prefiltration',
    slug: 'mousses-prefiltration-x8',
    name: 'Mousses de pré-filtration x8',
    category: 'consommables',
    price: 690,
    tagline: 'Elles arrêtent les poils avant la pompe et prolongent sa durée de vie.',
    description: [
      'Placée autour de l’entrée de la pompe, la mousse retient les poils et les miettes de croquettes avant qu’ils n’atteignent le moteur.',
      'Rincez-la à chaque nettoyage de la fontaine et remplacez-la environ une fois par mois.',
    ],
    features: [
      '8 mousses de rechange',
      'Protègent la pompe des poils',
      'Rinçables à l’eau claire',
      'Compatibles avec toutes nos fontaines',
    ],
    specs: [
      { label: 'Contenu', value: '8 mousses' },
      { label: 'Remplacement', value: 'Environ une fois par mois' },
      { label: 'Matière', value: 'Mousse polyuréthane' },
    ],
    images: ['/images/products/mousses-prefiltration.svg'],
    inStock: true,
    related: ['filtres-fontaine'],
  },
  {
    id: 'recharges-desodorisantes',
    slug: 'recharges-desodorisantes-x4',
    name: 'Recharges désodorisantes x4',
    category: 'consommables',
    price: 890,
    tagline: 'Des sachets de charbon actif à glisser dans le tiroir à déchets.',
    description: [
      'Le charbon actif capte les odeurs sans les couvrir d’un parfum, que beaucoup de chats n’aiment pas. Chaque recharge se glisse dans le logement prévu à cet effet dans le tiroir.',
      'Comptez environ un mois par recharge avec un chat.',
    ],
    features: [
      '4 recharges au charbon actif',
      'Sans parfum',
      'Pour les tiroirs des litières Dôme et Compacte',
      'Environ un mois par recharge',
    ],
    specs: [
      { label: 'Contenu', value: '4 recharges' },
      { label: 'Durée', value: 'Environ 1 mois chacune' },
      { label: 'Composition', value: 'Charbon actif' },
      { label: 'Compatibilité', value: 'Litières Dôme et Compacte' },
    ],
    images: ['/images/products/recharges-desodorisantes.svg'],
    inStock: true,
    related: ['sacs-litiere', 'litiere-vegetale'],
  },
  {
    id: 'nettoyant-enzymatique',
    slug: 'nettoyant-enzymatique-500ml',
    name: 'Nettoyant enzymatique 500 ml',
    category: 'consommables',
    price: 990,
    tagline: 'Pour le grand nettoyage du bac et du tiroir, sans javel ni parfum fort.',
    description: [
      'Les enzymes décomposent les résidus organiques qui causent les mauvaises odeurs. Vaporisez, laissez agir cinq minutes, puis rincez à l’eau claire.',
      'Sans javel et sans parfum fort, il ne laisse pas d’odeur qui pourrait détourner votre chat de sa litière.',
    ],
    features: [
      'Flacon vaporisateur de 500 ml',
      'Action enzymatique contre les odeurs',
      'Sans javel',
      'Pour bacs, tiroirs à déchets, tapis et sols',
    ],
    specs: [
      { label: 'Contenance', value: '500 ml' },
      { label: 'Utilisation', value: 'Bacs à litière, tiroirs, tapis et sols' },
      { label: 'Parfum', value: 'Aucun' },
    ],
    images: ['/images/products/nettoyant-enzymatique.svg'],
    inStock: true,
    related: ['sacs-litiere', 'litiere-vegetale'],
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((category) => category.slug === slug);
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function getProductsByCategory(slug: CategorySlug): Product[] {
  return products.filter((product) => product.category === slug);
}

export function getFeaturedProducts(): Product[] {
  return products.filter((product) => product.featured);
}

export function getRelatedProducts(product: Product): Product[] {
  return (product.related ?? [])
    .map((id) => getProductById(id))
    .filter((related): related is Product => related !== undefined);
}
