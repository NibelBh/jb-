import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { fullName, listEmployees } from '@/lib/data/employees';
import { getVehicle, listVehicles, vehicleHolder } from '@/lib/data/vehicles';
import { DRIVING_POSITIONS } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { updateVehicleAction } from '../../actions';
import { VehicleFields } from '../../VehicleFields';

export const metadata: Metadata = { title: 'Modifier le véhicule' };

export default async function EditVehiclePage(props: PageProps<'/vehicules/[id]/modifier'>) {
  const ctx = await requireModule('vehicules');
  const vehicleId = Number((await props.params).id);
  if (!can(ctx.roles, 'vehicule.modifier')) redirect(`/vehicules/${vehicleId}`);
  const db = getDb();
  const vehicle = Number.isInteger(vehicleId) ? getVehicle(db, ctx.orgId, vehicleId) : undefined;
  if (!vehicle) notFound();
  const holder = vehicleHolder(db, ctx.orgId, vehicle.id);
  const drivers = listEmployees(db, ctx.orgId).filter((e) => DRIVING_POSITIONS.includes(e.position));
  const plates = new Map(listVehicles(db, ctx.orgId, { includeRetired: true }).map((v) => [v.id, v.plate]));
  return (
    <>
      <PageHeader title={`Modifier ${vehicle.plate}`} back={{ href: `/vehicules/${vehicle.id}`, label: vehicle.plate }} />
      <section className="card card-body">
        <ActionForm action={updateVehicleAction} submitLabel="Enregistrer les modifications" submitClassName="btn btn-yellow" className="form">
          <input type="hidden" name="vehicleId" value={vehicle.id} />
          <VehicleFields vehicle={vehicle} />
          <fieldset className="form-grid fieldset">
            <legend>Kilométrage actuel</legend>
            <div className="field">
              <label htmlFor="current_km">Compteur</label>
              <input id="current_km" name="current_km" type="number" min={0} className="input" defaultValue={vehicle.current_km} />
              <span className="hint">Mis à jour automatiquement à chaque prise et restitution du véhicule.</span>
            </div>
            <div className="field">
              <label htmlFor="km_reason">Motif de la correction</label>
              <input id="km_reason" name="km_reason" className="input" placeholder="Ex. erreur de saisie du chauffeur" />
            </div>
          </fieldset>
          <fieldset className="form-grid fieldset">
            <legend>Attribution</legend>
            <div className="field">
              <label htmlFor="holder_id">Attribué à</label>
              <select id="holder_id" name="holder_id" className="input" defaultValue={holder?.id ?? ''}>
                <option value="">Personne (véhicule partagé)</option>
                {drivers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {fullName(e)}
                    {e.vehicle_id && e.vehicle_id !== vehicle.id ? ` (a déjà ${plates.get(e.vehicle_id)}, il sera remplacé)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox" style={{ alignSelf: 'center' }}>
              <input type="checkbox" name="apply_vehicle" defaultChecked /> Mettre aussi à jour ses planifications à venir
            </label>
          </fieldset>
        </ActionForm>
      </section>
    </>
  );
}
