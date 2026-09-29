import 'server-only';
import { type Db, all } from '../db';
import { type DocumentEntity, type ExpiryStatus, documentTypeLabel, expiryStatus, technicalInspectionDue } from '../domain/documents';

export type DocumentRow = {
  id: number;
  entity_type: DocumentEntity;
  entity_id: number;
  type: string;
  reference: string | null;
  issued_on: string | null;
  expires_on: string | null;
  file_id: number | null;
  created_at: string;
};

export function listDocuments(db: Db, orgId: number, entity: DocumentEntity, entityId: number): DocumentRow[] {
  return all<DocumentRow>(
    db,
    `SELECT * FROM documents WHERE org_id = ? AND entity_type = ? AND entity_id = ? ORDER BY type, expires_on DESC`,
    orgId,
    entity,
    entityId,
  );
}

/** Une échéance à surveiller, quelle que soit son origine (document, permis, contrôle technique calculé). */
export type Deadline = {
  key: string;
  entity: DocumentEntity;
  entityId: number;
  entityLabel: string;
  label: string;
  expiresOn: string;
  status: ExpiryStatus;
  href: string;
  computed: boolean;
};

/**
 * Toutes les échéances de l'organisation. Pour chaque type de document on ne garde
 * que le plus récent : un ancien permis expiré remplacé par un nouveau n'est pas une alerte.
 */
export function listDeadlines(db: Db, orgId: number, today: string): Deadline[] {
  const deadlines: Deadline[] = [];

  const docs = all<DocumentRow & { entity_label: string | null }>(
    db,
    `SELECT d.*,
            CASE d.entity_type
              WHEN 'vehicle' THEN (SELECT plate FROM vehicles v WHERE v.id = d.entity_id AND v.org_id = d.org_id AND v.status != 'sorti')
              WHEN 'employee' THEN (SELECT first_name || ' ' || last_name FROM employees e WHERE e.id = d.entity_id AND e.org_id = d.org_id AND e.status != 'sorti')
              ELSE (SELECT name FROM organizations o WHERE o.id = d.org_id)
            END AS entity_label
       FROM documents d
      WHERE d.org_id = ? AND d.expires_on IS NOT NULL
        AND d.expires_on = (SELECT MAX(d2.expires_on) FROM documents d2
                             WHERE d2.org_id = d.org_id AND d2.entity_type = d.entity_type AND d2.entity_id = d.entity_id AND d2.type = d.type)`,
    orgId,
  );
  for (const d of docs) {
    if (!d.entity_label) continue; // véhicule sorti ou salarié parti
    if (d.entity_type === 'employee' && d.type === 'permis') continue; // le permis est suivi via la fiche salarié
    if (d.entity_type === 'vehicle' && d.type === 'controle_technique') continue; // recalculé ci-dessous
    deadlines.push({
      key: `doc-${d.id}`,
      entity: d.entity_type,
      entityId: d.entity_id,
      entityLabel: d.entity_label,
      label: documentTypeLabel(d.entity_type, d.type),
      expiresOn: d.expires_on as string,
      status: expiryStatus(d.expires_on, today),
      href: hrefFor(d.entity_type, d.entity_id),
      computed: false,
    });
  }

  const employees = all<{ id: number; name: string; licence_expires_on: string | null }>(
    db,
    `SELECT id, first_name || ' ' || last_name AS name, licence_expires_on FROM employees
      WHERE org_id = ? AND status != 'sorti' AND position IN ('chauffeur', 'chef_equipe')`,
    orgId,
  );
  for (const e of employees) {
    deadlines.push({
      key: `permis-${e.id}`,
      entity: 'employee',
      entityId: e.id,
      entityLabel: e.name,
      label: 'Permis de conduire',
      expiresOn: e.licence_expires_on ?? '',
      status: expiryStatus(e.licence_expires_on, today),
      href: hrefFor('employee', e.id),
      computed: false,
    });
  }

  const vehicles = all<{ id: number; plate: string; first_registration_on: string | null; last_ct: string | null }>(
    db,
    `SELECT v.id, v.plate, v.first_registration_on,
            (SELECT MAX(issued_on) FROM documents d WHERE d.org_id = v.org_id AND d.entity_type = 'vehicle' AND d.entity_id = v.id AND d.type = 'controle_technique') AS last_ct
       FROM vehicles v WHERE v.org_id = ? AND v.status != 'sorti'`,
    orgId,
  );
  for (const v of vehicles) {
    const due = technicalInspectionDue(v.first_registration_on, v.last_ct);
    if (!due) continue;
    deadlines.push({
      key: `ct-${v.id}`,
      entity: 'vehicle',
      entityId: v.id,
      entityLabel: v.plate,
      label: 'Contrôle technique',
      expiresOn: due,
      status: expiryStatus(due, today),
      href: hrefFor('vehicle', v.id),
      computed: true,
    });
  }

  return deadlines.sort((a, b) => (a.expiresOn || '9999').localeCompare(b.expiresOn || '9999'));
}

function hrefFor(entity: DocumentEntity, id: number): string {
  if (entity === 'vehicle') return `/vehicules/${id}`;
  if (entity === 'employee') return `/personnel/${id}`;
  return '/documents';
}
