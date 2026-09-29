import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { fullName, getEmployee } from '@/lib/data/employees';
import { can } from '@/lib/domain/roles';
import { updateEmployeeAction } from '../../actions';
import { EmployeeFields } from '../../EmployeeFields';

export const metadata: Metadata = { title: 'Modifier le salarié' };

export default async function EditEmployeePage(props: PageProps<'/personnel/[id]/modifier'>) {
  const ctx = await requireModule('personnel');
  const employeeId = Number((await props.params).id);
  if (!can(ctx.roles, 'personnel.modifier')) redirect(`/personnel/${employeeId}`);
  const employee = Number.isInteger(employeeId) ? getEmployee(getDb(), ctx.orgId, employeeId) : undefined;
  if (!employee) notFound();
  return (
    <>
      <PageHeader title={`Modifier ${fullName(employee)}`} back={{ href: `/personnel/${employee.id}`, label: fullName(employee) }} />
      <section className="card card-body">
        <ActionForm action={updateEmployeeAction} submitLabel="Enregistrer">
          <input type="hidden" name="employeeId" value={employee.id} />
          <EmployeeFields employee={employee} />
        </ActionForm>
      </section>
    </>
  );
}
