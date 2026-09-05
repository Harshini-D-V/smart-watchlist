/**
 * Watchlist card matching the screenshot:
 *  - Colored left border: green (up), red (down), amber (stale)
 *  - Colored dot indicator
 *  - Symbol + sector tag on same line
 *  - Company name below
 *  - "Updated Xs ago" / "Showing last known price" badge
 *  - Mini sparkline thumbnail on the right
 *  - Price + % change
 */

import { useState, useEffect, useRef } from 'react';
import { getChart } from '../lib/api.js';

function fmt(n, d = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(d);
}

function secondsAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
}

function formatAge(s) {
  if (s === null) return null;
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/** Tiny inline SVG sparkline — no external deps */
function MiniSparkline({ points = [], positive = true }) {
  if (points.length < 2) return <div className="mini-spark-empty" />;

  const prices = points.map(p => p.c);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 80, H = 40, pad = 3;
  const w = W - pad * 2, h = H - pad * 2;

  const toX = i => pad + (i / (points.length - 1)) * w;
  const toY = v => pad + h - ((v - min) / range) * h;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.c).toFixed(1)}`).join(' ');
  const area = line + ` L ${toX(points.length - 1).toFixed(1)} ${H - pad} L ${pad} ${H - pad} Z`;

  const stroke = positive ? '#16a34a' : '#dc2626';
  const fill   = positive ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ display: 'block' }}>
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function StockCard({ userId, symbol, priceData, diffItem, metaItem, onClick, onRemove }) {
  const price     = priceData?.price ?? null;
  const changePct = priceData?.change_pct ?? null;
  const stale     = priceData?.stale ?? false;
  const fetchedAt = priceData?.fetched_at ?? null;
  const flagged   = diffItem?.flagged ?? false;
  const shortName = metaItem?.shortName ?? null;
  const sector    = metaItem?.sector ?? null;

  const isUp   = changePct !== null ? changePct >= 0 : true;
  const currency = symbol.endsWith('.NS') || symbol.endsWith('.BO') ? '₹' : '$';

  // Live age ticker
  const [age, setAge] = useState(() => secondsAgo(fetchedAt));
  useEffect(() => {
    setAge(secondsAgo(fetchedAt));
    const id = setInterval(() => setAge(secondsAgo(fetchedAt)), 1000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  // Mini sparkline data
  const [sparkPoints, setSparkPoints] = useState([]);
  const sparkFetched = useRef(false);
  useEffect(() => {
    if (sparkFetched.current || !userId) return;
    sparkFetched.current = true;
    getChart(userId, symbol, '1d')
      .then(d => setSparkPoints(d.points ?? []))
      .catch(() => {});
  }, [userId, symbol]);

  // Border color class
  const borderClass = stale
    ? 'sc2--stale'
    : flagged
    ? 'sc2--flagged'
    : isUp
    ? 'sc2--up'
    : 'sc2--down';

  // Dot color
  const dotClass = stale ? 'dot--amber' : isUp ? 'dot--green' : 'dot--red';

  return (
    <div
      className={`sc2 ${borderClass}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`View details for ${symbol}`}
    >
      {/* Dot indicator */}
      <span className={`sc2-dot ${dotClass}`} aria-hidden="true" />

      {/* Left: symbol, sector, company, freshness */}
      <div className="sc2-left">
        <div className="sc2-title-row">
          <span className="sc2-symbol">{symbol}</span>
          {sector && <span className="sc2-sector">{sector}</span>}
        </div>
        {shortName && shortName !== symbol && (
          <p className="sc2-company">{shortName}</p>
        )}
        <div className="sc2-freshness">
          {stale ? (
            <span className="sc2-stale-badge">● Showing last known price</span>
          ) : age !== null ? (
            <span className="sc2-age">Updated {formatAge(age)}</span>
          ) : null}
        </div>
      </div>

      {/* Middle: mini sparkline */}
      <div className="sc2-spark">
        <MiniSparkline points={sparkPoints} positive={isUp} />
      </div>

      {/* Right: price + change */}
      <div className="sc2-right">
        <span className="sc2-price">{price !== null ? `${currency}${fmt(price)}` : '—'}</span>
        <span className={`sc2-change ${changePct !== null ? (isUp ? 'up' : 'down') : ''}`}>
          {changePct !== null ? `${isUp ? '+' : ''}${fmt(changePct)}%` : '—'}
        </span>
      </div>

      {/* Remove */}
      <button
        className="sc2-remove"
        onClick={e => { e.stopPropagation(); onRemove(symbol); }}
        aria-label={`Remove ${symbol}`}
      >✕</button>
    </div>
  );
}
