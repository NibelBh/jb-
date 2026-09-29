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
          <div className="form-grid">
            <div className="field">
              <label htmlFor="vehicleId">Véhicule</label>
              <select id="vehicleId" name="vehicleId" className="input" required>
                <option value="">Choisir…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="noticeNumber">Numéro de l’avis</label>
              <input id="noticeNumber" name="noticeNumber" className="input mono" />
            </div>
            <div className="field">
              <label htmlFor="offenseDay">Date de l’infraction</label>
              <input id="offenseDay" name="offenseDay" type="date" className="input" max={today} required />
            </div>
            <div className="field">
              <label htmlFor="offenseTime">Heure de l’infraction</label>
              <input id="offenseTime" name="offenseTime" type="time" className="input" required />
            </div>
            <div className="field">
              <label htmlFor="noticeSentOn">Date d’envoi de l’avis</label>
              <input id="noticeSentOn" name="noticeSentOn" type="date" className="input" max={today} required />
              <span className="hint">Le délai de 45 jours court à partir de cette date.</span>
            </div>
            <div className="field">
              <label htmlFor="amount">Montant (€)</label>
              <input id="amount" name="amount" className="input" inputMode="decimal" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="location">Lieu</label>
            <input id="location" name="location" className="input" />
          </div>
          <div className="field">
            <label htmlFor="description">Nature de l’infraction</label>
            <input id="description" name="description" className="input" placeholder="Ex. excès de vitesse inférieur à 20 km/h" />
          </div>
          <div className="field">
            <label htmlFor="notice">Scan ou photo de l’avis</label>
            <input id="notice" name="notice" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="input" />
          </div>
        </ActionForm>
      </section>
    </>
  );
}
