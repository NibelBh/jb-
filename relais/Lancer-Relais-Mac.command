#!/bin/bash
# Lance Relais sur un Mac : double-cliquez sur ce fichier
# (la première fois : clic droit, Ouvrir, puis Ouvrir, car il vient d'Internet).
cd "$(dirname "$0")" || exit 1

pause_and_exit() {
  echo
  read -r -p "Appuyez sur Entrée pour fermer cette fenêtre." _
  exit "$1"
}

echo
echo "  RELAIS : lancement sur cet ordinateur"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Il est nécessaire pour faire tourner Relais."
  echo " 1. Sur la page qui s'ouvre, téléchargez la version LTS et installez-la."
  echo " 2. Relancez ensuite ce fichier."
  open "https://nodejs.org/fr/download" 2>/dev/null || xdg-open "https://nodejs.org/fr/download" 2>/dev/null
  pause_and_exit 1
fi

if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"; then
  echo "Votre version de Node.js ($(node -v)) est trop ancienne pour Relais."
  echo "Installez la version LTS depuis https://nodejs.org puis relancez ce fichier."
  pause_and_exit 1
fi

if [ ! -d node_modules ]; then
  echo "Première utilisation : installation, 2 à 5 minutes selon la connexion..."
  npm ci || { echo "Erreur pendant l'installation : faites une capture de cette fenêtre."; pause_and_exit 1; }
fi

if [ ! -f .next/BUILD_ID ]; then
  echo "Préparation de l'application, 1 à 3 minutes..."
  npm run build || { echo "Erreur pendant la préparation : faites une capture de cette fenêtre."; pause_and_exit 1; }
fi

echo
echo "Relais démarre. Le navigateur va s'ouvrir tout seul sur http://localhost:3100"
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
if [ -n "$IP" ]; then
  echo "Pour essayer l'application chauffeur sur un téléphone branché sur le même Wi-Fi : http://$IP:3100"
fi
echo "Laissez cette fenêtre ouverte pendant l'utilisation. Fermez-la pour arrêter Relais."
echo

# Ouvre le navigateur dès que le serveur répond.
(
  for _ in $(seq 1 90); do
    if curl -fs -o /dev/null http://localhost:3100/connexion; then
      open http://localhost:3100 2>/dev/null || xdg-open http://localhost:3100 2>/dev/null
      break
    fi
    sleep 1
  done
) &

RELAIS_COOKIE_SECURE=0 npm start
