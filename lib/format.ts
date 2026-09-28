const NARROW_NBSP = ' ';
const NBSP = ' ';

/**
 * Formate un montant en centimes au format français : 1 234,50 €.
 *
 * On n'utilise pas Intl.NumberFormat pour garantir exactement le même texte
 * côté serveur et côté navigateur (sinon React signale une erreur d'hydratation
 * sur certains navigateurs).
 */
export function formatPrice(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
  const centimes = (abs % 100).toString().padStart(2, '0');
  return `${sign}${euros},${centimes}${NBSP}€`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count}${NBSP}${count > 1 ? plural : singular}`;
}
