import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { ExpiryBadge } from '@/components/badges';
import { PhotoInput } from '@/components/PhotoInput';
import { requireDriver } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listDocuments } from '@/lib/data/documents';
import { formatDate, parisDate } from '@/lib/domain/dates';
import { documentTypeLabel, expiryStatus } from '@/lib/domain/documents';
import { sendMyDocumentAction } from '../actions';
import styles from '../driver.module.css';

export const metadata: Metadata = { title: 'Mes documents' };

export default async function MyDocumentsPage() {
  const ctx = await requireDriver();
  const today = parisDate();
  const documents = listDocuments(getDb(), ctx.orgId, 'employee', ctx.employeeId);

  return (
    <>
      <Link href="/chauffeur" className={styles.backLink}>
        ← Retour
      </Link>
      <h1 style={{ color: 'var(--white)' }}>Mes documents</h1>

      <section className={styles.sheet}>
        {documents.length === 0 && <p className="muted">Aucun document enregistré.</p>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {documents.map((d) => (
            <li key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div>
                {d.file_id ? (
                  <a href={`/api/fichiers/${d.file_id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                    {documentTypeLabel('employee', d.type)}
                  </a>
                ) : (
                  <strong>{documentTypeLabel('employee', d.type)}</strong>
                )}
                {d.expires_on && <div className="small muted">Jusqu’au {formatDate(d.expires_on)}</div>}
              </div>
              {d.expires_on && <ExpiryBadge status={expiryStatus(d.expires_on, today)} />}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.sheet}>
        <h2>Envoyer un nouveau document</h2>
        <ActionForm action={sendMyDocumentAction} submitLabel="Envoyer" pendingLabel="Envoi…" submitClassName="btn btn-yellow btn-block" resetOnSuccess>
          <div className="field">
            <label htmlFor="type">Document</label>
            <select id="type" name="type" className="input">
              <option value="permis">Permis de conduire</option>
              <option value="piece_identite">Pièce d’identité</option>
              <option value="titre_sejour">Titre de séjour</option>
              <option value="formation">Attestation de formation</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <PhotoInput name="file" label="Photographier le document" required />
          <div className="field">
            <label htmlFor="expiresOn">Date de fin de validité (si elle existe)</label>
            <input id="expiresOn" name="expiresOn" type="date" className="input" min={today} />
          </div>
        </ActionForm>
      </section>
    </>
  );
}
