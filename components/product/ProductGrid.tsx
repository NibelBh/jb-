'use client';

import { useId, useState } from 'react';
import { pluralize } from '@/lib/format';
import { products as allProducts, type CategorySlug } from '@/lib/products';
import { IconChevronDown } from '../icons';
import { ProductCard } from './ProductCard';
import styles from './ProductGrid.module.css';

type Sort = 'selection' | 'prix-croissant' | 'prix-decroissant';

const sortLabels: Record<Sort, string> = {
  selection: 'Notre sélection',
  'prix-croissant': 'Prix croissant',
  'prix-decroissant': 'Prix décroissant',
};

export function ProductGrid({ category }: { category?: CategorySlug }) {
  const [sort, setSort] = useState<Sort>('selection');
  const selectId = useId();

  const products = category ? allProducts.filter((product) => product.category === category) : allProducts;
  const sorted =
    sort === 'selection'
      ? products
      : [...products].sort((a, b) => (sort === 'prix-croissant' ? a.price - b.price : b.price - a.price));

  return (
    <div>
      <div className={styles.toolbar}>
        <p className={styles.count}>{pluralize(products.length, 'produit', 'produits')}</p>
        <div className={styles.sort}>
          <label htmlFor={selectId}>Trier par</label>
          <div className={styles.selectWrap}>
            <select id={selectId} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <IconChevronDown />
          </div>
        </div>
      </div>
      <ul role="list" className={styles.grid}>
        {sorted.map((product, index) => (
          <li key={product.id}>
            <ProductCard product={product} eager={index < 4} />
          </li>
        ))}
      </ul>
    </div>
  );
}
