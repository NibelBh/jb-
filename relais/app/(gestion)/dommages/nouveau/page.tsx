import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { requireModule } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listEmployees } from '@/lib/data/employees';
import { listVehicles } from '@/lib/data/vehicles';
import { parisDate } from '@/lib/domain/dates';
import { DAMAGE_TYPES, DRIVING_POSITIONS, SEVERITIES } from '@/lib/domain/labels';
import { can } from '@/lib/domain/roles';
import { createDamageAction } from '../actions';

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
      <PageHeader title="Ouvrir un dossier dommage" back={{ href: '/dommages', label: 'Dommages' }} subtitle="Les chauffeurs déclarent depuis leur application ; ce formulaire sert aux constats faits au dépôt." />
      <section className="card card-body">
        <ActionForm action={createDamageAction} submitLabel="Créer le dossier">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="vehicleId">Véhicule</label>
              <select id="vehicleId" name="vehicleId" className="input" defaultValue={preselected} required>
                <option value="">Choisir…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="employeeId">Chauffeur concerné</label>
              <select id="employeeId" name="employeeId" className="input">
                <option value="">Inconnu ou aucun</option>
                {drivers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="type">Type</label>
              <select id="type" name="type" className="input">
                {DAMAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="severity">Gravité</label>
              <select id="severity" name="severity" className="input" defaultValue="moyen">
                {SEVERITIES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="day">Date</label>
              <input id="day" name="day" type="date" className="input" defaultValue={parisDate()} required />
            </div>
            <div className="field">
              <label htmlFor="time">Heure</label>
              <input id="time" name="time" type="time" className="input" defaultValue="08:00" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="location">Lieu</label>
            <input id="location" name="location" className="input" />
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" className="input" required />
          </div>
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
