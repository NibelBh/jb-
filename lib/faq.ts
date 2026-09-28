import { formatPrice } from './format';
import { returns, shipping } from './site';

export type FaqItem = { question: string; answer: string };
export type FaqGroup = { title: string; items: FaqItem[] };

export const faqGroups: FaqGroup[] = [
  {
    title: 'Les produits',
    items: [
      {
        question: 'Mon chat va-t-il accepter une litière autonettoyante ?',
        answer:
          'La plupart des chats s’y habituent en quelques jours. Laissez l’appareil éteint la première semaine et gardez l’ancien bac à côté, puis activez le nettoyage automatique. Si votre chat se méfie des espaces fermés, la litière Ouverte est souvent la plus facile à adopter.',
      },
      {
        question: 'Quelle litière utiliser dans un modèle autonettoyant ?',
        answer:
          'Une litière agglomérante, minérale ou végétale, qui forme des blocs solides. Évitez les litières en silice et les granulés de bois non agglomérants, que le mécanisme ne sait pas trier.',
      },
      {
        question: 'Les litières autonettoyantes conviennent-elles aux chatons ?',
        answer:
          'Nos modèles détectent les chats à partir de 1,5 kg environ. En dessous, désactivez le nettoyage automatique et lancez les cycles vous-même quand le chaton n’est pas dans la pièce.',
      },
      {
        question: 'À quelle fréquence changer le filtre de la fontaine ?',
        answer:
          'Toutes les 2 à 4 semaines selon le nombre de chats et la dureté de l’eau. Profitez-en pour rincer la pompe et laver le réservoir.',
      },
    ],
  },
  {
    title: 'Commande et paiement',
    items: [
      {
        question: 'Quels moyens de paiement acceptez-vous ?',
        answer:
          'Carte bancaire (CB, Visa, Mastercard), Apple Pay et Google Pay. Le paiement passe par Stripe : vos coordonnées bancaires ne sont jamais stockées sur notre site.',
      },
      {
        question: 'Puis-je utiliser un code promo ?',
        answer: 'Oui, un champ prévu à cet effet apparaît sur la page de paiement.',
      },
    ],
  },
  {
    title: 'Livraison et retours',
    items: [
      {
        question: 'Quels sont les délais et frais de livraison ?',
        answer: `${shipping.dispatchDelay}. La livraison standard coûte ${formatPrice(shipping.standard.price)} et devient gratuite dès ${formatPrice(shipping.freeShippingThreshold)} d’achat. La livraison express coûte ${formatPrice(shipping.express.price)}.`,
      },
      {
        question: 'Dans quels pays livrez-vous ?',
        answer: `Nous livrons en ${shipping.countryNames}.`,
      },
      {
        question: 'Puis-je retourner un produit ?',
        answer: `Oui. Vous disposez de ${returns.days} jours après réception pour changer d’avis, sans avoir à vous justifier. Écrivez-nous pour obtenir l’adresse de retour. Nous vous remboursons au plus tard 14 jours après votre demande, dès réception du colis ou de sa preuve d’expédition.`,
      },
    ],
  },
];

export const homeFaq: FaqItem[] = [
  faqGroups[0].items[0],
  faqGroups[0].items[1],
  faqGroups[2].items[0],
  faqGroups[2].items[2],
];
