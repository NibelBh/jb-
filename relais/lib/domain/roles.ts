/*
 * Rôles et droits. Un utilisateur peut cumuler plusieurs rôles :
 * dans une société de 30 véhicules, le dirigeant fait souvent aussi la flotte.
 */

export const ROLES = [
  { value: 'admin', label: 'Dirigeant / administrateur' },
  { value: 'flotte', label: 'Responsable flotte' },
  { value: 'exploitation', label: 'Responsable d’exploitation' },
  { value: 'rh', label: 'RH / planning' },
  { value: 'compta', label: 'Comptabilité / administratif' },
  { value: 'chauffeur', label: 'Chauffeur' },
] as const;

export type Role = (typeof ROLES)[number]['value'];

export const MODULES = [
  'aujourdhui',
  'planning',
  'vehicules',
  'personnel',
  'dommages',
  'amendes',
  'documents',
  'journal',
  'parametres',
] as const;

export type Module = (typeof MODULES)[number];

/** Qui peut ouvrir quel module du back-office. */
const ACCESS: Record<Module, Role[]> = {
  aujourdhui: ['admin', 'flotte', 'exploitation', 'rh'],
  planning: ['admin', 'exploitation', 'rh'],
  vehicules: ['admin', 'flotte', 'exploitation', 'compta'],
  personnel: ['admin', 'rh', 'exploitation', 'flotte'],
  dommages: ['admin', 'flotte', 'compta'],
  amendes: ['admin', 'flotte', 'compta'],
  documents: ['admin', 'flotte', 'rh'],
  journal: ['admin'],
  parametres: ['admin'],
};

/** Actions sensibles, plus fines que l'accès au module. */
const ACTIONS = {
  'vehicule.modifier': ['admin', 'flotte'],
  'vehicule.debloquer': ['admin', 'flotte', 'exploitation'],
  'personnel.modifier': ['admin', 'rh'],
  'personnel.voir_documents': ['admin', 'rh', 'flotte'],
  'planning.modifier': ['admin', 'exploitation', 'rh'],
  'absence.modifier': ['admin', 'exploitation', 'rh'],
  'dommage.modifier': ['admin', 'flotte'],
  'amende.modifier': ['admin', 'flotte', 'compta'],
  'document.modifier': ['admin', 'flotte', 'rh'],
  'utilisateur.gerer': ['admin'],
} as const satisfies Record<string, Role[]>;

export type Action = keyof typeof ACTIONS;

export function canAccess(roles: Role[], module: Module): boolean {
  return roles.some((r) => ACCESS[module].includes(r));
}

export function can(roles: Role[], action: Action): boolean {
  return roles.some((r) => (ACTIONS[action] as readonly Role[]).includes(r));
}

export function isManager(roles: Role[]): boolean {
  return roles.some((r) => r !== 'chauffeur');
}

export function parseRoles(value: string): Role[] {
  const known = new Set<string>(ROLES.map((r) => r.value));
  return value
    .split(',')
    .map((r) => r.trim())
    .filter((r): r is Role => known.has(r));
}

export function roleLabel(role: string): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}
