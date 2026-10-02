import { type ExpiryStatus, expiryLabel } from '@/lib/domain/documents';
import type { FineUrgency } from '@/lib/domain/fines';
import { DAMAGE_STATUSES, SEVERITIES, VEHICLE_STATUSES, labelOf } from '@/lib/domain/labels';

export function ExpiryBadge({ status }: { status: ExpiryStatus }) {
  const tone =
    status.level === 'expire'
      ? 'badge-red'
      : status.level === 'j7' || status.level === 'j15'
        ? 'badge-yellow'
        : status.level === 'j30'
          ? ''
          : status.level === 'sans_date'
            ? 'badge-soft'
            : 'badge-ok';
  return <span className={`badge ${tone}`}>{expiryLabel(status)}</span>;
}

export function VehicleStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'disponible' ? 'badge-ok' : status === 'en_tournee' ? 'badge-black' : status === 'bloque' ? 'badge-red' : status === 'immobilise' ? 'badge-yellow' : 'badge-soft';
  return <span className={`badge ${tone}`}>{labelOf(VEHICLE_STATUSES, status)}</span>;
}

export function DamageStatusBadge({ status }: { status: string }) {
  const tone = status === 'nouveau' ? 'badge-yellow' : status === 'cloture' ? 'badge-soft' : status === 'repare' ? 'badge-ok' : '';
  return <span className={`badge ${tone}`}>{labelOf(DAMAGE_STATUSES, status)}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone = severity === 'grave' ? 'badge-red' : severity === 'moyen' ? 'badge-yellow' : '';
  return <span className={`badge ${tone}`}>{labelOf(SEVERITIES, severity)}</span>;
}

export function FineUrgencyBadge({ urgency, daysLeft }: { urgency: FineUrgency; daysLeft: number }) {
  if (urgency === 'depasse') return <span className="badge badge-red">Délai dépassé de {-daysLeft} j</span>;
  const tone = urgency === 'critique' ? 'badge-red' : urgency === 'proche' ? 'badge-yellow' : '';
  return (
    <span className={`badge ${tone}`}>
      {daysLeft === 0 ? 'Dernier jour' : `${daysLeft} j restant${daysLeft > 1 ? 's' : ''}`}
    </span>
  );
}
