import { addDocumentAction, deleteDocumentAction, updateDocumentAction } from '@/app/(gestion)/documents/actions';
import { ActionForm } from '@/components/ActionForm';
import { ExpiryBadge } from '@/components/badges';
import type { DocumentRow } from '@/lib/data/documents';
import { formatDate } from '@/lib/domain/dates';
import { DOCUMENT_TYPES, type DocumentEntity, documentTypeLabel, expiryStatus } from '@/lib/domain/documents';

export function DocumentsPanel({
  entity,
  entityId,
  documents,
  today,
  editable,
  title = 'Documents',
}: {
  entity: DocumentEntity;
  entityId: number;
  documents: DocumentRow[];
  today: string;
  editable: boolean;
  title?: string;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="section-title">{title}</h2>
      </div>
      {documents.length === 0 ? (
        <p className="empty">Aucun document pour l’instant. Ajoutez-les pour être prévenu avant leur expiration.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Référence</th>
                <th>Expiration</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.file_id ? (
                      <a href={`/api/fichiers/${d.file_id}`} target="_blank" rel="noreferrer" className="row-link">
                        {documentTypeLabel(entity, d.type)}
                      </a>
                    ) : (
                      <strong>{documentTypeLabel(entity, d.type)}</strong>
                    )}
                    {!d.file_id && <div className="small muted">Pas de fichier joint</div>}
                  </td>
                  <td className="small">{d.reference}</td>
                  <td>
                    {d.expires_on ? (
                      <div className="stack-sm" style={{ gap: 2 }}>
                        <span className="small mono">{formatDate(d.expires_on)}</span>
                        <ExpiryBadge status={expiryStatus(d.expires_on, today)} />
                      </div>
                    ) : (
                      <span className="small muted">Sans expiration</span>
                    )}
                  </td>
                  <td>
                    {editable && (
                      <details className="disclosure small">
                        <summary>Modifier</summary>
                        <ActionForm action={updateDocumentAction} submitLabel="Enregistrer" submitClassName="btn btn-sm">
                          <input type="hidden" name="documentId" value={d.id} />
                          <input type="hidden" name="entity" value={entity} />
                          <div className="field">
                            <label htmlFor={`doc-${d.id}-type`}>Type</label>
                            <select id={`doc-${d.id}-type`} name="type" className="input" defaultValue={d.type}>
                              {DOCUMENT_TYPES[entity].map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor={`doc-${d.id}-ref`}>Référence</label>
                            <input id={`doc-${d.id}-ref`} name="reference" className="input" defaultValue={d.reference ?? ''} />
                          </div>
                          <div className="field">
                            <label htmlFor={`doc-${d.id}-issued`}>Délivré le</label>
                            <input id={`doc-${d.id}-issued`} name="issuedOn" type="date" className="input" defaultValue={d.issued_on ?? ''} />
                          </div>
                          <div className="field">
                            <label htmlFor={`doc-${d.id}-exp`}>Expire le</label>
                            <input id={`doc-${d.id}-exp`} name="expiresOn" type="date" className="input" defaultValue={d.expires_on ?? ''} />
                          </div>
                          <div className="field">
                            <label htmlFor={`doc-${d.id}-file`}>{d.file_id ? 'Remplacer le fichier' : 'Joindre le fichier'}</label>
                            <input id={`doc-${d.id}-file`} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="input" />
                          </div>
                        </ActionForm>
                        <ActionForm action={deleteDocumentAction} submitLabel="Supprimer ce document" submitClassName="btn btn-danger btn-sm" className="btn-row" confirmMessage="Supprimer ce document ?">
                          <input type="hidden" name="documentId" value={d.id} />
                        </ActionForm>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editable && (
        <div className="card-body" style={{ borderTop: '1px solid var(--color-border)' }}>
          <details className="disclosure">
            <summary>Ajouter un document</summary>
            <ActionForm action={addDocumentAction} submitLabel="Ajouter" resetOnSuccess>
              <input type="hidden" name="entity" value={entity} />
              <input type="hidden" name="entityId" value={entityId} />
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={`doc-type-${entity}`}>Type</label>
                  <select id={`doc-type-${entity}`} name="type" className="input" required>
                    {DOCUMENT_TYPES[entity].map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`doc-ref-${entity}`}>Référence</label>
                  <input id={`doc-ref-${entity}`} name="reference" className="input" />
                </div>
                <div className="field">
                  <label htmlFor={`doc-issued-${entity}`}>Délivré le</label>
                  <input id={`doc-issued-${entity}`} name="issuedOn" type="date" className="input" />
                </div>
                <div className="field">
                  <label htmlFor={`doc-exp-${entity}`}>Expire le</label>
                  <input id={`doc-exp-${entity}`} name="expiresOn" type="date" className="input" />
                </div>
              </div>
              <div className="field">
                <label htmlFor={`doc-file-${entity}`}>Fichier (PDF ou photo, 8 Mo maximum)</label>
                <input id={`doc-file-${entity}`} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="input" />
              </div>
            </ActionForm>
          </details>
        </div>
      )}
    </section>
  );
}
