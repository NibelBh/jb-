import path from 'node:path';
import type { NextConfig } from 'next';

// L'application vit dans un sous-dossier du dépôt de la boutique : on fixe sa racine
// pour que Next n'utilise pas le package-lock.json du dossier parent.
const root = path.resolve(__dirname);

/**
 * Adresses publiques autorisées à envoyer des formulaires (Server Actions) quand l'application
 * tourne derrière un relais : GitHub Codespaces, tunnel, proxy. Par défaut, seule l'adresse du
 * serveur lui-même est acceptée.
 */
function extraOrigins(): string[] {
  const hosts = (process.env.RELAIS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  const { CODESPACES, CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN } = process.env;
  if (CODESPACES === 'true' && CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    // Codespaces présente l'adresse publique du port, et parfois « localhost » comme origine.
    hosts.push(`${CODESPACE_NAME}-3100.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`, 'localhost:3100');
  }
  return hosts;
}

const origins = extraOrigins();

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
  turbopack: { root },
  allowedDevOrigins: origins.filter((h) => !h.includes(':')),
  experimental: {
    serverActions: {
      allowedOrigins: origins,
      // Les photos sont compressées dans le navigateur, mais une inspection en envoie cinq.
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
