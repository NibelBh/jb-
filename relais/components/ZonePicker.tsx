'use client';

import { useState } from 'react';
import { ALL_ZONES } from '@/lib/domain/zones';
import { VehicleSvg } from './VehicleMap';
import styles from './VehicleMap.module.css';

/**
 * Choix des zones abîmées : on touche le schéma ou on coche la liste (les deux restent synchronisés).
 * Les zones choisies partent dans le champ caché `name`, séparées par des virgules.
 */
export function ZonePicker({ name = 'zones', defaultValue = [], required = false }: { name?: string; defaultValue?: string[]; required?: boolean }) {
  const [zones, setZones] = useState<string[]>(defaultValue);
  const toggle = (zone: string) => setZones((z) => (z.includes(zone) ? z.filter((x) => x !== zone) : [...z, zone]));

  return (
    <div className={styles.picker}>
      <VehicleSvg selected={zones} onToggle={toggle} label="Touchez les zones abîmées sur le schéma" />
      <div className={styles.list} role="group" aria-label="Zones abîmées">
        {ALL_ZONES.map((z) => (
          <label key={z.value} className="checkbox">
            <input type="checkbox" checked={zones.includes(z.value)} onChange={() => toggle(z.value)} /> {z.label}
          </label>
        ))}
        <input type="hidden" name={name} value={zones.join(',')} />
        {required && zones.length === 0 && <span className="hint">Choisissez au moins une zone.</span>}
      </div>
    </div>
  );
}
