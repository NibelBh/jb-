'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActive, mainNav } from '@/lib/navigation';
import styles from './Header.module.css';

export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul role="list" className={styles.links}>
      {mainNav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link href={item.href} className={styles.link} aria-current={active ? 'page' : undefined}>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
