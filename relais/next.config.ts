import path from 'node:path';
import type { NextConfig } from 'next';

// L'application vit dans un sous-dossier du dépôt de la boutique : on fixe sa racine
// pour que Next n'utilise pas le package-lock.json du dossier parent.
const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
  turbopack: { root },
  experimental: {
    serverActions: {
      // Les photos sont compressées dans le navigateur, mais une inspection en envoie cinq.
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
