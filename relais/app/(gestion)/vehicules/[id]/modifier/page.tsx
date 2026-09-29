import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getVehicle } from '@/lib/data/vehicles';
import { can } from '@/lib/domain/roles';
import { updateVehicleAction } from '../../actions';
import { VehicleFields } from '../../VehicleFields';

export const metadata: Metadata = { title: 'Modifier le véhicule' };

export default async function EditVehiclePage(props: PageProps<'/vehicules/[id]/modifier'>) {
  const ctx = await requireModule('vehicules');
  const vehicleId = Number((await props.params).id);
  if (!can(ctx.roles, 'vehicule.modifier')) redirect(`/vehicules/${vehicleId}`);
  const vehicle = Number.isInteger(vehicleId) ? getVehicle(getDb(), ctx.orgId, vehicleId) : undefined;
  if (!vehicle) notFound();
  return (
    <>
      <PageHeader title={`Modifier ${vehicle.plate}`} back={{ href: `/vehicules/${vehicle.id}`, label: vehicle.plate }} />
      <section className="card card-body">
        <ActionForm action={updateVehicleAction} submitLabel="Enregistrer">
          <input type="hidden" name="vehicleId" value={vehicle.id} />
          <VehicleFields vehicle={vehicle} />
        </ActionForm>
      </section>
    </>
  );
}
