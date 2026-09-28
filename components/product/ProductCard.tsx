import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import { getCategory, type Product } from '@/lib/products';
import { QuickAddButton } from './QuickAddButton';
import styles from './ProductCard.module.css';

export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const category = getCategory(product.category);
  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <Image
          src={product.images[0]}
          alt=""
          width={600}
          height={600}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 290px"
          loading={eager ? 'eager' : 'lazy'}
        />
        {product.badge && <span className={styles.badge}>{product.badge}</span>}
      </div>
      <div className={styles.body}>
        {category && <p className={styles.category}>{category.shortName}</p>}
        <h3 className={styles.title}>
          <Link href={`/produit/${product.slug}`} className={styles.link}>
            {product.name}
          </Link>
        </h3>
        <p className={styles.tagline}>{product.tagline}</p>
        <div className={styles.footer}>
          <p className={styles.price}>{formatPrice(product.price)}</p>
          <QuickAddButton productId={product.id} productName={product.name} inStock={product.inStock} />
        </div>
      </div>
    </article>
  );
}
