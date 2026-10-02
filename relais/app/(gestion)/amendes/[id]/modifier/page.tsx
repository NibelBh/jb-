import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getFine } from '@/lib/data/cases';
import { listVehicles } from '@/lib/data/vehicles';
import { parisClock, parisDate } from '@/lib/domain/dates';
import { can } from '@/lib/domain/roles';
import { updateFineAction } from '../../actions';
import { FineFields } from '../../FineFields';

export const metadata: Metadata = { title: 'Modifier l’avis' };

export default async function EditFinePage(props: PageProps<'/amendes/[id]/modifier'>) {
  const ctx = await requireModule('amendes');
  const fineId = Number((await props.params).id);
  if (!can(ctx.roles, 'amende.modifier')) redirect(`/amendes/${fineId}`);
  const db = getDb();
  const fine = Number.isInteger(fineId) ? getFine(db, ctx.orgId, fineId) : undefined;
  if (!fine) notFound();
  const vehicles = listVehicles(db, ctx.orgId, { includeRetired: true });
  return (
    <>
      <PageHeader title={`Modifier l’avis ${fine.notice_number ?? `n° ${fine.id}`}`} back={{ href: `/amendes/${fine.id}`, label: 'Retour à l’avis' }} />
      <section className="card card-body">
        <ActionForm action={updateFineAction} submitLabel="Enregistrer les modifications" submitClassName="btn btn-yellow">
          <input type="hidden" name="fineId" value={fine.id} />
          <FineFields
            vehicles={vehicles}
            today={parisDate()}
            defaults={{
              vehicleId: fine.vehicle_id,
              noticeNumber: fine.notice_number,
              offenseDay: parisDate(new Date(fine.offense_at)),
              offenseTime: parisClock(fine.offense_at),
              noticeSentOn: fine.notice_sent_on,
              amount: fine.amount_cents === null ? '' : (fine.amount_cents / 100).toFixed(2).replace('.', ','),
              location: fine.location,
              description: fine.description,
              hasNotice: !!fine.notice_file_id,
            }}
          />
        </ActionForm>
      </section>
    </>
  );
}
