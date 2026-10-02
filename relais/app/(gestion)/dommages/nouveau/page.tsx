import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listEmployees } from '@/lib/data/employees';
import { listVehicles } from '@/lib/data/vehicles';
import { parisDate } from '@/lib/domain/dates';
import { DRIVING_POSITIONS } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { createDamageAction } from '../actions';
import { DamageFields } from '../DamageFields';

export const metadata: Metadata = { title: 'Nouveau dossier dommage' };

export default async function NewDamagePage(props: PageProps<'/dommages/nouveau'>) {
  const ctx = await requireModule('dommages');
  if (!can(ctx.roles, 'dommage.modifier')) redirect('/dommages');
  const params = await props.searchParams;
  const db = getDb();
  const vehicles = listVehicles(db, ctx.orgId);
  const drivers = listEmployees(db, ctx.orgId).filter((e) => DRIVING_POSITIONS.includes(e.position));
  const preselected = typeof params.vehicule === 'string' ? params.vehicule : '';

  return (
    <>
      <PageHeader title="Ouvrir un dossier dommage" back={{ href: '/dommages', label: 'Dommages' }} subtitle="Pour un constat fait au dépôt. Les chauffeurs, eux, déclarent depuis leur application." />
      <section className="card card-body">
        <ActionForm action={createDamageAction} submitLabel="Créer le dossier">
          <DamageFields vehicles={vehicles} drivers={drivers} defaults={{ vehicleId: preselected ? Number(preselected) : null, day: parisDate(), time: '08:00' }} />
          <div className="field">
            <label htmlFor="photos">Photos</label>
            <input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="input" />
          </div>
          <label className="checkbox">
            <input type="checkbox" name="injured" /> Une personne a été blessée (accident du travail à déclarer sous 48 h)
          </label>
        </ActionForm>
      </section>
    </>
  );
}
