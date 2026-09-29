'use client';

import { useId, useState } from 'react';
import styles from './PhotoInput.module.css';

const MAX_SIDE = 1600;
const QUALITY = 0.72;

/**
 * Prise de photo depuis le téléphone. L'image est réduite et recompressée
 * dans le navigateur avant l'envoi (souvent 5 à 10 fois plus légère),
 * ce qui compte avec une connexion 4G faible sur un parking.
 */
export function PhotoInput({
  name,
  label,
  required = false,
  multiple = false,
  capture = true,
}: {
  name: string;
  label: string;
  required?: boolean;
  multiple?: boolean;
  capture?: boolean;
}) {
  const id = useId();
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      setPreviews([]);
      return;
    }
    setBusy(true);
    try {
      const compressed = await Promise.all(files.map(compress));
      const transfer = new DataTransfer();
      compressed.forEach((file) => transfer.items.add(file));
      input.files = transfer.files;
      setPreviews(compressed.map((file) => URL.createObjectURL(file)));
    } catch {
      setPreviews(files.map((file) => URL.createObjectURL(file)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <label htmlFor={id} className={previews.length ? `${styles.zone} ${styles.done}` : styles.zone}>
        {previews.length > 0 ? (
          <span className={styles.thumbs}>
            {previews.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" />
            ))}
          </span>
        ) : (
          <span className={styles.icon} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </span>
        )}
        <span className={styles.label}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
          {busy && <span className={styles.busy}> compression…</span>}
        </span>
      </label>
      <input
        id={id}
        className={styles.input}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        capture={capture ? 'environment' : undefined}
        multiple={multiple}
        required={required}
        onChange={onChange}
      />
    </div>
  );
}

async function compress(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}
