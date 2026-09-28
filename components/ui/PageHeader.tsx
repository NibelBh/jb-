import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';
import styles from './PageHeader.module.css';

type Props = {
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  breadcrumbs?: Crumb[];
  children?: ReactNode;
};

export function PageHeader({ title, eyebrow, intro, breadcrumbs, children }: Props) {
  return (
    <div className={styles.header}>
      <div className="container">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <div className={styles.content}>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className={styles.title}>{title}</h1>
          {intro && <div className={`lead ${styles.intro}`}>{intro}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}
