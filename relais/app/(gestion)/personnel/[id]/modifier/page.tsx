import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { fullName, getEmployee } from '@/lib/data/employees';
import { listVehicles } from '@/lib/data/vehicles';
import { DRIVING_POSITIONS } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { updateEmployeeAction } from '../../actions';
import { EmployeeFields } from '../../EmployeeFields';

export const metadata: Metadata = { title: 'Modifier le salarié' };

export default async function EditEmployeePage(props: PageProps<'/personnel/[id]/modifier'>) {
  const ctx = await requireModule('personnel');
  const employeeId = Number((await props.params).id);
  if (!can(ctx.roles, 'personnel.modifier')) redirect(`/personnel/${employeeId}`);
  const db = getDb();
  const employee = Number.isInteger(employeeId) ? getEmployee(db, ctx.orgId, employeeId) : undefined;
  if (!employee) notFound();
  const vehicles = listVehicles(db, ctx.orgId);
  const driver = DRIVING_POSITIONS.includes(employee.position);
  return (
    <>
      <PageHeader title={`Modifier ${fullName(employee)}`} back={{ href: `/personnel/${employee.id}`, label: fullName(employee) }} />
      <section className="card card-body">
        <ActionForm action={updateEmployeeAction} submitLabel="Enregistrer les modifications" submitClassName="btn btn-yellow" className="form">
          <input type="hidden" name="employeeId" value={employee.id} />
          <EmployeeFields employee={employee} />
          <fieldset className="form-grid fieldset">
            <legend>Véhicule attribué</legend>
            <div className="field">
              <label htmlFor="vehicle_id">Véhicule</label>
              <select id="vehicle_id" name="vehicle_id" className="input" defaultValue={employee.vehicle_id ?? ''} disabled={!driver && !employee.vehicle_id}>
                <option value="">Aucun</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id} disabled={!!v.holder_id && v.holder_id !== employee.id}>
                    {v.plate} {[v.brand, v.model].filter(Boolean).join(' ')}
                    {v.holder_id && v.holder_id !== employee.id ? ` (attribué à ${v.holder_name})` : ''}
                  </option>
                ))}
              </select>
              <span className="hint">{driver ? 'Proposé d’office quand vous planifiez ce salarié.' : 'Réservé aux postes de conduite.'}</span>
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
