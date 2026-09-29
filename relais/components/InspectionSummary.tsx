import type { InspectionRow } from '@/lib/data/operations';
import { formatDateTime } from '@/lib/domain/dates';
import { CHECKLIST, type InspectionAnswers, REQUIRED_PHOTOS, formatKm } from '@/lib/domain/inspection';

export function InspectionSummary({ inspection }: { inspection: InspectionRow }) {
  const answers = JSON.parse(inspection.answers) as Partial<InspectionAnswers>;
  const photos = JSON.parse(inspection.photos) as Record<string, number>;
  const problems = CHECKLIST.filter((c) => answers[c.key] && answers[c.key]?.result !== 'ok');

  return (
    <div className="stack-sm">
      <div className="btn-row" style={{ gap: 6 }}>
        <strong>{inspection.kind === 'depart' ? 'Départ' : 'Retour'}</strong>
        <span className="muted small">
          {formatDateTime(inspection.created_at)}, {inspection.employee_name}, {formatKm(inspection.odometer)}
        </span>
        {inspection.worst === 'ok' && <span className="badge">Conforme</span>}
        {inspection.worst === 'mineur' && <span className="badge badge-yellow">À surveiller</span>}
        {inspection.worst === 'bloquant' && <span className="badge badge-red">Bloquant</span>}
        {inspection.status === 'en_attente' && <span className="badge badge-black">En attente de décision</span>}
        {inspection.status === 'refusee' && <span className="badge badge-soft">Départ refusé</span>}
      </div>
      {problems.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {problems.map((c) => (
            <li key={c.key}>
              <strong>{c.label}</strong> ({answers[c.key]?.result === 'bloquant' ? 'bloquant' : 'à surveiller'})
              {answers[c.key]?.note ? ` : ${answers[c.key]?.note}` : ''}
            </li>
          ))}
        </ul>
      )}
      {inspection.comment && <p className="small">« {inspection.comment} »</p>}
      {inspection.review_note && <p className="small muted">Décision du responsable : {inspection.review_note}</p>}
      {Object.keys(photos).length > 0 && (
        <div className="photos">
          {Object.entries(photos).map(([key, fileId]) => (
            <a key={key} href={`/api/fichiers/${fileId}`} target="_blank" rel="noreferrer" title={REQUIRED_PHOTOS.find((p) => p.key === key)?.label ?? key}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/fichiers/${fileId}`} alt={REQUIRED_PHOTOS.find((p) => p.key === key)?.label ?? 'Photo'} loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
