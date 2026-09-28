# Tigerz

Boutique en ligne de produits pour chats : litières autonettoyantes, fontaines à eau et consommables. Charte graphique blanc crème, marron et vert.

Le site est construit avec Next.js 16. Le paiement passe par Stripe Checkout, il n'y a donc ni base de données ni back-office à gérer : les commandes arrivent dans votre tableau de bord Stripe.

## Ce que contient le site

- Accueil, boutique en trois rayons (litières, fontaines, consommables) et une fiche détaillée par produit
- Panier avec tiroir latéral, conservé dans le navigateur, et barre de progression vers la livraison offerte
- Paiement sécurisé Stripe (carte, Apple Pay, Google Pay) puis page de confirmation de commande
- Pages À propos, Contact, Questions fréquentes, Livraison et retours
- Modèles de CGV, mentions légales et politique de confidentialité
- Référencement : plan du site, balises de partage, données structurées produit
- Version mobile, navigation au clavier, contrastes conformes WCAG AA

## Lancer le site sur votre ordinateur

Il faut Node.js 22 ou plus récent.

```bash
npm install
npm run dev
```

Ouvrez ensuite http://localhost:3000.

## Personnaliser la boutique

| Ce que vous voulez changer | Fichier |
| --- | --- |
| Nom, e-mail, téléphone, réseaux sociaux | `lib/site.ts` (bloc `site`) |
| Frais, seuil de livraison offerte, délais, pays livrés | `lib/site.ts` (bloc `shipping`) |
| Raison sociale, SIRET, médiateur, hébergeur | `lib/site.ts` (bloc `legal`) |
| Produits, prix, descriptions, caractéristiques | `lib/products.ts` |
| Photos des produits | `public/images/products/` |
| Questions fréquentes | `lib/faq.ts` |
| Couleurs | `app/globals.css` (variables en haut du fichier) |
| Polices | `app/layout.tsx` |

Quelques règles pour le catalogue :

- les prix sont en centimes TTC : `4490` affiche 44,90 € ;
- l'`id` d'un produit sert au panier, ne le modifiez plus une fois la boutique ouverte ;
- `inStock: false` affiche « Rupture de stock » et bloque l'achat ;
- `featured: true` place le produit dans la sélection de l'accueil.

Les produits et les illustrations fournis sont des exemples. Remplacez-les par vos articles et vos photos : format carré conseillé (1200 × 1200 px), en JPG, PNG ou WebP, sur fond clair ou transparent. Déposez le fichier dans `public/images/products/` puis indiquez son chemin dans le champ `images` du produit.

## Activer le paiement

Tant qu'aucune clé Stripe n'est configurée, le site fonctionne mais le bouton de paiement affiche un message indiquant que le paiement n'est pas encore activé.

1. Créez un compte sur [stripe.com](https://stripe.com) et complétez les informations de votre entreprise.
2. Dans le tableau de bord, ouvrez Développeurs, puis Clés API, et copiez la clé secrète de test (elle commence par `sk_test_`).
3. Copiez le fichier `.env.example` en `.env.local` et collez la clé dans `STRIPE_SECRET_KEY`.
4. Relancez `npm run dev` et passez une commande avec la carte de test `4242 4242 4242 4242` (date d'expiration future, code de sécurité au choix).
5. Les commandes apparaissent dans Stripe, rubrique Paiements, avec l'adresse de livraison et le téléphone du client.

Dans les réglages Stripe, pensez aussi à activer l'envoi automatique des reçus aux clients, les e-mails de notification pour chaque paiement, et les moyens de paiement que vous acceptez. Les codes promo se créent dans Stripe, rubrique Coupons, et se saisissent sur la page de paiement.

Le jour de l'ouverture, remplacez la clé de test par la clé live (`sk_live_`).

Les prix affichés sont TTC et Stripe ne recalcule pas la TVA : votre comptabilité reste à tenir de votre côté.

## Mettre le site en ligne

L'hébergement le plus simple pour Next.js est [Vercel](https://vercel.com), gratuit pour démarrer.

1. Créez un compte Vercel avec votre compte GitHub.
2. Cliquez sur Add New, puis Project, et importez ce dépôt.
3. Dans Environment Variables, ajoutez `STRIPE_SECRET_KEY` et `NEXT_PUBLIC_SITE_URL` (l'adresse de votre site, par exemple `https://www.tigerz.fr`).
4. Lancez le déploiement, puis reliez votre nom de domaine dans Settings, rubrique Domains.

Chaque modification envoyée sur GitHub met ensuite le site à jour automatiquement.

## Avant d'ouvrir la boutique

- Remplacez toutes les valeurs entre crochets dans `lib/site.ts`. Elles apparaissent telles quelles dans les mentions légales, les CGV et la politique de confidentialité.
- Changez l'adresse `contact@tigerz.fr`, qui n'est qu'un exemple.
- Adhérez à un médiateur de la consommation (obligatoire pour vendre aux particuliers) et indiquez ses coordonnées.
- Vendre des appareils électriques impose de s'enregistrer auprès d'un éco-organisme de la filière DEEE, de répercuter l'éco-participation et de reprendre gratuitement l'ancien appareil du client. Renseignez-vous auprès d'un éco-organisme agréé.
- Faites relire les CGV et la politique de confidentialité par un juriste. Les textes fournis sont des modèles.
- Vérifiez sur le site de l'INPI que le nom Tigerz est disponible avant de le déposer comme marque.
- N'affichez que de vrais avis clients. Le site n'en contient volontairement aucun.

## Commandes utiles

```bash
npm run dev        # site en local, rechargé à chaque modification
npm run build      # version de production
npm run start      # lance la version de production
npm run lint       # vérifie le code
npm run typecheck  # vérifie les types TypeScript
npm test           # tests du panier, de la livraison et du paiement
```

## Organisation du code

```
app/                  pages du site (une route par dossier)
  api/checkout/       création de la session de paiement Stripe
  produit/[slug]/     fiche produit
  boutique/           boutique et pages de rayon
components/           éléments d'interface (en-tête, panier, cartes produit…)
lib/                  catalogue, configuration, calculs du panier et de la livraison
public/images/        illustrations, image de partage
tests/                tests automatiques (Vitest)
```

Le panier est enregistré dans le navigateur du client. Au moment de payer, le serveur recalcule les prix à partir de `lib/products.ts` : un client ne peut pas modifier le montant de sa commande.
