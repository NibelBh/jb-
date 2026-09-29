/*
 * Rôles et droits. Un utilisateur peut cumuler plusieurs rôles :
 * dans une société de 30 véhicules, le dirigeant fait souvent aussi la flotte.
 */

export const ROLES = [
  { value: 'admin', label: 'Administrateur', level: 'admin' },
  { value: 'manager', label: 'Responsable / manager', level: 'responsable' },
  { value: 'flotte', label: 'Responsable flotte', level: 'responsable' },
  { value: 'exploitation', label: 'Responsable d’exploitation', level: 'responsable' },
  { value: 'rh', label: 'RH / planning', level: 'responsable' },
  { value: 'compta', label: 'Comptabilité / administratif', level: 'responsable' },
  { value: 'chauffeur', label: 'Salarié (application chauffeur)', level: 'salarie' },
] as const;

/** Trois niveaux d'accès ; les rôles « responsable » précisent le périmètre. */
export const ACCESS_LEVELS = [
  { value: 'admin', label: 'Administrateur', hint: 'Tout le logiciel, y compris les membres, les paramètres et le journal.' },
  { value: 'responsable', label: 'Responsable / manager', hint: 'Exploitation au quotidien : planning, présences, véhicules, personnel, dommages.' },
  { value: 'salarie', label: 'Salarié', hint: 'Application chauffeur uniquement : son planning, ses véhicules, ses signalements.' },
] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number]['value'];

export function accessLevel(roles: readonly string[]): AccessLevel {
  if (roles.includes('admin')) return 'admin';
  if (roles.some((r) => r !== 'chauffeur')) return 'responsable';
  return 'salarie';
}

export type Role = (typeof ROLES)[number]['value'];

export const MODULES = [
  'aujourdhui',
  'planning',
  'vehicules',
  'personnel',
  'dommages',
  'amendes',
  'documents',
  'paie',
  'imports',
  'journal',
  'parametres',
] as const;

export type Module = (typeof MODULES)[number];

/** Qui peut ouvrir quel module du back-office. */
const ACCESS: Record<Module, Role[]> = {
  aujourdhui: ['admin', 'manager', 'flotte', 'exploitation', 'rh'],
  planning: ['admin', 'manager', 'exploitation', 'rh'],
  vehicules: ['admin', 'manager', 'flotte', 'exploitation', 'compta'],
  personnel: ['admin', 'manager', 'rh', 'exploitation', 'flotte'],
  dommages: ['admin', 'manager', 'flotte', 'compta'],
  amendes: ['admin', 'manager', 'flotte', 'compta'],
  documents: ['admin', 'manager', 'flotte', 'rh'],
  paie: ['admin', 'rh', 'compta'],
  imports: ['admin', 'manager', 'rh', 'flotte'],
  journal: ['admin'],
  parametres: ['admin'],
};

/** Actions sensibles, plus fines que l'accès au module. */
const ACTIONS = {
  'vehicule.modifier': ['admin', 'manager', 'flotte'],
  'vehicule.debloquer': ['admin', 'manager', 'flotte', 'exploitation'],
  'personnel.modifier': ['admin', 'manager', 'rh'],
  'personnel.voir_documents': ['admin', 'manager', 'rh', 'flotte'],
  'planning.modifier': ['admin', 'manager', 'exploitation', 'rh'],
  'presence.confirmer': ['admin', 'manager', 'exploitation', 'rh'],
  'absence.modifier': ['admin', 'manager', 'exploitation', 'rh'],
  'dommage.modifier': ['admin', 'manager', 'flotte'],
  'amende.modifier': ['admin', 'manager', 'flotte', 'compta'],
  'document.modifier': ['admin', 'manager', 'flotte', 'rh'],
  'utilisateur.gerer': ['admin'],
  'paie.gerer': ['admin', 'rh', 'compta'],
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
