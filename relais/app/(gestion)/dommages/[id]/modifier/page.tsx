import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getDamage } from '@/lib/data/cases';
import { listEmployees } from '@/lib/data/employees';
import { listVehicles } from '@/lib/data/vehicles';
import { parisClock, parisDate } from '@/lib/domain/dates';
import { DRIVING_POSITIONS } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { parseZones } from '@/lib/domain/zones';
import { updateDamageAction } from '../../actions';
import { DamageFields } from '../../DamageFields';

export const metadata: Metadata = { title: 'Modifier le dossier' };

export default async function EditDamagePage(props: PageProps<'/dommages/[id]/modifier'>) {
  const ctx = await requireModule('dommages');
  const damageId = Number((await props.params).id);
  if (!can(ctx.roles, 'dommage.modifier')) redirect(`/dommages/${damageId}`);
  const db = getDb();
  const damage = Number.isInteger(damageId) ? getDamage(db, ctx.orgId, damageId) : undefined;
  if (!damage) notFound();
  const vehicles = listVehicles(db, ctx.orgId, { includeRetired: true });
  const drivers = listEmployees(db, ctx.orgId, { includeLeft: true }).filter((e) => DRIVING_POSITIONS.includes(e.position) || e.id === damage.employee_id);

  return (
    <>
      <PageHeader
        title={`Modifier le dossier n° ${damage.id}`}
        subtitle="Les anciennes valeurs restent visibles dans l’historique du dossier. Les photos et le statut se gèrent depuis la fiche du dossier."
        back={{ href: `/dommages/${damage.id}`, label: `Dossier n° ${damage.id}` }}
      />
      <section className="card card-body">
        <ActionForm action={updateDamageAction} submitLabel="Enregistrer les modifications" submitClassName="btn btn-yellow">
          <input type="hidden" name="damageId" value={damage.id} />
          <DamageFields
            vehicles={vehicles}
            drivers={drivers}
            defaults={{
              vehicleId: damage.vehicle_id,
              employeeId: damage.employee_id,
              type: damage.type,
              severity: damage.severity,
              day: parisDate(new Date(damage.occurred_at)),
              time: parisClock(damage.occurred_at),
              zones: parseZones(damage.zones),
              location: damage.location_text,
              description: damage.description,
            }}
          />
        </ActionForm>
      </section>
    </>
  );
}
