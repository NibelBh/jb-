import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { markAllReadAction } from '../(gestion)/notifications/actions';
import { requireDriver } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { driverHome } from '@/lib/data/driver';
import { listNotifications } from '@/lib/data/notifications';
import { formatDateTime, formatLongDate, formatTime, formatWeekday, parisDate } from '@/lib/domain/dates';
import { formatRange } from '@/lib/domain/shifts';
import { ABSENCE_TYPES, labelOf } from '@/lib/domain/labels';
import styles from './driver.module.css';

export const metadata: Metadata = { title: 'Mon espace' };

const MESSAGES: Record<string, { text: string; red?: boolean }> = {
  parti: { text: 'Bonne tournée ! L’état du véhicule au départ est enregistré avec vos photos.' },
  bloque: { text: 'Problème bloquant signalé. Ne partez pas : votre responsable a été prévenu et va vous répondre.', red: true },
  rendu: { text: 'État de fin de journée enregistré, véhicule rendu. Merci et bonne fin de journée.' },
  rendu_signale: { text: 'État de fin de journée enregistré. Le dégât signalé a été transmis à votre responsable.' },
  signale: { text: 'Signalement envoyé. Votre responsable est prévenu.' },
};

export default async function DriverHome(props: PageProps<'/chauffeur'>) {
  const ctx = await requireDriver();
  const params = await props.searchParams;
  const db = getDb();
  const today = parisDate();
  const home = driverHome(db, ctx.orgId, ctx.employeeId, today);
  const notifications = listNotifications(db, ctx, 5).filter((n) => !n.read);
  const message = typeof params.etat === 'string' ? MESSAGES[params.etat] : undefined;
  const firstName = ctx.name.split(' ')[0];

  return (
    <>
      <div className={styles.hello}>
        <h1>Bonjour {firstName}</h1>
        <p>{formatLongDate(today)}</p>
      </div>

      {message && (
        <p className={`${styles.notice} ${message.red ? styles.noticeRed : ''}`} role="status">
          {message.text}
        </p>
      )}

      {home.absence ? (
        <section className={styles.panel}>
          <span className={styles.panelLabel}>Aujourd’hui</span>
          <span className={styles.big}>{labelOf(ABSENCE_TYPES, home.absence.type)}</span>
        </section>
      ) : (
        <section className={styles.panel} aria-label="Ma journée">
          <span className={styles.panelLabel}>Mon planning du jour</span>
          {home.shifts.length === 0 ? (
            <span className={styles.muted}>Pas de créneau prévu aujourd’hui.</span>
          ) : (
            home.shifts.map((s) => (
              <span key={s.id}>
                <span className={styles.big}>{formatRange(s.start_time, s.end_time)}</span>{' '}
                <span className={styles.muted}>
                  {[s.route_name && `Tournée ${s.route_name}`, s.plate && `véhicule ${s.plate}`, s.status === 'realise' ? 'terminé' : s.status === 'en_cours' ? 'en cours' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            ))
          )}
          {home.upcoming.length > 0 && (
            <span className={styles.muted}>
              Prochains jours : {home.upcoming.slice(0, 5).map((s) => `${formatWeekday(s.day)} ${formatRange(s.start_time, s.end_time)}${s.route_name ? ` (${s.route_name})` : ''}`).join(' ; ')}
            </span>
          )}
        </section>
      )}

      {home.pending ? (
        <section className={`${styles.notice} ${styles.noticeRed}`}>
          <strong>
            Inspection de <span className={styles.plate}>{home.pending.plate}</span> en attente de validation.
          </strong>
          <p className={styles.muted}>Signalée à {formatTime(home.pending.created_at)}. Attendez la réponse de votre responsable avant de partir.</p>
        </section>
      ) : home.open ? (
        <>
          <section className={styles.panel}>
            <span className={styles.panelLabel}>Véhicule en cours</span>
            <span>
              <span className={styles.plate}>{home.open.plate}</span>
            </span>
            <span className={styles.muted}>Pris le {formatDateTime(home.open.started_at)}</span>
          </section>
          <Link href="/chauffeur/rendre" className={styles.primary}>
            Rendre le véhicule
          </Link>
        </>
      ) : (
        !home.absence &&
        home.current && (
          <Link href={home.current.vehicle_id ? `/chauffeur/prendre?vehicule=${home.current.vehicle_id}` : '/chauffeur/prendre'} className={styles.primary}>
            Prendre le véhicule
          </Link>
        )
      )}

      <div className={styles.list}>
        <Link href={home.open ? `/chauffeur/signaler?vehicule=${home.open.vehicle_id}` : '/chauffeur/signaler'} className={styles.secondary}>
          Signaler un problème <span aria-hidden="true">→</span>
        </Link>
        <Link href="/chauffeur/documents" className={styles.secondary}>
          Mes documents
          {home.docsToRenew > 0 ? <span className={styles.pill}>{home.docsToRenew} à renouveler</span> : <span aria-hidden="true">→</span>}
        </Link>
        {home.contacts.map((c) => (
          <a key={c.phone} href={`tel:${c.phone.replace(/\s/g, '')}`} className={styles.secondary}>
            Appeler {c.name} <span aria-hidden="true">☎</span>
          </a>
        ))}
      </div>

      <p className={styles.muted}>
        Temps de travail : pensez à le saisir dans{' '}
        <a href="https://mobilic.beta.gouv.fr" target="_blank" rel="noreferrer" style={{ color: 'var(--yellow)' }}>
          Mobilic
        </a>
        .
      </p>

      {notifications.length > 0 && (
        <section className={styles.list} aria-label="Messages">
          <span className={styles.panelLabel}>Messages</span>
          {notifications.map((n) => (
            <div key={n.id} className={styles.notice}>
              <strong>{n.title}</strong>
              {n.body && <p className={styles.muted}>{n.body}</p>}
            </div>
          ))}
          <ActionForm action={markAllReadAction} submitLabel="J’ai lu" submitClassName="btn btn-yellow btn-sm" className="btn-row">
            <span />
          </ActionForm>
        </section>
      )}
    </>
  );
}
