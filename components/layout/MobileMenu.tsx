'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { helpNav, isActive, mainNav } from '@/lib/navigation';
import { Logo } from '../brand/Logo';
import { IconClose, IconMenu } from '../icons';
import styles from './MobileMenu.module.css';

export function MobileMenu() {
  const pathname = usePathname();
  // Le menu est lié à la page où il a été ouvert : naviguer le referme.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const isOpen = openOn === pathname;
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const close = () => setOpenOn(null);

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpenOn(pathname)}
        aria-label="Ouvrir le menu"
        aria-haspopup="dialog"
      >
        <IconMenu />
      </button>
      <dialog
        ref={dialogRef}
        className={styles.menu}
        aria-label="Menu"
        onClose={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className={styles.panel}>
          <div className={styles.top}>
            <Logo />
            <button type="button" className={styles.close} onClick={close} aria-label="Fermer le menu">
              <IconClose />
            </button>
          </div>
          <nav aria-label="Navigation principale">
            <ul role="list" className={styles.main}>
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul role="list" className={styles.help}>
              {helpNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={close}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
