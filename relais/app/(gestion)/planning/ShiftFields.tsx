'use client';

import { useState } from 'react';

export type EmployeeOption = { id: number; name: string; unavailable: string | null; driver: boolean; vehicleId: number | null };
export type VehicleOption = { id: number; plate: string; problem: string | null };

export type ShiftDefaults = {
  day: string;
  employeeId?: number | null;
  startTime?: string;
  endTime?: string;
  routeName?: string | null;
  vehicleId?: number | null;
  notes?: string | null;
};

const WEEKDAYS = [
  { value: '1', label: 'Lun' },
  { value: '2', label: 'Mar' },
  { value: '3', label: 'Mer' },
  { value: '4', label: 'Jeu' },
  { value: '5', label: 'Ven' },
  { value: '6', label: 'Sam' },
  { value: '0', label: 'Dim' },
];

/** Champs d'une planification : salarié, jour, horaires, tournée, véhicule. */
export function ShiftFields({
  prefix,
  employees,
  vehicles,
  routes,
  defaults,
  repeat = false,
}: {
  prefix: string;
  employees: EmployeeOption[];
  vehicles: VehicleOption[];
  routes: string[];
  defaults: ShiftDefaults;
  repeat?: boolean;
}) {
  // Le véhicule attribué au salarié est proposé d'office ; on peut toujours en choisir un autre.
  const [employeeId, setEmployeeId] = useState<string>(defaults.employeeId ? String(defaults.employeeId) : '');
  const [vehicleId, setVehicleId] = useState<string>(defaults.vehicleId ? String(defaults.vehicleId) : '');
  const attributed = (id: string) => employees.find((e) => String(e.id) === id)?.vehicleId ?? null;
  const onEmployee = (id: string) => {
    const previous = attributed(employeeId);
    if (!vehicleId || (previous && String(previous) === vehicleId)) {
      const next = attributed(id);
      const usable = next && !vehicles.find((v) => v.id === next)?.problem;
      setVehicleId(usable ? String(next) : '');
    }
    setEmployeeId(id);
  };
  const hint = attributed(employeeId);
  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${prefix}-employee`}>Salarié</label>
          <select id={`${prefix}-employee`} name="employeeId" className="input" value={employeeId} onChange={(e) => onEmployee(e.currentTarget.value)}>
            <option value="">Sans salarié (tournée à pourvoir)</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id} disabled={!!e.unavailable && e.id !== defaults.employeeId}>
                {e.name}
                {e.unavailable ? ` (indisponible : ${e.unavailable})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-day`}>Jour</label>
          <input id={`${prefix}-day`} name="day" type="date" className="input" defaultValue={defaults.day} required />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-start`}>Début</label>
          <input id={`${prefix}-start`} name="startTime" type="time" className="input" defaultValue={defaults.startTime ?? '08:00'} required />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-end`}>Fin</label>
          <input id={`${prefix}-end`} name="endTime" type="time" className="input" defaultValue={defaults.endTime ?? '17:00'} required />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-route`}>Tournée</label>
          <input
            id={`${prefix}-route`}
            name="routeName"
            className="input"
            list={`${prefix}-routes`}
            defaultValue={defaults.routeName ?? ''}
            placeholder="Ex. A01 (vide : journée sans tournée)"
            autoComplete="off"
          />
          <datalist id={`${prefix}-routes`}>
            {routes.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-vehicle`}>Véhicule</label>
          <select id={`${prefix}-vehicle`} name="vehicleId" className="input" value={vehicleId} onChange={(e) => setVehicleId(e.currentTarget.value)}>
            <option value="">Aucun</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id} disabled={!!v.problem && v.id !== defaults.vehicleId}>
                {v.plate}
                {v.problem ? ` (${v.problem})` : ''}
                {hint === v.id ? ' · attribué au salarié' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-notes`}>Commentaire</label>
        <input id={`${prefix}-notes`} name="notes" className="input" defaultValue={defaults.notes ?? ''} placeholder="Facultatif" />
      </div>
      {repeat && (
        <details className="disclosure">
          <summary>Répéter sur plusieurs jours</summary>
          <div className="form-grid">
            <div className="field">
              <label htmlFor={`${prefix}-until`}>Jusqu’au (inclus)</label>
              <input id={`${prefix}-until`} name="repeatUntil" type="date" className="input" />
            </div>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="small">Les jours</legend>
              <div className="btn-row">
                {WEEKDAYS.map((w) => (
                  <label key={w.value} className="checkbox">
                    <input type="checkbox" name="weekdays" value={w.value} defaultChecked={w.value !== '0'} /> {w.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <p className="hint">Les jours où le salarié est absent, pas encore arrivé ou déjà pris sur ces horaires sont sautés et signalés.</p>
        </details>
      )}
    </>
  );
}
