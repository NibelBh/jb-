import 'server-only';
import type { Ctx } from '../auth';
import { type Db, all, dryRun, run, transaction } from '../db';
import { normalizeHeader, parseCsv } from '../domain/csv';
import { parisDate } from '../domain/dates';
import { DOCUMENT_TYPES, type DocumentEntity } from '../domain/documents';
import {
  type ImportReport,
  cell,
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
import { type EmployeeRow, listEmployees } from './employees';
import { addAbsence } from './planning';
import { type EmployeeInput, type VehicleInput, addDocument, createEmployee, createVehicle, normalizePlate, updateEmployee, updateVehicle } from './records';
import { type VehicleRow, listVehicles } from './vehicles';

type Actor = Pick<Ctx, 'orgId' | 'userId' | 'name' | 'origin'>;

export const IMPORT_KINDS = {
  vehicules: {
    label: 'Véhicules',
    action: 'vehicule.modifier',
    help: 'Crée les véhicules absents et complète ceux qui existent déjà (reconnus par l’immatriculation). Une cellule vide ne modifie rien.',
    columns: ['immatriculation*', 'vin', 'marque', 'modele', 'annee', 'type', 'energie', 'premiere_immatriculation', 'kilometrage', 'proprietaire', 'notes'],
    example: ['AB-123-CD', 'VF1MA000000000000', 'Renault', 'Master', '2023', 'Fourgon', 'Diesel', '15/03/2023', '45200', 'Loueur longue durée', ''],
  },
  personnel: {
    label: 'Personnel',
    action: 'personnel.modifier',
    help: 'Crée ou complète les fiches salariés, reconnues par le matricule de paie, sinon par le nom et le prénom.',
    columns: ['matricule', 'nom*', 'prenom*', 'telephone', 'email', 'poste', 'contrat', 'statut', 'date_embauche', 'date_sortie', 'numero_permis', 'categories_permis', 'fin_validite_permis', 'notes'],
    example: ['M012', 'DUPONT', 'Jean', '06 12 34 56 78', 'jean.dupont@exemple.fr', 'Chauffeur-livreur', 'CDI', 'Actif', '01/09/2026', '', '123456789012', 'B', '15/03/2034', ''],
  },
  absences: {
    label: 'Absences et congés',
    action: 'absence.modifier',
    help: 'Ajoute des absences (congés, arrêts, formations…). Une absence identique déjà enregistrée est ignorée. Aucun motif médical.',
    columns: ['matricule', 'nom', 'prenom', 'type*', 'du*', 'au', 'commentaire'],
    example: ['M012', 'DUPONT', 'Jean', 'Congé', '12/10/2026', '16/10/2026', ''],
  },
  documents: {
    label: 'Documents et échéances',
    action: 'document.modifier',
    help: 'Enregistre les dates d’expiration (assurances, contrôles techniques, permis, titres de séjour…) pour déclencher les alertes. Renseignez l’immatriculation pour un véhicule, ou le matricule ou le nom pour un salarié.',
    columns: ['immatriculation', 'matricule', 'nom', 'prenom', 'type*', 'reference', 'delivre_le', 'expire_le'],
    example: ['AB-123-CD', '', '', '', 'Attestation d’assurance', 'POL-2026-001', '01/01/2026', '31/12/2026'],
  },
} as const satisfies Record<string, { label: string; action: Action; help: string; columns: string[]; example: string[] }>;

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
  const data = rows.slice(1);
  report.rows = data.length;

  const work = () => {
    if (kind === 'vehicules') importVehicles(db, ctx, header, data, report);
    else if (kind === 'personnel') importEmployees(db, ctx, header, data, report);
    else if (kind === 'absences') importAbsences(db, ctx, header, data, report);
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

function importVehicles(db: Db, ctx: Actor, header: string[], data: string[][], report: ImportReport) {
  const col = mapColumns(header, {
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
    notes: ['notes', 'commentaire', 'remarques'],
  });
  if (col.plate < 0) {
    report.errors.push('Colonne « immatriculation » introuvable.');
    return;
  }
  const existing = new Map<string, VehicleRow>(listVehicles(db, ctx.orgId, { includeRetired: true }).map((v) => [v.plate, v]));
  const seen = new Set<string>();

  data.forEach((row, index) => {
    const line = index + 2;
    const rawPlate = cell(row, col.plate);
    if (!rawPlate) return lineError(report, line, 'immatriculation vide.');
    const plate = normalizePlate(rawPlate);
    if (seen.has(plate)) return lineError(report, line, `${plate} apparaît deux fois dans le fichier.`);
    seen.add(plate);

    const year = parseIntegerCell(cell(row, col.year));
    const km = parseIntegerCell(cell(row, col.km));
    const firstReg = parseDateCell(cell(row, col.firstReg));
    for (const p of [year, km, firstReg]) if (!p.ok) return lineError(report, line, p.error);
    if (!year.ok || !km.ok || !firstReg.ok) return;
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

function importEmployees(db: Db, ctx: Actor, header: string[], data: string[][], report: ImportReport) {
  const col = mapColumns(header, {
    payrollId: ['matricule', 'matricule_paie', 'id_paie', 'numero_salarie'],
    lastName: ['nom', 'nom_de_famille'],
    firstName: ['prenom'],
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
  });
  if (col.lastName < 0 || col.firstName < 0) {
    report.errors.push('Colonnes « nom » et « prenom » obligatoires.');
    return;
  }
  const index = employeeIndex(db, ctx.orgId);
  const seenPayroll = new Set<string>();

  data.forEach((row, i) => {
    const line = i + 2;
    const lastName = cell(row, col.lastName);
    const firstName = cell(row, col.firstName);
    if (!lastName || !firstName) return lineError(report, line, 'nom et prénom obligatoires.');
    const payrollId = cell(row, col.payrollId);
    if (payrollId) {
      if (seenPayroll.has(payrollId.toUpperCase())) return lineError(report, line, `matricule ${payrollId} présent deux fois dans le fichier.`);
      seenPayroll.add(payrollId.toUpperCase());
    }

    const dates = [parseDateCell(cell(row, col.hiredOn)), parseDateCell(cell(row, col.leftOn)), parseDateCell(cell(row, col.licenceExpires))];
    for (const d of dates) if (!d.ok) return lineError(report, line, d.error);
    const [hiredOn, leftOn, licenceExpires] = dates.map((d) => (d.ok ? d.value : null));

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

function importAbsences(db: Db, ctx: Actor, header: string[], data: string[][], report: ImportReport) {
  const col = mapColumns(header, {
    payrollId: ['matricule', 'matricule_paie', 'id_paie'],
    lastName: ['nom'],
    firstName: ['prenom'],
    type: ['type', 'type_absence', 'motif', 'nature'],
    start: ['du', 'debut', 'date_debut', 'date_de_debut', 'de'],
    end: ['au', 'fin', 'date_fin', 'date_de_fin', 'a', 'jusqu_au'],
    note: ['commentaire', 'note', 'notes', 'remarque'],
  });
  if (col.type < 0 || col.start < 0) {
    report.errors.push('Colonnes « type » et « du » obligatoires.');
    return;
  }
  const index = employeeIndex(db, ctx.orgId);
  const today = parisDate();

  data.forEach((row, i) => {
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
    if (!start.value) return lineError(report, line, 'date de début vide.');
    const endOn = end.value ?? start.value;
    if (endOn < start.value) return lineError(report, line, 'la fin est avant le début.');

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
      return;
    }
    const error = addAbsence(db, ctx, { employeeId: who.employee.id, type, startOn: start.value, endOn, note: cell(row, col.note) || null }, today);
    if (error) return lineError(report, line, error);
    report.created++;
  });
}

// ---------- Documents ----------

function importDocuments(db: Db, ctx: Actor, header: string[], data: string[][], report: ImportReport) {
  const col = mapColumns(header, {
    plate: ['immatriculation', 'immat', 'plaque', 'vehicule'],
    payrollId: ['matricule', 'matricule_paie'],
    lastName: ['nom'],
    firstName: ['prenom'],
    type: ['type', 'document', 'type_document', 'type_de_document'],
    reference: ['reference', 'numero', 'ref'],
    issuedOn: ['delivre_le', 'date_delivrance', 'date_de_delivrance', 'emis_le', 'debut'],
    expiresOn: ['expire_le', 'date_expiration', 'date_d_expiration', 'expiration', 'fin_validite', 'valable_jusqu_au', 'echeance'],
  });
  if (col.type < 0) {
    report.errors.push('Colonne « type » introuvable.');
    return;
  }
  const vehicles = new Map(listVehicles(db, ctx.orgId, { includeRetired: true }).map((v) => [v.plate, v]));
  const index = employeeIndex(db, ctx.orgId);

  data.forEach((row, i) => {
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

/** Modèle CSV d'un import : en-têtes puis une ligne d'exemple. */
export function importTemplate(kind: ImportKind): { header: string[]; example: string[] } {
  const k = IMPORT_KINDS[kind];
  return { header: k.columns.map((c) => c.replace('*', '')), example: [...k.example] };
}
