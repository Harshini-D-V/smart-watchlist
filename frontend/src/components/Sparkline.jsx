/**
 * Pure SVG sparkline chart — no external library needed.
 * Props: points [{ t, c }], positive (bool), width, height
 */
export function Sparkline({ points = [], positive = true, width = 300, height = 120 }) {
  if (points.length < 2) return null;

  const prices = points.map((p) => p.c);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const pad = 8;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const toX = (i) => pad + (i / (points.length - 1)) * w;
  const toY = (v) => pad + h - ((v - min) / range) * h;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.c).toFixed(1)}`)
    .join(' ');

  // Area fill path — close back to bottom
  const areaD = pathD +
    ` L ${toX(points.length - 1).toFixed(1)} ${(pad + h).toFixed(1)}` +
    ` L ${pad.toFixed(1)} ${(pad + h).toFixed(1)} Z`;

  const color = positive ? '#16a34a' : '#dc2626';
  const fillColor = positive ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Area fill */}
      <path d={areaD} fill={fillColor} />
      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
