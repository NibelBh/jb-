'use client';

import { MAX_QUANTITY } from '@/lib/cart';
import { IconMinus, IconPlus } from '../icons';
import styles from './QuantityStepper.module.css';

type Props = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  /** Autorise la valeur 0 (utilisé dans le panier pour retirer l'article). */
  allowZero?: boolean;
  size?: 'md' | 'sm';
};

export function QuantityStepper({ value, onChange, label, allowZero = false, size = 'md' }: Props) {
  const min = allowZero ? 0 : 1;
  return (
    <div className={styles.stepper} data-size={size} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Diminuer la quantité"
      >
        <IconMinus />
      </button>
      <output className={styles.value} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(Math.min(MAX_QUANTITY, value + 1))}
        disabled={value >= MAX_QUANTITY}
        aria-label="Augmenter la quantité"
      >
        <IconPlus />
      </button>
    </div>
  );
}
