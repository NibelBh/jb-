import 'server-only';
import type { Ctx } from '../auth';
import { type Db, all, dryRun, run, transaction } from '../db';
import { normalizeHeader, parseCsv } from '../domain/csv';
import { parisDate } from '../domain/dates';
import { normalizeTime } from '../domain/shifts';
import { DOCUMENT_TYPES, type DocumentEntity } from '../domain/documents';
import {
  type ImportReport,
  cell,
  checkHeader,
  emptyReport,
  mapColumns,
  matchOption,
  parseDateCell,
  parseIntegerCell,
  reportSummary,
} from '../domain/importing';
import { ABSENCE_TYPES, CONTRACT_TYPES, EMPLOYEE_STATUSES, ENERGIES, POSITIONS, VEHICLE_TYPES } from '../domain/labels';
import type { Action } from '../domain/roles';
import { logAudit } from './audit';
import { type EmployeeRow, getEmployee, listEmployees } from './employees';
import { addAbsence, createShifts, listShifts, updateShift } from './planning';
import { type EmployeeInput, type VehicleInput, addDocument, createEmployee, createVehicle, normalizePlate, updateEmployee, updateVehicle } from './records';
import { type VehicleRow, listVehicles } from './vehicles';

type Actor = Pick<Ctx, 'orgId' | 'userId' | 'name' | 'origin'>;

const VEHICLE_ALIASES = {
  plate: ['immatriculation', 'immat', 'plaque', 'plate'],
  vin: ['vin', 'numero_de_serie', 'n_serie'],
  brand: ['marque'],
  model: ['modele'],
  year: ['annee', 'annee_modele', 'millesime'],
  type: ['type', 'type_vehicule', 'categorie'],
  energy: ['energie', 'carburant', 'motorisation'],
  firstReg: ['premiere_immatriculation', 'date_premiere_immatriculation', 'date_de_premiere_immatriculation', 'mise_en_circulation', 'date_mise_en_circulation'],
  km: ['kilometrage', 'km', 'compteur', 'kilometrage_actuel'],
  owner: ['proprietaire', 'loueur', 'proprietaire_ou_loueur'],
  insurer: ['assureur', 'compagnie_assurance', 'assurance'],
  policy: ['contrat_assurance', 'police', 'numero_police', 'n_contrat', 'numero_contrat'],
  insuranceStart: ['debut_assurance', 'date_debut_assurance', 'assurance_du'],
  insuranceEnd: ['fin_assurance', 'echeance_assurance', 'date_fin_assurance', 'expiration_assurance', 'assurance_au'],
  ctLast: ['dernier_controle_technique', 'dernier_ct', 'date_controle_technique', 'date_ct'],
  ctDue: ['echeance_controle_technique', 'echeance_ct', 'prochain_ct', 'prochain_controle_technique'],
  notes: ['notes', 'commentaire', 'remarques'],
};

const EMPLOYEE_ALIASES = {
  payrollId: ['matricule', 'matricule_paie', 'id_paie', 'numero_salarie'],
  lastName: ['nom', 'nom_de_famille'],
  firstName: ['prenom'],
  birthDate: ['date_naissance', 'date_de_naissance', 'ne_le', 'naissance'],
  birthPlace: ['lieu_naissance', 'lieu_de_naissance'],
  nationality: ['nationalite'],
  address: ['adresse', 'adresse_postale', 'rue'],
  postalCode: ['code_postal', 'cp'],
  city: ['ville', 'commune'],
  emergencyName: ['contact_urgence', 'personne_a_prevenir', 'contact_d_urgence'],
  emergencyPhone: ['telephone_urgence', 'tel_urgence', 'telephone_d_urgence'],
  licenceIssued: ['date_obtention_permis', 'obtention_permis', 'permis_obtenu_le', 'date_permis'],
  phone: ['telephone', 'tel', 'portable', 'mobile'],
  email: ['email', 'e_mail', 'mail', 'courriel'],
  position: ['poste', 'fonction', 'emploi'],
  contract: ['contrat', 'type_contrat', 'type_de_contrat'],
  status: ['statut', 'etat'],
  hiredOn: ['date_embauche', 'embauche', 'date_d_embauche', 'date_entree', 'entree'],
  leftOn: ['date_sortie', 'sortie', 'date_de_sortie'],
  licenceNumber: ['numero_permis', 'permis', 'n_permis', 'numero_de_permis'],
  categories: ['categories_permis', 'categories', 'categorie_permis'],
  licenceExpires: ['fin_validite_permis', 'expiration_permis', 'validite_permis', 'permis_valable_jusqu_au'],
  notes: ['notes', 'commentaire', 'remarques'],
};

const ABSENCE_ALIASES = {
  payrollId: ['matricule', 'matricule_paie', 'id_paie'],
  lastName: ['nom'],
  firstName: ['prenom'],
  type: ['type', 'type_absence', 'motif', 'nature'],
  start: ['du', 'debut', 'date_debut', 'date_de_debut', 'de'],
  end: ['au', 'fin', 'date_fin', 'date_de_fin', 'a', 'jusqu_au'],
  note: ['commentaire', 'note', 'notes', 'remarque'],
};

const PLANNING_ALIASES = {
  day: ['date', 'jour'],
  payrollId: ['matricule', 'matricule_paie'],
  lastName: ['nom'],
  firstName: ['prenom'],
  driver: ['salarie', 'chauffeur', 'livreur', 'driver'],
  start: ['debut', 'heure_debut', 'depart', 'heure_depart', 'prise_de_poste'],
  end: ['fin', 'heure_fin', 'retour', 'fin_de_poste'],
  route: ['tournee', 'code_tournee', 'route', 'code'],
  plate: ['vehicule', 'immatriculation', 'plaque', 'van'],
  notes: ['commentaire', 'notes', 'remarques'],
};

const DOCUMENT_ALIASES = {
  plate: ['immatriculation', 'immat', 'plaque', 'vehicule'],
  payrollId: ['matricule', 'matricule_paie'],
  lastName: ['nom'],
  firstName: ['prenom'],
  type: ['type', 'document', 'type_document', 'type_de_document'],
  reference: ['reference', 'numero', 'ref'],
  issuedOn: ['delivre_le', 'date_delivrance', 'date_de_delivrance', 'emis_le', 'debut'],
  expiresOn: ['expire_le', 'date_expiration', 'date_d_expiration', 'expiration', 'fin_validite', 'valable_jusqu_au', 'echeance'],
};

type Column<F extends string> = {
  field: F;
  /** Nom de colonne du modèle (reconnu à l'import, avec ou sans accents ni majuscules). */
  header: string;
  required?: boolean;
  /** Format attendu, rappelé entre parenthèses dans le modèle et expliqué sur la page. */
  format?: string;
  /** Valeurs acceptées ou précision affichée sur la page d'import. */
  hint?: string;
  example: string;
};

type Kind<F extends string> = { label: string; action: Action; help: string; aliases: Record<F, string[]>; columns: Column<F>[] };

function kind<F extends string>(k: Kind<F>): Kind<F> {
  return k;
}

const DATE = 'JJ/MM/AAAA';

export const IMPORT_KINDS = {
  personnel: kind({
    label: 'Personnel',
    action: 'personnel.modifier',
    help: 'Crée les fiches salariés ou complète celles qui existent déjà (reconnues par le matricule de paie, sinon par le nom et le prénom). Une cellule vide ne modifie rien.',
    aliases: EMPLOYEE_ALIASES,
    columns: [
      { field: 'payrollId', header: 'matricule', hint: 'Le matricule de votre logiciel de paie', example: 'M012' },
      { field: 'lastName', header: 'nom', required: true, example: 'DUPONT' },
      { field: 'firstName', header: 'prenom', required: true, example: 'Jean' },
      { field: 'birthDate', header: 'date_naissance', format: DATE, example: '12/05/1990' },
      { field: 'phone', header: 'telephone', example: '06 12 34 56 78' },
      { field: 'email', header: 'email', example: 'jean.dupont@exemple.fr' },
      { field: 'address', header: 'adresse', example: '4 rue des Lilas' },
      { field: 'postalCode', header: 'code_postal', example: '93200' },
      { field: 'city', header: 'ville', example: 'Saint-Denis' },
      { field: 'emergencyName', header: 'contact_urgence', example: 'Marie Dupont' },
      { field: 'emergencyPhone', header: 'telephone_urgence', example: '06 98 76 54 32' },
      { field: 'position', header: 'poste', hint: POSITIONS.map((p) => p.label).join(', '), example: 'Chauffeur-livreur' },
      { field: 'contract', header: 'contrat', hint: CONTRACT_TYPES.map((p) => p.label).join(', '), example: 'CDI' },
      { field: 'status', header: 'statut', hint: EMPLOYEE_STATUSES.map((p) => p.label).join(', '), example: 'Actif' },
      { field: 'hiredOn', header: 'date_embauche', format: DATE, example: '01/09/2026' },
      { field: 'leftOn', header: 'date_sortie', format: DATE, example: '' },
      { field: 'licenceNumber', header: 'numero_permis', example: '123456789012' },
      { field: 'categories', header: 'categories_permis', hint: 'Séparées par une virgule : B, C1, C…', example: 'B' },
      { field: 'licenceIssued', header: 'date_obtention_permis', format: DATE, example: '20/06/2010' },
      { field: 'licenceExpires', header: 'fin_validite_permis', format: DATE, example: '15/03/2034' },
      { field: 'notes', header: 'notes', example: '' },
    ],
  }),
  vehicules: kind({
    label: 'Véhicules',
    action: 'vehicule.modifier',
    help: 'Crée les véhicules absents et complète ceux qui existent déjà (reconnus par l’immatriculation). Une cellule vide ne modifie rien.',
    aliases: VEHICLE_ALIASES,
    columns: [
      { field: 'plate', header: 'immatriculation', required: true, hint: 'Avec ou sans tirets', example: 'AB-123-CD' },
      { field: 'vin', header: 'vin', example: 'VF1MA000000000000' },
      { field: 'brand', header: 'marque', example: 'Renault' },
      { field: 'model', header: 'modele', example: 'Master' },
      { field: 'year', header: 'annee', format: 'AAAA', example: '2023' },
      { field: 'type', header: 'type', hint: VEHICLE_TYPES.map((t) => t.label).join(', '), example: 'Fourgon' },
      { field: 'energy', header: 'energie', hint: ENERGIES.map((t) => t.label).join(', '), example: 'Diesel' },
      { field: 'firstReg', header: 'premiere_immatriculation', format: DATE, example: '15/03/2023' },
      { field: 'km', header: 'kilometrage', format: 'nombre entier', example: '45200' },
      { field: 'owner', header: 'proprietaire', example: 'Loueur longue durée' },
      { field: 'insurer', header: 'assureur', example: 'AXA Flotte' },
      { field: 'policy', header: 'contrat_assurance', example: 'POL-2026-001' },
      { field: 'insuranceStart', header: 'debut_assurance', format: DATE, example: '01/01/2026' },
      { field: 'insuranceEnd', header: 'fin_assurance', format: DATE, example: '31/12/2026' },
      { field: 'ctLast', header: 'dernier_controle_technique', format: DATE, example: '' },
      { field: 'ctDue', header: 'echeance_controle_technique', format: DATE, example: '' },
      { field: 'notes', header: 'notes', example: '' },
    ],
  }),
  planning: kind({
    label: 'Planning (horaires et tournées)',
    action: 'planning.modifier',
    help: 'Crée une planification par ligne. Une tournée déjà planifiée le même jour est mise à jour (salarié, horaires ou véhicule). Mêmes contrôles qu’à la saisie : disponibilité, chevauchements, assurance et contrôle technique.',
    aliases: PLANNING_ALIASES,
    columns: [
      { field: 'day', header: 'date', required: true, format: DATE, example: '05/10/2026' },
      { field: 'payrollId', header: 'matricule', hint: 'Ou le nom et le prénom', example: 'M012' },
      { field: 'lastName', header: 'nom', example: 'DUPONT' },
      { field: 'firstName', header: 'prenom', example: 'Jean' },
      { field: 'start', header: 'debut', required: true, format: 'HH:MM', example: '07:30' },
      { field: 'end', header: 'fin', required: true, format: 'HH:MM', example: '16:00' },
      { field: 'route', header: 'tournee', hint: 'Vide pour une journée sans tournée', example: 'A01' },
      { field: 'plate', header: 'vehicule', hint: 'Immatriculation ; vide = véhicule attribué au salarié', example: 'AB-123-CD' },
      { field: 'notes', header: 'commentaire', example: '' },
    ],
  }),
  absences: kind({
    label: 'Absences et congés',
    action: 'absence.modifier',
    help: 'Ajoute des absences (congés, arrêts, formations…). Une absence identique déjà enregistrée est ignorée. Aucun motif médical.',
    aliases: ABSENCE_ALIASES,
    columns: [
      { field: 'payrollId', header: 'matricule', hint: 'Ou le nom et le prénom', example: 'M012' },
      { field: 'lastName', header: 'nom', example: 'DUPONT' },
      { field: 'firstName', header: 'prenom', example: 'Jean' },
      { field: 'type', header: 'type', required: true, hint: ABSENCE_TYPES.map((t) => t.label).join(', '), example: 'Congé' },
      { field: 'start', header: 'du', required: true, format: DATE, example: '12/10/2026' },
      { field: 'end', header: 'au', format: DATE, hint: 'Vide = un seul jour', example: '16/10/2026' },
      { field: 'note', header: 'commentaire', example: '' },
    ],
  }),
  documents: kind({
    label: 'Documents et échéances',
    action: 'document.modifier',
    help: 'Enregistre les dates d’expiration (assurances, contrôles techniques, permis, titres de séjour…) pour déclencher les alertes. Renseignez l’immatriculation pour un véhicule, ou le matricule ou le nom pour un salarié.',
    aliases: DOCUMENT_ALIASES,
    columns: [
      { field: 'plate', header: 'immatriculation', hint: 'Pour un document de véhicule', example: 'AB-123-CD' },
      { field: 'payrollId', header: 'matricule', hint: 'Pour un document de salarié', example: '' },
      { field: 'lastName', header: 'nom', example: '' },
      { field: 'firstName', header: 'prenom', example: '' },
      { field: 'type', header: 'type', required: true, hint: 'Attestation d’assurance, Contrôle technique, Permis de conduire, Titre de séjour…', example: 'Attestation d’assurance' },
      { field: 'reference', header: 'reference', example: 'POL-2026-001' },
      { field: 'issuedOn', header: 'delivre_le', format: DATE, example: '01/01/2026' },
      { field: 'expiresOn', header: 'expire_le', format: DATE, example: '31/12/2026' },
    ],
  }),
} as const;

export type ImportKind = keyof typeof IMPORT_KINDS;

export function isImportKind(value: string): value is ImportKind {
  return value in IMPORT_KINDS;
}

const ENERGY_SYNONYMS: Record<string, string> = { gazole: 'diesel', gasoil: 'diesel', electrique_ev: 'electrique', ev: 'electrique', hybride_rechargeable: 'hybride' };
const TYPE_SYNONYMS: Record<string, string> = { grand_volume: 'grand_volume', grand_fourgon: 'grand_volume', vul: 'fourgon', utilitaire: 'fourgon' };
const POSITION_SYNONYMS: Record<string, string> = {
  chauffeur: 'chauffeur',
  livreur: 'chauffeur',
  chauffeur_livreur: 'chauffeur',
  driver: 'chauffeur',
  chef_d_equipe: 'chef_equipe',
  chef_equipe: 'chef_equipe',
  regulateur: 'dispatcher',
  responsable: 'manager',
  admin: 'administratif',
};
const CONTRACT_SYNONYMS: Record<string, string> = { apprentissage: 'alternance', professionnalisation: 'alternance' };
const STATUS_SYNONYMS: Record<string, string> = { periode_d_essai: 'periode_essai', essai: 'periode_essai', parti: 'sorti', inactif: 'sorti' };
const ABSENCE_SYNONYMS: Record<string, string> = {
  cp: 'conge',
  conges: 'conge',
  conges_payes: 'conge',
  conge_paye: 'conge',
  rtt: 'conge',
  arret_maladie: 'maladie',
  am: 'maladie',
  injustifiee: 'absence_injustifiee',
  abs_injustifiee: 'absence_injustifiee',
  absence_non_justifiee: 'absence_injustifiee',
  autorisee: 'absence_autorisee',
  absence_autorisee_non_payee: 'absence_autorisee',
};
const DOCUMENT_SYNONYMS: Record<string, string> = {
  ct: 'controle_technique',
  certificat_d_immatriculation: 'carte_grise',
  permis_de_conduire: 'permis',
  cni: 'piece_identite',
  carte_d_identite: 'piece_identite',
  piece_d_identite: 'piece_identite',
  passeport: 'piece_identite',
  titre_de_sejour: 'titre_sejour',
  contrat_de_travail: 'contrat_travail',
  visite_medicale: 'visite_medicale',
  kbis: 'kbis',
};

/**
 * Lance un import. En mode vérification (`commit` faux), tout est exécuté puis annulé :
 * le rapport est exactement celui qu'on obtiendrait en important.
 */
export function runImport(db: Db, ctx: Actor, kind: ImportKind, text: string, commit: boolean): { report: ImportReport; summary: string } {
  const rows = parseCsv(text);
  const report = emptyReport(commit);
  if (rows.length < 2) {
    report.errors.push('Le fichier doit contenir une ligne d’en-tête puis au moins une ligne de données.');
    return { report, summary: reportSummary(report) };
  }
  const header = rows[0];
  const spec = IMPORT_KINDS[kind] as Kind<string>;
  const check = checkHeader(header, spec.aliases, spec.columns.filter((c) => c.required).map((c) => ({ field: c.field, label: c.header })));
  if (check.missing.length) {
    report.errors.push(
      `Colonne${check.missing.length > 1 ? 's' : ''} obligatoire${check.missing.length > 1 ? 's' : ''} absente${check.missing.length > 1 ? 's' : ''} : ${check.missing.map((m) => `« ${m} »`).join(', ')}. Partez du modèle CSV pour avoir les bonnes colonnes.`,
    );
    return { report, summary: reportSummary(report) };
  }
  if (check.repeated.length) {
    report.errors.push(`Colonne${check.repeated.length > 1 ? 's' : ''} en double dans l’en-tête : ${check.repeated.map((m) => `« ${m} »`).join(', ')}. Gardez-en une seule.`);
    return { report, summary: reportSummary(report) };
  }
  for (const u of check.unknown) report.warnings.push(`Colonne « ${u} » non reconnue : elle est ignorée.`);
  // Les lignes vides et la ligne d'exemple du modèle laissée telle quelle sont ignorées, sans décaler les numéros de ligne.
  const exampleKey = (cells: string[]) => cells.map((c) => c.trim().toLowerCase()).join('|');
  const example = exampleKey(spec.columns.map((c) => c.example));
  const col = mapColumns(header, spec.aliases);
  const data = rows.slice(1).map((row, i) => {
    if (row.every((c) => !c.trim())) return null;
    const ordered = spec.columns.map((c) => cell(row, col[c.field]));
    if (exampleKey(ordered) === example) {
      report.warnings.push(`Ligne ${i + 2} : c’est la ligne d’exemple du modèle, elle est ignorée.`);
      return null;
    }
    return row;
  });
  report.rows = data.filter(Boolean).length;

  const work = () => {
    if (kind === 'vehicules') importVehicles(db, ctx, header, data, report);
    else if (kind === 'personnel') importEmployees(db, ctx, header, data, report);
    else if (kind === 'absences') importAbsences(db, ctx, header, data, report);
    else if (kind === 'planning') importPlanning(db, ctx, header, data, report);
    else importDocuments(db, ctx, header, data, report);
    logAudit(db, ctx, {
      action: 'import',
      entityType: 'import',
      entityId: null,
      summary: `Import CSV « ${IMPORT_KINDS[kind].label} » par ${ctx.name} : ${report.created} création(s), ${report.updated} mise(s) à jour, ${report.errors.length} anomalie(s).`,
    });
  };
  if (commit) transaction(db, work);
  else dryRun(db, work);
  return { report, summary: reportSummary(report) };
}

function lineError(report: ImportReport, line: number, message: string) {
  report.errors.push(`Ligne ${line} : ${message}`);
}

// ---------- Véhicules ----------

function importVehicles(db: Db, ctx: Actor, header: string[], data: (string[] | null)[], report: ImportReport) {
  const col = mapColumns(header, VEHICLE_ALIASES);
  const existing = new Map<string, VehicleRow>(listVehicles(db, ctx.orgId, { includeRetired: true }).map((v) => [v.plate, v]));
  const seen = new Set<string>();

  data.forEach((row, index) => {
    if (!row) return;
    const line = index + 2;
    const rawPlate = cell(row, col.plate);
    if (!rawPlate) return lineError(report, line, 'la colonne « immatriculation » est vide (obligatoire).');
    const plate = normalizePlate(rawPlate);
    if (seen.has(plate)) return lineError(report, line, `${plate} apparaît deux fois dans le fichier.`);
    seen.add(plate);

    const year = parseIntegerCell(cell(row, col.year));
    const km = parseIntegerCell(cell(row, col.km));
    const firstReg = parseDateCell(cell(row, col.firstReg));
    const adminDates = [col.insuranceStart, col.insuranceEnd, col.ctLast, col.ctDue].map((c) => parseDateCell(cell(row, c)));
    for (const p of [year, km, firstReg, ...adminDates]) if (!p.ok) return lineError(report, line, p.error);
    if (!year.ok || !km.ok || !firstReg.ok) return;
    const [insuranceStart, insuranceEnd, ctLast, ctDue] = adminDates.map((d) => (d.ok ? d.value : null));
    if (year.value !== null && (year.value < 1990 || year.value > 2100)) return lineError(report, line, `année ${year.value} invalide.`);
    if (km.value !== null && km.value < 0) return lineError(report, line, 'kilométrage négatif.');

    const typeRaw = cell(row, col.type);
    const type = typeRaw ? matchOption(VEHICLE_TYPES, typeRaw, TYPE_SYNONYMS) : null;
    if (typeRaw && !type) return lineError(report, line, `type « ${typeRaw} » inconnu (${VEHICLE_TYPES.map((t) => t.label).join(', ')}).`);
    const energyRaw = cell(row, col.energy);
    const energy = energyRaw ? matchOption(ENERGIES, energyRaw, ENERGY_SYNONYMS) : null;
    if (energyRaw && !energy) return lineError(report, line, `énergie « ${energyRaw} » inconnue (${ENERGIES.map((t) => t.label).join(', ')}).`);

    const current = existing.get(plate);
    const pick = (value: string, fallback: string | null) => (value ? value : fallback);
    const input: VehicleInput = {
      plate,
      vin: pick(cell(row, col.vin).toUpperCase(), current?.vin ?? null),
      brand: pick(cell(row, col.brand), current?.brand ?? null),
      model: pick(cell(row, col.model), current?.model ?? null),
      year: year.value ?? current?.year ?? null,
      type: type ?? current?.type ?? 'fourgon',
      energy: energy ?? current?.energy ?? 'diesel',
      first_registration_on: firstReg.value ?? current?.first_registration_on ?? null,
      initial_km: current ? current.initial_km : (km.value ?? 0),
      insurer: pick(cell(row, col.insurer), current?.insurer ?? null),
      insurance_policy: pick(cell(row, col.policy), current?.insurance_policy ?? null),
      insurance_start_on: insuranceStart ?? current?.insurance_start_on ?? null,
      insurance_end_on: insuranceEnd ?? current?.insurance_end_on ?? null,
      ct_last_on: ctLast ?? current?.ct_last_on ?? null,
      ct_expires_on: ctDue ?? current?.ct_expires_on ?? null,
      owner: pick(cell(row, col.owner), current?.owner ?? null),
      notes: pick(cell(row, col.notes), current?.notes ?? null),
    };

    if (!current) {
      const result = createVehicle(db, ctx, input);
      if (result.error) return lineError(report, line, result.error);
      report.created++;
      return;
    }
    const error = updateVehicle(db, ctx, current.id, input);
    if (error) return lineError(report, line, error);
    // Un kilométrage plus élevé que le dernier relevé met le compteur à jour, jamais l'inverse.
    if (km.value !== null && km.value > current.current_km) {
      run(db, `UPDATE vehicles SET current_km = ? WHERE id = ? AND org_id = ?`, km.value, current.id, ctx.orgId);
      logAudit(db, ctx, {
        action: 'kilometrage',
        entityType: 'vehicle',
        entityId: current.id,
        summary: `Le kilométrage de ${plate} a été modifié de ${current.current_km} km à ${km.value} km (import CSV).`,
        changes: [{ field: 'current_km', label: 'Kilométrage', before: current.current_km, after: km.value }],
      });
    } else if (km.value !== null && km.value < current.current_km) {
      lineError(report, line, `kilométrage ${km.value} inférieur au dernier relevé (${current.current_km}) : non modifié.`);
    }
    report.updated++;
  });
}

// ---------- Salariés ----------

export type EmployeeIndex = { byPayrollId: Map<string, EmployeeRow>; byName: Map<string, EmployeeRow[]> };

export function employeeIndex(db: Db, orgId: number): EmployeeIndex {
  const byPayrollId = new Map<string, EmployeeRow>();
  const byName = new Map<string, EmployeeRow[]>();
  for (const e of listEmployees(db, orgId, { includeLeft: true })) {
    if (e.payroll_id) byPayrollId.set(e.payroll_id.toUpperCase(), e);
    const key = nameKey(e.last_name, e.first_name);
    byName.set(key, [...(byName.get(key) ?? []), e]);
  }
  return { byPayrollId, byName };
}

function nameKey(lastName: string, firstName: string): string {
  return `${normalizeHeader(lastName)}|${normalizeHeader(firstName)}`;
}

/** Retrouve un salarié par matricule, sinon par nom et prénom (refus en cas d'homonymes). */
export function findEmployee(index: EmployeeIndex, payrollId: string, lastName: string, firstName: string): { employee?: EmployeeRow; error?: string } {
  if (payrollId) {
    const e = index.byPayrollId.get(payrollId.toUpperCase());
    if (e) return { employee: e };
    if (!lastName) return { error: `matricule ${payrollId} inconnu.` };
  }
  if (!lastName || !firstName) return { error: 'indiquez le matricule, ou le nom et le prénom.' };
  const matches = index.byName.get(nameKey(lastName, firstName)) ?? [];
  if (matches.length > 1) return { error: `plusieurs salariés s’appellent ${firstName} ${lastName} : précisez le matricule.` };
  if (matches.length === 0) return { error: `salarié ${firstName} ${lastName} introuvable.` };
  return { employee: matches[0] };
}

function importEmployees(db: Db, ctx: Actor, header: string[], data: (string[] | null)[], report: ImportReport) {
  const col = mapColumns(header, EMPLOYEE_ALIASES);
  const index = employeeIndex(db, ctx.orgId);
  const seenPayroll = new Set<string>();

  data.forEach((row, i) => {
    if (!row) return;
    const line = i + 2;
    const lastName = cell(row, col.lastName);
    const firstName = cell(row, col.firstName);
    if (!lastName || !firstName) return lineError(report, line, 'les colonnes « nom » et « prenom » sont obligatoires.');
    const payrollId = cell(row, col.payrollId);
    if (payrollId) {
      if (seenPayroll.has(payrollId.toUpperCase())) return lineError(report, line, `matricule ${payrollId} présent deux fois dans le fichier.`);
      seenPayroll.add(payrollId.toUpperCase());
    }

    const dates = [col.hiredOn, col.leftOn, col.licenceExpires, col.birthDate, col.licenceIssued].map((c) => parseDateCell(cell(row, c)));
    for (const d of dates) if (!d.ok) return lineError(report, line, d.error);
    const [hiredOn, leftOn, licenceExpires, birthDate, licenceIssued] = dates.map((d) => (d.ok ? d.value : null));

    const positionRaw = cell(row, col.position);
    const position = positionRaw ? matchOption(POSITIONS, positionRaw, POSITION_SYNONYMS) : null;
    if (positionRaw && !position) return lineError(report, line, `poste « ${positionRaw} » inconnu (${POSITIONS.map((p) => p.label).join(', ')}).`);
    const contractRaw = cell(row, col.contract);
    const contract = contractRaw ? matchOption(CONTRACT_TYPES, contractRaw, CONTRACT_SYNONYMS) : null;
    if (contractRaw && !contract) return lineError(report, line, `contrat « ${contractRaw} » inconnu.`);
    const statusRaw = cell(row, col.status);
    const status = statusRaw ? matchOption(EMPLOYEE_STATUSES, statusRaw, STATUS_SYNONYMS) : null;
    if (statusRaw && !status) return lineError(report, line, `statut « ${statusRaw} » inconnu.`);
    const categoriesRaw = cell(row, col.categories);
    const categories = categoriesRaw
      ? [...new Set(categoriesRaw.toUpperCase().split(/[\s,;/+]+/).filter((c) => /^(AM|A1|A2|A|B|BE|B96|C1|C1E|C|CE|D1|D1E|D|DE)$/.test(c)))].join(',')
      : null;

    // Un matricule inconnu mais un nom connu : on complète la fiche existante.
    const found = payrollId && index.byPayrollId.has(payrollId.toUpperCase()) ? index.byPayrollId.get(payrollId.toUpperCase()) : undefined;
    const byName = index.byName.get(nameKey(lastName, firstName)) ?? [];
    if (!found && byName.length > 1 && !payrollId) return lineError(report, line, `plusieurs salariés s’appellent ${firstName} ${lastName} : ajoutez le matricule.`);
    const current = found ?? (byName.length === 1 && (!payrollId || !byName[0].payroll_id) ? byName[0] : undefined);

    const pick = (value: string, fallback: string | null) => (value ? value : fallback);
    const input: EmployeeInput = {
      payroll_id: payrollId || current?.payroll_id || null,
      first_name: current ? current.first_name : firstName,
      last_name: current ? current.last_name : lastName,
      birth_date: birthDate ?? current?.birth_date ?? null,
      birth_place: pick(cell(row, col.birthPlace), current?.birth_place ?? null),
      nationality: pick(cell(row, col.nationality), current?.nationality ?? null),
      address: pick(cell(row, col.address), current?.address ?? null),
      postal_code: pick(cell(row, col.postalCode), current?.postal_code ?? null),
      city: pick(cell(row, col.city), current?.city ?? null),
      emergency_name: pick(cell(row, col.emergencyName), current?.emergency_name ?? null),
      emergency_phone: pick(cell(row, col.emergencyPhone), current?.emergency_phone ?? null),
      licence_issued_on: licenceIssued ?? current?.licence_issued_on ?? null,
      email: pick(cell(row, col.email), current?.email ?? null),
      phone: pick(cell(row, col.phone), current?.phone ?? null),
      position: position ?? current?.position ?? 'chauffeur',
      contract_type: contract ?? current?.contract_type ?? null,
      status: status ?? current?.status ?? 'actif',
      hired_on: hiredOn ?? current?.hired_on ?? null,
      left_on: leftOn ?? current?.left_on ?? null,
      licence_number: pick(cell(row, col.licenceNumber), current?.licence_number ?? null),
      licence_categories: categories ?? current?.licence_categories ?? 'B',
      licence_expires_on: licenceExpires ?? current?.licence_expires_on ?? null,
      notes: pick(cell(row, col.notes), current?.notes ?? null),
    };

    if (current) {
      const error = updateEmployee(db, ctx, current.id, input);
      if (error) return lineError(report, line, error);
      report.updated++;
    } else {
      const result = createEmployee(db, ctx, input);
      if (result.error) return lineError(report, line, result.error);
      report.created++;
    }
  });
}

// ---------- Absences ----------

function importAbsences(db: Db, ctx: Actor, header: string[], data: (string[] | null)[], report: ImportReport) {
  const col = mapColumns(header, ABSENCE_ALIASES);
  const index = employeeIndex(db, ctx.orgId);
  const today = parisDate();
  const seen = new Map<string, number>();

  data.forEach((row, i) => {
    if (!row) return;
    const line = i + 2;
    const who = findEmployee(index, cell(row, col.payrollId), cell(row, col.lastName), cell(row, col.firstName));
    if (!who.employee) return lineError(report, line, who.error ?? 'salarié introuvable.');
    const typeRaw = cell(row, col.type);
    const type = matchOption(ABSENCE_TYPES, typeRaw, ABSENCE_SYNONYMS);
    if (!type) return lineError(report, line, `type « ${typeRaw} » inconnu (${ABSENCE_TYPES.map((t) => t.label).join(', ')}).`);
    const start = parseDateCell(cell(row, col.start));
    const end = parseDateCell(cell(row, col.end));
    if (!start.ok) return lineError(report, line, start.error);
    if (!end.ok) return lineError(report, line, end.error);
    if (!start.value) return lineError(report, line, 'la colonne « du » est vide (obligatoire).');
    const endOn = end.value ?? start.value;
    if (endOn < start.value) return lineError(report, line, 'la date « au » est avant la date « du ».');
    const key = `${who.employee.id}|${type}|${start.value}|${endOn}`;
    if (seen.has(key)) return lineError(report, line, `doublon de la ligne ${seen.get(key)} (même salarié, même type, mêmes dates).`);
    seen.set(key, line);

    const duplicate = all<{ id: number }>(
      db,
      `SELECT id FROM absences WHERE org_id = ? AND employee_id = ? AND type = ? AND start_on = ? AND end_on = ?`,
      ctx.orgId,
      who.employee.id,
      type,
      start.value,
      endOn,
    );
    if (duplicate.length > 0) {
      report.skipped++;
      report.warnings.push(`Ligne ${line} : cette absence est déjà enregistrée, elle est ignorée.`);
      return;
    }
    const { error } = addAbsence(db, ctx, { employeeId: who.employee.id, type, startOn: start.value, endOn, note: cell(row, col.note) || null }, today);
    if (error) return lineError(report, line, error);
    report.created++;
  });
}

// ---------- Planning ----------

function importPlanning(db: Db, ctx: Actor, header: string[], data: (string[] | null)[], report: ImportReport) {
  const col = mapColumns(header, PLANNING_ALIASES);
  const index = employeeIndex(db, ctx.orgId);
  const vehicles = listVehicles(db, ctx.orgId);
  const plateKey = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const seenRoutes = new Map<string, number>();

  data.forEach((row, i) => {
    if (!row) return;
    const line = i + 2;
    const day = parseDateCell(cell(row, col.day));
    if (!day.ok) return lineError(report, line, day.error);
    if (!day.value) return lineError(report, line, 'la colonne « date » est vide (obligatoire).');
    if (!cell(row, col.start) || !cell(row, col.end)) return lineError(report, line, 'les colonnes « debut » et « fin » sont obligatoires.');
    const start = normalizeTime(cell(row, col.start));
    const end = normalizeTime(cell(row, col.end));
    if (!start) return lineError(report, line, `heure de début « ${cell(row, col.start)} » illisible (attendu HH:MM, par exemple 07:30).`);
    if (!end) return lineError(report, line, `heure de fin « ${cell(row, col.end)} » illisible (attendu HH:MM, par exemple 16:00).`);

    let employeeId: number | null = null;
    const payrollId = cell(row, col.payrollId);
    let lastName = cell(row, col.lastName);
    let firstName = cell(row, col.firstName);
    const full = cell(row, col.driver);
    if (!lastName && full) {
      const parts = full.split(/\s+/);
      firstName = parts.shift() ?? '';
      lastName = parts.join(' ');
    }
    if (payrollId || lastName) {
      const who = findEmployee(index, payrollId, lastName, firstName);
      if (!who.employee) return lineError(report, line, who.error ?? 'salarié introuvable.');
      employeeId = who.employee.id;
    }
    const plateText = cell(row, col.plate);
    const vehicle = plateText ? vehicles.find((v) => plateKey(v.plate) === plateKey(plateText)) : undefined;
    if (plateText && !vehicle) return lineError(report, line, `véhicule ${plateText} introuvable.`);
    const routeName = cell(row, col.route).toUpperCase() || null;
    if (routeName) {
      const key = `${day.value}|${routeName}`;
      if (seenRoutes.has(key)) return lineError(report, line, `la tournée ${routeName} du ${cell(row, col.day)} figure déjà ligne ${seenRoutes.get(key)}.`);
      seenRoutes.set(key, line);
    }
    // Sans véhicule précisé, une tournée part avec le véhicule attribué au salarié.
    const attributed = !plateText && routeName && employeeId ? (getEmployee(db, ctx.orgId, employeeId)?.vehicle_id ?? null) : null;
    const fields = { employeeId, startTime: start, endTime: end, routeName, vehicleId: vehicle?.id ?? attributed, notes: cell(row, col.notes) || null };

    const existing = routeName ? listShifts(db, ctx.orgId, { from: day.value, to: day.value }).find((s) => s.route_name?.toLowerCase() === routeName.toLowerCase()) : undefined;
    if (existing) {
      const error = updateShift(db, ctx, existing.id, { ...fields, day: day.value });
      if (error) return lineError(report, line, error);
      report.updated++;
    } else {
      const result = createShifts(db, ctx, fields, [day.value]);
      if (result.error) return lineError(report, line, result.error);
      report.created++;
    }
  });
}

// ---------- Documents ----------

function importDocuments(db: Db, ctx: Actor, header: string[], data: (string[] | null)[], report: ImportReport) {
  const col = mapColumns(header, DOCUMENT_ALIASES);
  const vehicles = new Map(listVehicles(db, ctx.orgId, { includeRetired: true }).map((v) => [v.plate, v]));
  const index = employeeIndex(db, ctx.orgId);

  data.forEach((row, i) => {
    if (!row) return;
    const line = i + 2;
    const plateRaw = cell(row, col.plate);
    let entity: DocumentEntity;
    let entityId: number;
    if (plateRaw) {
      const vehicle = vehicles.get(normalizePlate(plateRaw));
      if (!vehicle) return lineError(report, line, `véhicule ${plateRaw} introuvable (importez d’abord les véhicules).`);
      entity = 'vehicle';
      entityId = vehicle.id;
    } else if (cell(row, col.payrollId) || cell(row, col.lastName)) {
      const who = findEmployee(index, cell(row, col.payrollId), cell(row, col.lastName), cell(row, col.firstName));
      if (!who.employee) return lineError(report, line, who.error ?? 'salarié introuvable.');
      entity = 'employee';
      entityId = who.employee.id;
    } else {
      entity = 'organization';
      entityId = ctx.orgId;
    }
    const typeRaw = cell(row, col.type);
    const type = matchOption(DOCUMENT_TYPES[entity], typeRaw, DOCUMENT_SYNONYMS);
    if (!type || !DOCUMENT_TYPES[entity].some((t) => t.value === type)) {
      return lineError(report, line, `type « ${typeRaw} » inconnu pour ${entity === 'vehicle' ? 'un véhicule' : entity === 'employee' ? 'un salarié' : 'l’entreprise'}.`);
    }
    const issued = parseDateCell(cell(row, col.issuedOn));
    const expires = parseDateCell(cell(row, col.expiresOn));
    if (!issued.ok) return lineError(report, line, issued.error);
    if (!expires.ok) return lineError(report, line, expires.error);

    const duplicate = all<{ id: number }>(
      db,
      `SELECT id FROM documents WHERE org_id = ? AND entity_type = ? AND entity_id = ? AND type = ? AND COALESCE(expires_on, '') = ? AND COALESCE(reference, '') = ?`,
      ctx.orgId,
      entity,
      entityId,
      type,
      expires.value ?? '',
      cell(row, col.reference),
    );
    if (duplicate.length > 0) {
      report.skipped++;
      report.warnings.push(`Ligne ${line} : ce document est déjà enregistré, il est ignoré.`);
      return;
    }
    const error = addDocument(db, ctx, {
      entity,
      entityId,
      type,
      reference: cell(row, col.reference) || null,
      issuedOn: issued.value,
      expiresOn: expires.value,
      fileId: null,
    });
    if (error) return lineError(report, line, error);
    report.created++;
  });
}

export type ImportColumn = { header: string; required: boolean; format: string | null; hint: string | null; example: string };

/** Colonnes d'un import, pour la page d'aide. */
export function importColumns(kind: ImportKind): ImportColumn[] {
  return (IMPORT_KINDS[kind] as Kind<string>).columns.map((c) => ({ header: c.header, required: !!c.required, format: c.format ?? null, hint: c.hint ?? null, example: c.example }));
}

/**
 * Modèle CSV d'un import : en-têtes (astérisque = obligatoire, format entre parenthèses) puis une ligne d'exemple.
 * Les en-têtes du modèle sont reconnus tels quels à l'import.
 */
export function importTemplate(kind: ImportKind): { header: string[]; example: string[] } {
  const columns = importColumns(kind);
  return {
    header: columns.map((c) => `${c.header}${c.required ? '*' : ''}${c.format ? ` (${c.format})` : ''}`),
    example: columns.map((c) => c.example),
  };
}
