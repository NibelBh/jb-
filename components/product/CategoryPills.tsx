'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { categories } from '@/lib/products';
import styles from './CategoryPills.module.css';

const links = [{ href: '/boutique', label: 'Tout voir' }].concat(
  categories.map((category) => ({ href: `/boutique/${category.slug}`, label: category.name })),
);

export function CategoryPills() {
  const pathname = usePathname();
  return (
    <nav aria-label="Rayons" className={styles.nav}>
      <ul role="list" className={styles.list}>
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={styles.pill}
              aria-current={pathname === link.href ? 'page' : undefined}
              scroll={false}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
