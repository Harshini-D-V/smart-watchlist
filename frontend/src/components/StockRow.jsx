/**
 * Expandable stock row for the main list view.
 *
 * Collapsed: symbol · sector · company · mini sparkline · price · today% · since-visit% · freshness · chevron · ✕
 * Expanded:  above + inline chart (1D sparkline) + WHAT CHANGED panel + "Full chart & details →"
 *
 * Clicking the row (not the buttons) toggles expand.
 * "Full chart & details →" opens the detail page.
 */

import { useState, useEffect, useRef } from 'react';
import { getChart, explainChange } from '../lib/api.js';
import { getSectorColor } from './Sidebar.jsx';

function fmt(n, d = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(d);
}

function secondsAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
}

/** Tiny inline SVG sparkline */
function MiniSpark({ points = [], up = true, w = 72, h = 36 }) {
  if (points.length < 2) return <div style={{ width: w, height: h }} />;
  const prices = points.map(p => p.c);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 2;
  const W = w - pad * 2, H = h - pad * 2;
  const toX = i => pad + (i / (points.length - 1)) * W;
  const toY = v => pad + H - ((v - min) / range) * H;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.c).toFixed(1)}`).join(' ');
  const area = line + ` L ${toX(points.length - 1).toFixed(1)} ${h - pad} L ${pad} ${h - pad} Z`;
  const color = up ? '#16a34a' : '#dc2626';
  const fill  = up ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Larger sparkline for the expanded inline chart */
function ExpandedSpark({ points = [], up = true }) {
  if (points.length < 2) return <div className="expand-chart-empty">No chart data</div>;
  const prices = points.map(p => p.c);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const W = 520, H = 120, pad = 8;
  const w = W - pad * 2, h = H - pad * 2;
  const toX = i => pad + (i / (points.length - 1)) * w;
  const toY = v => pad + h - ((v - min) / range) * h;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.c).toFixed(1)}`).join(' ');
  const area = line + ` L ${toX(points.length - 1).toFixed(1)} ${H - pad} L ${pad} ${H - pad} Z`;
  const color = up ? '#16a34a' : '#dc2626';
  const fill  = up ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)';
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function StockRow({ userId, symbol, priceData, diffItem, metaItem, onOpenDetail }) {
  const [expanded, setExpanded] = useState(false);
  const [sparkPoints, setSparkPoints]   = useState([]);
  const [expandPoints, setExpandPoints] = useState([]);
  const [explanation, setExplanation]   = useState(null);
  const [age, setAge] = useState(() => secondsAgo(priceData?.fetched_at));
  const sparkFetched  = useRef(false);
  const expandFetched = useRef(false);
  const explainFetched = useRef(false);

  const price     = priceData?.price ?? null;
  const changePct = priceData?.change_pct ?? null;
  const stale     = priceData?.stale ?? false;
  const fetchedAt = priceData?.fetched_at ?? null;
  const flagged   = diffItem?.flagged ?? false;
  const visitPct  = diffItem?.change_pct_visit ?? null;
  const shortName = metaItem?.shortName ?? null;
  const sector    = metaItem?.sector ?? null;
  const isUp      = changePct !== null ? changePct >= 0 : true;
  const currency  = symbol.endsWith('.NS') || symbol.endsWith('.BO') ? '₹' : '$';
  const sectorColor = sector ? getSectorColor(sector) : '#94a3b8';

  // Live age
  useEffect(() => {
    const id = setInterval(() => setAge(secondsAgo(fetchedAt)), 1000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  // Mini sparkline — fetch on mount
  useEffect(() => {
    if (sparkFetched.current || !userId) return;
    sparkFetched.current = true;
    getChart(userId, symbol, '1d')
      .then(d => setSparkPoints(d.points ?? []))
      .catch(() => {});
  }, [userId, symbol]);

  // Expanded chart — fetch on first expand
  useEffect(() => {
    if (!expanded || expandFetched.current || !userId) return;
    expandFetched.current = true;
    getChart(userId, symbol, '1w')
      .then(d => setExpandPoints(d.points ?? []))
      .catch(() => {});
  }, [expanded, userId, symbol]);

  // AI explanation — flagged only, after expand
  useEffect(() => {
    if (!expanded || !flagged || visitPct === null || explainFetched.current) return;
    explainFetched.current = true;
    explainChange(userId, { symbol, changePct: visitPct })
      .then(r => setExplanation(r))
      .catch(() => {});
  }, [expanded, flagged, visitPct, symbol, userId]);

  const toggleExpand = (e) => {
    // Don't toggle when clicking buttons
    if (e.target.closest('button') || e.target.closest('a')) return;
    setExpanded(o => !o);
  };

  // Border color
  const borderColor = stale ? '#f59e0b' : isUp ? '#16a34a' : '#dc2626';

  return (
    <div
      className={`srow${expanded ? ' srow--expanded' : ''}${flagged ? ' srow--flagged' : ''}`}
      style={{ borderLeftColor: borderColor }}
    >
      {/* ── Main row ── */}
      <div
        className="srow-main"
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && toggleExpand(e)}
        aria-expanded={expanded}
        aria-label={`${symbol} — click to ${expanded ? 'collapse' : 'expand'}`}
      >
        {/* Dot */}
        <span
          className="srow-dot"
          style={{ background: stale ? '#f59e0b' : borderColor }}
          aria-hidden="true"
        />

        {/* Left: symbol + sector + company */}
        <div className="srow-left">
          <div className="srow-title">
            <span className="srow-symbol">{symbol}</span>
            {sector && (
              <span className="srow-sector" style={{ color: sectorColor }}>{sector}</span>
            )}
          </div>
          {shortName && shortName !== symbol && (
            <p className="srow-company">{shortName}</p>
          )}
        </div>

        {/* Mini spark */}
        <div className="srow-spark">
          <MiniSpark points={sparkPoints} up={isUp} />
        </div>

        {/* Price */}
        <span className="srow-price">{price !== null ? `${currency}${fmt(price)}` : '—'}</span>

        {/* Today % */}
        <span className={`srow-change ${changePct !== null ? (isUp ? 'up' : 'down') : ''}`}>
          {changePct !== null ? `${isUp ? '+' : ''}${fmt(changePct)}%` : '—'}
        </span>

        {/* Since visit */}
        <div className="srow-visit">
          {visitPct !== null && (
            <>
              <span className={visitPct >= 0 ? 'up' : 'down'}>
                {visitPct >= 0 ? '+' : ''}{fmt(visitPct)}%
              </span>
              <span className="srow-visit-label">since visit</span>
            </>
          )}
        </div>

        {/* Freshness */}
        <div className="srow-freshness">
          {stale ? (
            <span className="srow-stale">
              <span className="srow-age-dot" style={{ background: '#f59e0b' }} />
              stale
            </span>
          ) : age !== null ? (
            <span className="srow-age">
              <span className="srow-age-dot" />
              updated {age}s ago
            </span>
          ) : null}
        </div>

        {/* Chevron */}
        <span className="srow-chevron" aria-hidden="true">{expanded ? '∧' : '∨'}</span>

        {/* Remove */}
        <button
          className="srow-remove"
          onClick={e => { e.stopPropagation(); /* handled by parent */ }}
          aria-label={`Remove ${symbol}`}
          style={{ display: 'none' }} // rendered inside onRemove prop — kept for layout
        >✕</button>
      </div>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="srow-expand">
          {/* Inline chart */}
          <div className="expand-chart">
            <ExpandedSpark points={expandPoints} up={isUp} />
          </div>

          {/* WHAT CHANGED */}
          {visitPct !== null && (
            <div className="expand-wc">
              <div className="expand-wc-header">
                <span className="expand-wc-icon">ⓘ</span>
                <span className="expand-wc-title">WHAT CHANGED</span>
                {explanation?.source === 'ai' && (
                  <span className="expand-wc-ai-badge">AI</span>
                )}
              </div>
              <p className="expand-wc-text">
                {explanation
                  ? explanation.explanation
                  : `${visitPct >= 0 ? '+' : ''}${fmt(visitPct)}% since your last visit.`}
              </p>
            </div>
          )}

          {/* Full chart link */}
          <button
            className="expand-detail-link"
            onClick={e => { e.stopPropagation(); onOpenDetail(symbol); }}
          >
            Full chart &amp; details →
          </button>
        </div>
      )}
    </div>
  );
}

/** Remove button rendered outside the row to avoid toggle conflict */
export function RemoveButton({ symbol, onRemove }) {
  return (
    <button
      className="srow-remove-btn"
      onClick={e => { e.stopPropagation(); onRemove(symbol); }}
      aria-label={`Remove ${symbol}`}
    >✕</button>
  );
}
