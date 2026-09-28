<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Projet Tigerz

Boutique en ligne de produits pour chats (litières autonettoyantes, fontaines, consommables).

- Next.js 16 (App Router), sans base de données. Catalogue dans `lib/products.ts`, prix en centimes TTC.
- Configuration de la boutique (contact, livraison, informations légales) dans `lib/site.ts`.
- Le panier vit dans `localStorage` (`lib/cart-store.ts`) et se lit avec `useSyncExternalStore` (`components/cart/CartProvider.tsx`).
- Paiement : Stripe Checkout via `app/api/checkout/route.ts`. Le serveur ne fait jamais confiance aux prix envoyés par le navigateur : `lib/checkout.ts` recalcule tout depuis le catalogue. Sans `STRIPE_SECRET_KEY`, la route répond 503 avec un message en français.
- Styles : CSS Modules et variables CSS dans `app/globals.css` (palette crème, marron, vert). Pas de Tailwind.
- Textes du site en français, apostrophe typographique (’), sans tirets cadratins.
- Avant de livrer : `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
