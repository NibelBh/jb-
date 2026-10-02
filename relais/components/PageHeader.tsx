import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header style={{ display: 'grid', gap: 4, marginBottom: 22 }}>
      {back && (
        <Link href={back.href} className="small muted" style={{ textDecoration: 'none', fontWeight: 600 }}>
          ← {back.label}
        </Link>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1>{title}</h1>
        {actions && <div className="btn-row">{actions}</div>}
      </div>
      {subtitle && <p className="muted" style={{ maxWidth: 820 }}>{subtitle}</p>}
    </header>
  );
}
