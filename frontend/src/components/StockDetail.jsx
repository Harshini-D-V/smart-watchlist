/**
 * Full stock detail panel matching the screenshot:
 *  - ‹ My Watchlist back button
 *  - Header card: symbol, sector tag, company name, freshness, big price + %
 *  - Sparkline chart + 1D/1W/1M/1Y range selector
 *  - WHAT CHANGED card (all stocks with visit delta; AI explanation for flagged)
 *  - Correlation insight card (same-sector stocks moving together)
 *  - KEY STATS 3-column grid: Open | Prev. Close | Day Range / 52W High | 52W Low | Avg Vol
 */

import { useState, useEffect, useRef } from 'react';
import { Sparkline } from './Sparkline.jsx';
import { CorrelationInsight } from './CorrelationInsight.jsx';
import { getChart, explainChange } from '../lib/api.js';

const RANGES = ['1d', '1w', '1m', '1y'];

function fmtLarge(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function fmt(n, d = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(d);
}

function secondsAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
}

export function StockDetail({ userId, symbol, priceData, diffItem, metaItem, allMeta, allPrices, diffMap, onBack }) {
  const [range, setRange]               = useState('1w');
  const [chartData, setChartData]       = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [explanation, setExplanation]   = useState(null);
  const [age, setAge]                   = useState(() => secondsAgo(priceData?.fetched_at));
  const explainFetched = useRef(false);

  const price     = priceData?.price ?? chartData?.price ?? null;
  const changePct = priceData?.change_pct ?? chartData?.changePct ?? null;
  const flagged   = diffItem?.flagged ?? false;
  const visitPct  = diffItem?.change_pct_visit ?? null;
  const stale     = priceData?.stale ?? false;
  const sector    = metaItem?.sector ?? chartData?.sector ?? null;
  const shortName = metaItem?.shortName ?? chartData?.shortName ?? null;
  const currency  = (chartData?.currency === 'INR' || symbol.endsWith('.NS') || symbol.endsWith('.BO')) ? '₹' : '$';
  const isUp      = changePct !== null ? changePct >= 0 : true;

  // Live freshness ticker
  useEffect(() => {
    const id = setInterval(() => setAge(secondsAgo(priceData?.fetched_at)), 1000);
    return () => clearInterval(id);
  }, [priceData?.fetched_at]);

  // Chart data
  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    getChart(userId, symbol, range)
      .then(d => { if (!cancelled) { setChartData(d); setChartLoading(false); } })
      .catch(() => { if (!cancelled) setChartLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, range, userId]);

  // AI explanation — flagged stocks only, fires once after chart loads (for volumeRatio)
  useEffect(() => {
    if (!flagged || visitPct === null || explainFetched.current) return;
    explainFetched.current = true;
    const volumeRatio = diffItem?.volume && chartData?.avgVolume
      ? +(diffItem.volume / chartData.avgVolume).toFixed(2)
      : null;
    explainChange(userId, { symbol, changePct: visitPct, ...(volumeRatio ? { volumeRatio } : {}) })
      .then(r => setExplanation(r))
      .catch(() => {});
  }, [flagged, visitPct, symbol, userId, chartData, diffItem]);

  return (
    <div className="detail-page">
      <button className="detail-back" onClick={onBack} aria-label="Back to watchlist">
        ‹ My Watchlist
      </button>

      {/* ── Header card ─────────────────────────────────────── */}
      <div className="detail-card">
        <div className="detail-header">
          <div>
            <div className="detail-symbol-row">
              <h2 className="detail-symbol">{symbol}</h2>
              {sector && <span className="detail-sector-tag">{sector}</span>}
              {flagged && <span className="detail-flag-tag">● significant move</span>}
            </div>
            {shortName && shortName !== symbol && (
              <p className="detail-company">{shortName}</p>
            )}
          </div>
          <div className="detail-freshness">
            {stale
              ? '⚠ last known price'
              : age !== null
              ? `Updated ${age}s ago`
              : ''}
          </div>
        </div>

        <div className="detail-price-row">
          <span className="detail-price">{price !== null ? `${currency}${fmt(price)}` : '—'}</span>
          <span className={`detail-change ${isUp ? 'up' : 'down'}`}>
            {changePct !== null ? `${isUp ? '+' : ''}${fmt(changePct)}%` : '—'}
          </span>
          {visitPct !== null && (
            <span className={`detail-visit-pct ${visitPct >= 0 ? 'up' : 'down'}`}>
              {visitPct >= 0 ? '+' : ''}{fmt(visitPct)}% since last visit
            </span>
          )}
        </div>

        <div className="detail-chart-wrap">
          {chartLoading ? (
            <div className="chart-loading">Loading chart…</div>
          ) : chartData?.points?.length > 1 ? (
            <Sparkline points={chartData.points} positive={isUp} width={700} height={140} />
          ) : (
            <div className="chart-loading">No chart data</div>
          )}
        </div>

        <div className="detail-ranges" role="group" aria-label="Chart range">
          {RANGES.map(r => (
            <button
              key={r}
              className={`range-btn${range === r ? ' range-btn--active' : ''}`}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── WHAT CHANGED ────────────────────────────────────── */}
      {visitPct !== null && (
        <div className={`detail-card what-changed-card${flagged ? ' what-changed-card--flagged' : ''}`}>
          <div className="wc-header">
            <span className="wc-icon">ⓘ</span>
            <span className="wc-title">WHAT CHANGED</span>
            {flagged && <span className="wc-flag-tag">● significant move</span>}
          </div>
          <p className="wc-text">
            {explanation
              ? explanation.explanation
              : `${visitPct >= 0 ? '+' : ''}${fmt(visitPct)}% since your last visit.`}
          </p>
        </div>
      )}

      {/* ── Correlation insight ──────────────────────────────── */}
      {allMeta && allPrices && diffMap && (
        <CorrelationInsight
          meta={allMeta}
          prices={allPrices}
          diffMap={diffMap}
          currentSymbol={symbol}
          currentSector={sector}
          variant="detail"
        />
      )}

      {/* ── KEY STATS (3-column grid) ────────────────────────── */}
      {chartData && (
        <div className="detail-card">
          <p className="ks-title">KEY STATS</p>
          <div className="ks-grid">
            {/* Row 1: Open | Prev. Close | Day Range */}
            <div className="ks-item">
              <span className="ks-label">Open</span>
              <span className="ks-value">{chartData.open !== null ? `${currency}${fmt(chartData.open)}` : '—'}</span>
            </div>
            <div className="ks-item">
              <span className="ks-label">Prev. close</span>
              <span className="ks-value">{chartData.prevClose !== null ? `${currency}${fmt(chartData.prevClose)}` : '—'}</span>
            </div>
            <div className="ks-item">
              <span className="ks-label">Day range</span>
              <span className="ks-value">
                {chartData.dayLow !== null && chartData.dayHigh !== null
                  ? `${currency}${fmt(chartData.dayLow)} – ${currency}${fmt(chartData.dayHigh)}`
                  : '—'}
              </span>
            </div>
            {/* Row 2: 52W High | 52W Low | Avg Vol (or Market Cap) */}
            <div className="ks-item">
              <span className="ks-label">52W high</span>
              <span className="ks-value">{chartData.high52w !== null ? `${currency}${fmt(chartData.high52w)}` : '—'}</span>
            </div>
            <div className="ks-item">
              <span className="ks-label">52W low</span>
              <span className="ks-value">{chartData.low52w !== null ? `${currency}${fmt(chartData.low52w)}` : '—'}</span>
            </div>
            <div className="ks-item">
              <span className="ks-label">Avg. vol.</span>
              <span className="ks-value">
                {chartData.avgVolume !== null ? fmtLarge(chartData.avgVolume) : fmtLarge(chartData.volume)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
