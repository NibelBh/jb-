'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { DetailedCartLine } from '@/lib/cart';
import { dispatchCart } from '@/lib/cart-store';
import { formatPrice } from '@/lib/format';
import { IconTrash } from '../icons';
import { QuantityStepper } from './QuantityStepper';
import styles from './CartLineItem.module.css';

type Props = {
  line: DetailedCartLine;
  onNavigate?: () => void;
};

export function CartLineItem({ line, onNavigate }: Props) {
  const { product, quantity, total } = line;
  return (
    <li className={styles.line}>
      <Link href={`/produit/${product.slug}`} className={styles.thumb} onClick={onNavigate} tabIndex={-1}>
        <Image src={product.images[0]} alt="" width={88} height={88} />
      </Link>
      <div className={styles.body}>
        <div className={styles.top}>
          <Link href={`/produit/${product.slug}`} className={styles.name} onClick={onNavigate}>
            {product.name}
          </Link>
          <span className={styles.total}>{formatPrice(total)}</span>
        </div>
        <p className={styles.unit}>{formatPrice(product.price)} l’unité</p>
        <div className={styles.actions}>
          <QuantityStepper
            size="sm"
            value={quantity}
            allowZero
            label={`Quantité pour ${product.name}`}
            onChange={(value) => dispatchCart({ type: 'setQuantity', id: product.id, quantity: value })}
          />
          <button
            type="button"
            className={styles.remove}
            onClick={() => dispatchCart({ type: 'remove', id: product.id })}
          >
            <IconTrash />
            <span>Retirer</span>
          </button>
        </div>
      </div>
    </li>
  );
}
