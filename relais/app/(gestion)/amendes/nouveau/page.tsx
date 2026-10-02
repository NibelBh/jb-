import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listVehicles } from '@/lib/data/vehicles';
import { parisDate } from '@/lib/domain/dates';
import { can } from '@/lib/domain/roles';
import { createFineAction } from '../actions';
import { FineFields } from '../FineFields';

export const metadata: Metadata = { title: 'Nouvel avis de contravention' };

export default async function NewFinePage() {
  const ctx = await requireModule('amendes');
  if (!can(ctx.roles, 'amende.modifier')) redirect('/amendes');
  const vehicles = listVehicles(getDb(), ctx.orgId, { includeRetired: true });
  const today = parisDate();

  return (
    <>
      <PageHeader title="Enregistrer un avis de contravention" back={{ href: '/amendes', label: 'Amendes' }} subtitle="Le conducteur est retrouvé automatiquement à partir de l’historique des affectations du véhicule." />
      <section className="card card-body">
        <ActionForm action={createFineAction} submitLabel="Enregistrer l’avis">
          <FineFields vehicles={vehicles} today={today} defaults={{}} />
        </ActionForm>
      </section>
    </>
  );
}
