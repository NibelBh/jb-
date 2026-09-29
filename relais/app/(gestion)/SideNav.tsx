'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';

export function SideNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale">
      <ul className={styles.nav}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link href={item.href} className={active ? `${styles.navLink} ${styles.active}` : styles.navLink} aria-current={active ? 'page' : undefined}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
