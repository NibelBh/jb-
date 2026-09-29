import { VEHICLE_ZONES, type ZoneShape } from '@/lib/domain/zones';
import styles from './VehicleMap.module.css';

function Shape({ shape }: { shape: ZoneShape }) {
  if (shape.kind === 'rect') return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r ?? 0} />;
  if (shape.kind === 'ellipse') return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />;
  return <polygon points={shape.points} />;
}

/**
 * Schéma du véhicule vu de dessus, avant en haut. Sans `onToggle`, c'est une carte en lecture seule :
 * les zones touchées sont colorées, avec le nombre de dégâts si `counts` est fourni.
 */
export function VehicleSvg({
  selected,
  counts,
  onToggle,
  label = 'Schéma du véhicule vu de dessus',
}: {
  selected?: readonly string[];
  counts?: Record<string, number>;
  onToggle?: (zone: string) => void;
  label?: string;
}) {
  const active = new Set(selected ?? Object.keys(counts ?? {}).filter((k) => (counts?.[k] ?? 0) > 0));
  return (
    <svg viewBox="0 0 200 400" className={styles.svg} role={onToggle ? 'group' : 'img'} aria-label={label}>
      <rect x="30" y="8" width="140" height="370" rx="26" className={styles.body} />
      <text x="100" y="6" className={styles.caption} textAnchor="middle">
        AVANT
      </text>
      <text x="100" y="396" className={styles.caption} textAnchor="middle">
        ARRIÈRE
      </text>
      {VEHICLE_ZONES.map((zone) => {
        const on = active.has(zone.value);
        const count = counts?.[zone.value] ?? 0;
        const first = zone.shapes[0];
        const cx = first.kind === 'rect' ? first.x + first.w / 2 : first.kind === 'ellipse' ? first.cx : 100;
        const cy = first.kind === 'rect' ? first.y + first.h / 2 : first.kind === 'ellipse' ? first.cy : 96;
        return (
          <g
            key={zone.value}
            className={`${styles.zone} ${on ? styles.on : ''} ${onToggle ? styles.clickable : ''}`}
            onClick={onToggle ? () => onToggle(zone.value) : undefined}
            onKeyDown={
              onToggle
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggle(zone.value);
                    }
                  }
                : undefined
            }
            role={onToggle ? 'checkbox' : undefined}
            aria-checked={onToggle ? on : undefined}
            aria-label={zone.label}
            tabIndex={onToggle ? 0 : undefined}
          >
            <title>{`${zone.label}${count ? ` : ${count} dégât${count > 1 ? 's' : ''}` : ''}`}</title>
            {zone.shapes.map((shape, i) => (
              <Shape key={i} shape={shape} />
            ))}
            {count > 0 && (
              <text x={cx} y={cy + 4} textAnchor="middle" className={styles.count}>
                {count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
