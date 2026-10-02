import Link from 'next/link';

/** Filtres d'une liste sous forme d'onglets, avec le nombre d'éléments de chacun. */
export function FilterTabs({ items, label = 'Filtres' }: { items: { href: string; label: string; count?: number; active: boolean }[]; label?: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.active ? 'tab tab-on' : 'tab'} aria-current={i.active ? 'page' : undefined}>
          {i.label}
          {i.count !== undefined && <span className="tab-count">{i.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
