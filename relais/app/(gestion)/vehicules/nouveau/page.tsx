import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { can } from '@/lib/domain/roles';
import { createVehicleAction } from '../actions';
import { VehicleFields } from '../VehicleFields';

export const metadata: Metadata = { title: 'Nouveau véhicule' };

export default async function NewVehiclePage() {
  const ctx = await requireModule('vehicules');
  if (!can(ctx.roles, 'vehicule.modifier')) redirect('/vehicules');
  return (
    <>
      <PageHeader title="Nouveau véhicule" back={{ href: '/vehicules', label: 'Véhicules' }} />
      <section className="card card-body">
        <ActionForm action={createVehicleAction} submitLabel="Créer le véhicule">
          <VehicleFields />
        </ActionForm>
      </section>
    </>
  );
}
