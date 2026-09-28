import { Logo } from '../brand/Logo';
import { CartButton } from '../cart/CartButton';
import { MobileMenu } from './MobileMenu';
import { NavLinks } from './NavLinks';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.start}>
          <MobileMenu />
          <Logo />
        </div>
        <nav className={styles.nav} aria-label="Navigation principale">
          <NavLinks />
        </nav>
        <div className={styles.end}>
          <CartButton />
        </div>
      </div>
    </header>
  );
}
