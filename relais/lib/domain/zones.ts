/*
 * Zones d'un véhicule utilitaire vu de dessus (l'avant est en haut, le côté conducteur à gauche).
 * Chaque zone a une ou plusieurs formes dans un repère de 200 × 400.
 */

export type ZoneShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { kind: 'polygon'; points: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

export const VEHICLE_ZONES = [
  { value: 'avant', label: 'Avant (pare-chocs, calandre, phares)', short: 'Avant', shapes: [{ kind: 'rect', x: 45, y: 12, w: 110, h: 20, r: 8 }] },
  { value: 'capot', label: 'Capot', short: 'Capot', shapes: [{ kind: 'rect', x: 45, y: 34, w: 110, h: 44, r: 4 }] },
  { value: 'pare_brise', label: 'Pare-brise', short: 'Pare-brise', shapes: [{ kind: 'polygon', points: '48,82 152,82 146,110 54,110' }] },
  { value: 'toit', label: 'Toit', short: 'Toit', shapes: [{ kind: 'rect', x: 50, y: 114, w: 100, h: 220, r: 4 }] },
  { value: 'arriere', label: 'Arrière (portes arrière, pare-chocs, feux)', short: 'Arrière', shapes: [{ kind: 'rect', x: 45, y: 340, w: 110, h: 34, r: 6 }] },
  { value: 'cote_gauche', label: 'Côté gauche (portes, flanc)', short: 'Côté gauche', shapes: [{ kind: 'rect', x: 32, y: 112, w: 14, h: 224, r: 3 }] },
  { value: 'cote_droit', label: 'Côté droit (porte latérale, flanc)', short: 'Côté droit', shapes: [{ kind: 'rect', x: 154, y: 112, w: 14, h: 224, r: 3 }] },
  {
    value: 'vitres',
    label: 'Vitres latérales',
    short: 'Vitres',
    shapes: [
      { kind: 'rect', x: 32, y: 84, w: 12, h: 26, r: 2 },
      { kind: 'rect', x: 156, y: 84, w: 12, h: 26, r: 2 },
    ],
  },
  {
    value: 'retroviseurs',
    label: 'Rétroviseurs',
    short: 'Rétros',
    shapes: [
      { kind: 'ellipse', cx: 20, cy: 96, rx: 10, ry: 7 },
      { kind: 'ellipse', cx: 180, cy: 96, rx: 10, ry: 7 },
    ],
  },
  { value: 'roue_av_g', label: 'Roue / pneu avant gauche', short: 'Roue AV G', shapes: [{ kind: 'rect', x: 16, y: 40, w: 16, h: 36, r: 5 }] },
  { value: 'roue_av_d', label: 'Roue / pneu avant droit', short: 'Roue AV D', shapes: [{ kind: 'rect', x: 168, y: 40, w: 16, h: 36, r: 5 }] },
  { value: 'roue_ar_g', label: 'Roue / pneu arrière gauche', short: 'Roue AR G', shapes: [{ kind: 'rect', x: 16, y: 284, w: 16, h: 36, r: 5 }] },
  { value: 'roue_ar_d', label: 'Roue / pneu arrière droit', short: 'Roue AR D', shapes: [{ kind: 'rect', x: 168, y: 284, w: 16, h: 36, r: 5 }] },
] as const satisfies readonly { value: string; label: string; short: string; shapes: readonly ZoneShape[] }[];

/** Zone hors schéma : dégât intérieur (cabine, soute). */
export const INTERIOR_ZONE = { value: 'interieur', label: 'Intérieur (cabine, soute)', short: 'Intérieur' } as const;

export const ALL_ZONES: readonly { value: string; label: string; short: string }[] = [...VEHICLE_ZONES, INTERIOR_ZONE];

export function parseZones(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const known = new Set(ALL_ZONES.map((z) => z.value));
  return [...new Set(raw.split(',').map((z) => z.trim()))].filter((z) => known.has(z));
}

export function zonesLabel(raw: string | null | undefined): string {
  const zones = parseZones(raw);
  return zones.map((z) => ALL_ZONES.find((a) => a.value === z)?.short ?? z).join(', ');
}
