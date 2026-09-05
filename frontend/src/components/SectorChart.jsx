/**
 * Clickable sector composition donut chart.
 * Clicking a segment or legend row filters the watchlist by that sector.
 * Active segment is highlighted (slightly enlarged radius).
 */

import { getSectorColor } from './Sidebar.jsx';

function buildArcs(sectors, cx, cy, r) {
  const total = sectors.reduce((s, x) => s + x.count, 0);
  let angle = -Math.PI / 2;
  return sectors.map((sec) => {
    const sweep = (sec.count / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    // midpoint angle for hit testing
    const midAngle = angle - sweep / 2;
    return {
      d: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
      color: getSectorColor(sec.sector),
      sector: sec.sector,
      count: sec.count,
      midAngle,
    };
  });
}

export function SectorChart({ meta, activeSector, onSectorClick }) {
  const counts = {};
  for (const { sector } of Object.values(meta ?? {})) {
    const key = sector ?? 'Other';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const total = Object.values(meta ?? {}).length;
  const sectors = Object.entries(counts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count);

  if (!sectors.length) return null;

  const cx = 90, cy = 90;
  const rBase = 65, rActive = 70, rInner = 42;
  const arcs = buildArcs(sectors, cx, cy, rBase);

  return (
    <div className="sector-chart-v2">
      <p className="sector-chart-label">SECTOR COMPOSITION</p>

      {/* Donut */}
      <div className="sector-donut-center">
        <svg
          width={180} height={180}
          viewBox="0 0 180 180"
          aria-label="Sector composition — click to filter"
          role="img"
        >
          {arcs.map((arc) => {
            const isActive = activeSector === arc.sector;
            // Offset active segment outward
            const r = isActive ? rActive : rBase;
            const total2 = sectors.reduce((s, x) => s + x.count, 0);
            // Recompute this arc's path with correct radius
            let angle2 = -Math.PI / 2;
            const idx = arcs.indexOf(arc);
            for (let i = 0; i < idx; i++) {
              angle2 += (sectors[i].count / total2) * 2 * Math.PI;
            }
            const sweep2 = (arc.count / total2) * 2 * Math.PI;
            const x1 = cx + r * Math.cos(angle2);
            const y1 = cy + r * Math.sin(angle2);
            angle2 += sweep2;
            const x2 = cx + r * Math.cos(angle2);
            const y2 = cy + r * Math.sin(angle2);
            const large = sweep2 > Math.PI ? 1 : 0;
            const d2 = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

            return (
              <path
                key={arc.sector}
                d={d2}
                fill={arc.color}
                opacity={activeSector && !isActive ? 0.35 : 1}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                onClick={() => onSectorClick(isActive ? null : arc.sector)}
                aria-label={`${arc.sector}: ${arc.count} stock${arc.count > 1 ? 's' : ''}`}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onSectorClick(isActive ? null : arc.sector)}
              >
                <title>{arc.sector}: {arc.count}</title>
              </path>
            );
          })}
          {/* Donut hole */}
          <circle cx={cx} cy={cy} r={rInner} fill="white" />
          <text x={cx} y={cy - 7} textAnchor="middle" fontSize="22" fontWeight="800" fill="#0f1117">
            {total}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#6b7280" letterSpacing="0.05em">
            STOCKS
          </text>
        </svg>
      </div>

      {/* Legend — also clickable */}
      <ul className="sector-legend-v2">
        {arcs.map((arc) => {
          const isActive = activeSector === arc.sector;
          return (
            <li key={arc.sector}>
              <button
                className={`sector-legend-btn${isActive ? ' sector-legend-btn--active' : ''}`}
                onClick={() => onSectorClick(isActive ? null : arc.sector)}
                aria-pressed={isActive}
              >
                <span className="sector-dot-v2" style={{ background: arc.color }} />
                <span className="sector-legend-name">{arc.sector}</span>
                <span className="sector-legend-count">{arc.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
