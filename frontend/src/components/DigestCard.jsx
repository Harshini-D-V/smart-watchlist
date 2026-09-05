/**
 * Digest card — expandable section matching the screenshot:
 *
 *   DIGEST  3 things changed since Sep 3          ∧
 *
 *   ↑  NVDA  +6.2%
 *      More than double usual volume...
 *
 *   ↓  TSLA  -4.8%
 *      Delivery miss vs consensus...
 *
 *   —  META
 *      Price feed delayed — showing last known price.
 */

import { useState } from 'react';

function formatVisitTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  const now = new Date();
  const diffMs  = now - d;
  const diffMins  = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays  = Math.floor(diffMs / 86_400_000);
  if (diffMins < 2)   return 'just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7)   return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmt(n, d = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(d);
}

export function DigestCard({ diff, prices }) {
  const [open, setOpen] = useState(true);
  if (!diff) return null;

  const { items = [], last_visit, summary } = diff;
  const firstVisit = !last_visit;

  // Items to show: changed or stale
  const changed = items.filter(i => i.change_pct_visit !== null && i.change_pct_visit !== 0);
  const stale   = items.filter(i => prices?.[i.symbol]?.stale);
  // Deduplicate stale that are also changed
  const staleOnly = stale.filter(i => !changed.find(c => c.symbol === i.symbol));

  const digestItems = [...changed, ...staleOnly];
  const flaggedCount = items.filter(i => i.flagged).length;

  // Header: "3 things changed since Sep 3"
  const sinceLabel = last_visit
    ? `since ${new Date(last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';
  const headerCount = digestItems.length;
  const headerText  = firstVisit
    ? 'First visit — tracking starts now'
    : headerCount > 0
    ? `${headerCount} thing${headerCount !== 1 ? 's' : ''} changed ${sinceLabel}`
    : `No changes ${sinceLabel}`;

  return (
    <div className="digest-v2" aria-label="Watchlist digest">
      {/* Header row */}
      <button
        className="digest-v2-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="digest-v2-tag">DIGEST</span>
        <span className="digest-v2-subtitle">{headerText}</span>
        <span className="digest-v2-chevron" aria-hidden="true">{open ? '∧' : '∨'}</span>
      </button>

      {/* Expandable rows */}
      {open && !firstVisit && digestItems.length > 0 && (
        <div className="digest-v2-rows">
          {digestItems.map(item => {
            const isStale = prices?.[item.symbol]?.stale;
            const pct = item.change_pct_visit;
            const isUp = pct > 0;
            const arrowClass = pct > 0 ? 'digest-arrow--up' : pct < 0 ? 'digest-arrow--down' : 'digest-arrow--flat';
            const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '—';

            return (
              <div key={item.symbol} className="digest-v2-row">
                <span className={`digest-arrow ${arrowClass}`} aria-hidden="true">{arrow}</span>
                <div className="digest-row-body">
                  <div className="digest-row-top">
                    <span className="digest-row-symbol">{item.symbol}</span>
                    {pct !== null && pct !== 0 && (
                      <span className={`digest-row-pct ${isUp ? 'up' : 'down'}`}>
                        {isUp ? '+' : ''}{fmt(pct)}%
                      </span>
                    )}
                  </div>
                  <p className="digest-row-desc">
                    {isStale
                      ? 'Price feed delayed — showing last known price.'
                      : item.flagged
                      ? `Moved ${Math.abs(pct).toFixed(1)}% — outside normal daily range.`
                      : `Changed ${isUp ? '+' : ''}${fmt(pct)}% since your last visit.`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && firstVisit && (
        <p className="digest-v2-empty">
          Prices are being tracked from this visit. Come back later to see what changed.
        </p>
      )}

      {open && !firstVisit && digestItems.length === 0 && (
        <p className="digest-v2-empty">No price changes since your last visit.</p>
      )}
    </div>
  );
}
