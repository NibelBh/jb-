import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listNotifications } from '@/lib/data/notifications';
import { formatDateTime } from '@/lib/domain/dates';
import { markAllReadAction } from './actions';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const ctx = await getSession();
  if (!ctx) redirect('/connexion');
  const rows = listNotifications(getDb(), ctx, 100);

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          rows.some((r) => !r.read) && (
            <ActionForm action={markAllReadAction} submitLabel="Tout marquer comme lu" submitClassName="btn btn-ghost" className="btn-row">
              <span />
            </ActionForm>
          )
        }
      />
      <section className="card">
        {rows.length === 0 && <p className="empty">Aucune notification.</p>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((n) => (
            <li key={n.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', background: n.read ? undefined : 'var(--yellow-wash)', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <div>
                <strong>{n.title}</strong>
                {n.body && <div className="small">{n.body}</div>}
                <div className="small muted">{formatDateTime(n.created_at)}</div>
              </div>
              {n.link && (
                <Link href={n.link} className="btn btn-sm" style={{ alignSelf: 'center' }}>
                  Ouvrir
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
