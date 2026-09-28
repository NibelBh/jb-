'use client';

import Image from 'next/image';
import { useState } from 'react';
import styles from './ProductGallery.module.css';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [current, setCurrent] = useState(0);
  const active = images[current] ?? images[0];

  return (
    <div className={styles.gallery}>
      <div className={styles.main}>
        <Image
          src={active}
          alt={images.length > 1 ? `${name}, vue ${current + 1} sur ${images.length}` : name}
          width={800}
          height={800}
          sizes="(max-width: 900px) 100vw, 560px"
          preload
        />
      </div>
      {images.length > 1 && (
        <ul role="list" className={styles.thumbs}>
          {images.map((src, index) => (
            <li key={src}>
              <button
                type="button"
                className={styles.thumb}
                aria-label={`Afficher la vue ${index + 1}`}
                aria-pressed={index === current}
                onClick={() => setCurrent(index)}
              >
                <Image src={src} alt="" width={96} height={96} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
