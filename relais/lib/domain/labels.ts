/* Libellés français des statuts, partagés par le back-office et l'application chauffeur. */

export const VEHICLE_STATUSES = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'en_tournee', label: 'En tournée' },
  { value: 'bloque', label: 'Bloqué (à vérifier)' },
  { value: 'immobilise', label: 'Immobilisé' },
  { value: 'sorti', label: 'Sorti de flotte' },
] as const;

export const VEHICLE_TYPES = [
  { value: 'fourgon', label: 'Fourgon' },
  { value: 'fourgonnette', label: 'Fourgonnette' },
  { value: 'grand_volume', label: 'Grand volume (12 à 20 m³)' },
  { value: 'autre', label: 'Autre' },
] as const;

export const ENERGIES = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'essence', label: 'Essence' },
  { value: 'electrique', label: 'Électrique' },
  { value: 'hybride', label: 'Hybride' },
  { value: 'gnv', label: 'GNV' },
] as const;

export const EMPLOYEE_STATUSES = [
  { value: 'actif', label: 'Actif' },
  { value: 'periode_essai', label: 'Période d’essai' },
  { value: 'suspendu', label: 'Suspendu' },
  { value: 'sorti', label: 'Sorti' },
] as const;

export const CONTRACT_TYPES = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'interim', label: 'Intérim' },
  { value: 'alternance', label: 'Alternance' },
] as const;

export const POSITIONS = [
  { value: 'chauffeur', label: 'Chauffeur-livreur' },
  { value: 'chef_equipe', label: 'Chef d’équipe' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'manager', label: 'Manager' },
  { value: 'administratif', label: 'Administratif' },
] as const;

export const DRIVING_POSITIONS = ['chauffeur', 'chef_equipe'];

/**
 * Situations qui rendent un salarié indisponible (sauf le retard, qui ne bloque pas la journée).
 * Aucun motif médical : un arrêt maladie est une absence, pas un diagnostic.
 */
export const ABSENCE_TYPES = [
  { value: 'conge', label: 'Congé' },
  { value: 'maladie', label: 'Arrêt maladie' },
  { value: 'accident_travail', label: 'Accident du travail' },
  { value: 'formation', label: 'Formation' },
  { value: 'absence_autorisee', label: 'Absence autorisée' },
  { value: 'absence_injustifiee', label: 'Absence non justifiée' },
  { value: 'situation_autre', label: 'Autre situation' },
  { value: 'retard', label: 'Retard' },
] as const;

export const DAMAGE_TYPES = [
  { value: 'accident', label: 'Accident' },
  { value: 'rayure', label: 'Rayure' },
  { value: 'choc', label: 'Choc' },
  { value: 'pare_brise', label: 'Pare-brise' },
  { value: 'pneu', label: 'Pneu' },
  { value: 'retroviseur', label: 'Rétroviseur' },
  { value: 'carrosserie', label: 'Carrosserie' },
  { value: 'mecanique', label: 'Problème mécanique' },
  { value: 'panne', label: 'Panne' },
  { value: 'autre', label: 'Autre' },
] as const;

export const DAMAGE_STATUSES = [
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'attente_expertise', label: 'En attente d’expertise' },
  { value: 'reparateur_contacte', label: 'Réparateur contacté' },
  { value: 'reparation_planifiee', label: 'Réparation planifiée' },
  { value: 'repare', label: 'Réparé' },
  { value: 'refacturation', label: 'Refacturation en cours' },
  { value: 'cloture', label: 'Clôturé' },
] as const;

export const SEVERITIES = [
  { value: 'mineur', label: 'Mineur' },
  { value: 'moyen', label: 'Moyen' },
  { value: 'grave', label: 'Grave' },
] as const;

export const FINE_STATUSES = [
  { value: 'a_designer', label: 'À désigner' },
  { value: 'designe', label: 'Conducteur désigné' },
  { value: 'conteste', label: 'Contesté' },
  { value: 'paye', label: 'Payé par la société' },
  { value: 'classe', label: 'Classé' },
] as const;

export const DAY_STATUSES = [
  { value: 'travail', label: 'Travail' },
  { value: 'repos', label: 'Repos' },
] as const;

type Option = { readonly value: string; readonly label: string };

export function labelOf(options: readonly Option[], value: string | null | undefined): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? value;
}

export function isOption(options: readonly Option[], value: string): boolean {
  return options.some((o) => o.value === value);
}
