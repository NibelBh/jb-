import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { can } from '@/lib/domain/roles';
import { createEmployeeAction } from '../actions';
import { EmployeeFields } from '../EmployeeFields';

export const metadata: Metadata = { title: 'Nouveau salarié' };

export default async function NewEmployeePage() {
  const ctx = await requireModule('personnel');
  if (!can(ctx.roles, 'personnel.modifier')) redirect('/personnel');
  return (
    <>
      <PageHeader title="Nouveau salarié" back={{ href: '/personnel', label: 'Personnel' }} />
      <section className="card card-body">
        <ActionForm action={createEmployeeAction} submitLabel="Créer la fiche">
          <EmployeeFields />
        </ActionForm>
      </section>
    </>
  );
}
