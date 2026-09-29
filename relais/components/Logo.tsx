import { APP_NAME } from '@/lib/config';

/** Trois barres obliques qui filent vers la droite, puis le nom en italique. */
export function Logo({ size = 22, inverted = false }: { size?: number; inverted?: boolean }) {
  const ink = inverted ? '#ffffff' : '#0b0b0c';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width={size * 1.5} height={size} viewBox="0 0 36 24" aria-hidden="true">
        <path d="M8 2h7L7 22H0z" fill="#ffd400" />
        <path d="M19 2h7l-8 20h-7z" fill="#ffd400" opacity="0.75" />
        <path d="M30 2h6l-8 20h-7z" fill={ink} />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontWeight: 900,
          fontSize: size * 0.95,
          letterSpacing: '0.02em',
          color: ink,
          textTransform: 'uppercase',
        }}
      >
        {APP_NAME}
      </span>
    </span>
  );
}
