import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listAudit } from '@/lib/data/audit';
import { listDamages, listFines } from '@/lib/data/cases';
import { listEmployees } from '@/lib/data/employees';
import { listVehicles } from '@/lib/data/vehicles';
import { toCsv } from '@/lib/domain/csv';
import { formatDate, formatDateTime, parisDate } from '@/lib/domain/dates';
import { DAMAGE_STATUSES, DAMAGE_TYPES, EMPLOYEE_STATUSES, ENERGIES, FINE_STATUSES, POSITIONS, SEVERITIES, VEHICLE_STATUSES, labelOf } from '@/lib/domain/labels';
import { type Module, canAccess } from '@/lib/domain/roles';

const EXPORTS: Record<string, { module: Module; build: (orgId: number) => string }> = {
  vehicules: {
    module: 'vehicules',
    build: (orgId) =>
      toCsv(
        ['Immatriculation', 'VIN', 'Marque', 'Modèle', 'Année', 'Énergie', 'Statut', 'Kilométrage', 'Première immatriculation', 'Chauffeur actuel', 'Propriétaire'],
        listVehicles(getDb(), orgId, { includeRetired: true }).map((v) => [
          v.plate,
          v.vin,
          v.brand,
          v.model,
          v.year,
          labelOf(ENERGIES, v.energy),
          labelOf(VEHICLE_STATUSES, v.status),
          v.current_km,
          formatDate(v.first_registration_on),
          v.driver_name,
          v.owner,
        ]),
      ),
  },
  personnel: {
    module: 'personnel',
    build: (orgId) =>
      toCsv(
        ['Matricule', 'Nom', 'Prénom', 'Poste', 'Statut', 'Téléphone', 'E-mail', 'Embauche', 'Sortie', 'Catégories permis', 'Fin de validité permis'],
        listEmployees(getDb(), orgId, { includeLeft: true }).map((e) => [
          e.payroll_id,
          e.last_name,
          e.first_name,
          labelOf(POSITIONS, e.position),
          labelOf(EMPLOYEE_STATUSES, e.status),
          e.phone,
          e.email,
          formatDate(e.hired_on),
          formatDate(e.left_on),
          e.licence_categories,
          formatDate(e.licence_expires_on),
        ]),
      ),
  },
  dommages: {
    module: 'dommages',
    build: (orgId) =>
      toCsv(
        ['N°', 'Véhicule', 'Type', 'Gravité', 'Statut', 'Chauffeur', 'Survenu le', 'Description', 'Coût estimé (€)', 'Coût final (€)'],
        listDamages(getDb(), orgId).map((d) => [
          d.id,
          d.plate,
          labelOf(DAMAGE_TYPES, d.type),
          labelOf(SEVERITIES, d.severity),
          labelOf(DAMAGE_STATUSES, d.status),
          d.employee_name,
          formatDateTime(d.occurred_at),
          d.description,
          d.estimated_cost_cents !== null ? (d.estimated_cost_cents / 100).toFixed(2).replace('.', ',') : '',
          d.final_cost_cents !== null ? (d.final_cost_cents / 100).toFixed(2).replace('.', ',') : '',
        ]),
      ),
  },
  amendes: {
    module: 'amendes',
    build: (orgId) =>
      toCsv(
        ['Avis', 'Véhicule', 'Infraction', 'Lieu', 'Envoyé le', 'Statut', 'Conducteur désigné', 'Désigné le'],
        listFines(getDb(), orgId).map((f) => [
          f.notice_number,
          f.plate,
          formatDateTime(f.offense_at),
          f.location,
          formatDate(f.notice_sent_on),
          labelOf(FINE_STATUSES, f.status),
          f.employee_name,
          formatDate(f.designated_on),
        ]),
      ),
  },
  journal: {
    module: 'journal',
    build: (orgId) =>
      toCsv(
        ['Date', 'Auteur', 'Origine', 'Action', 'Résumé', 'Détail'],
        listAudit(getDb(), orgId, { limit: 10000 }).map((a) => [formatDateTime(a.created_at), a.actor, a.origin, a.action, a.summary, a.changes]),
      ),
  },
};

export async function GET(_request: Request, ctx: RouteContext<'/api/export/[type]'>) {
  const session = await getSession();
  if (!session) return new Response('Non connecté', { status: 401 });
  const { type } = await ctx.params;
  const exp = EXPORTS[type];
  if (!exp) return new Response('Export inconnu', { status: 404 });
  if (!canAccess(session.roles, exp.module)) return new Response('Accès refusé', { status: 403 });
  return new Response(exp.build(session.orgId), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${type}-${parisDate()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
