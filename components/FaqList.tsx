import type { FaqItem } from '@/lib/faq';
import { IconPlus } from './icons';
import styles from './FaqList.module.css';

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <details key={item.question} className={styles.item}>
          <summary className={styles.question}>
            <span>{item.question}</span>
            <IconPlus />
          </summary>
          <p className={styles.answer}>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
