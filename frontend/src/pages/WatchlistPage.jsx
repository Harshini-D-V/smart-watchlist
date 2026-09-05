import { useState } from 'react';
import { useWatchlist } from '../hooks/useWatchlist.js';
import { Sidebar } from '../components/Sidebar.jsx';
import { StockRow } from '../components/StockRow.jsx';
import { StockDetail } from '../components/StockDetail.jsx';
import { SectorChart } from '../components/SectorChart.jsx';
import { CorrelationInsight } from '../components/CorrelationInsight.jsx';
import { AddStockForm } from '../components/AddStockForm.jsx';

function DigestBanner({ diff, prices }) {
  if (!diff || !diff.last_visit) return null;

  const changed = (diff.items ?? []).filter(i => i.change_pct_visit !== null && i.change_pct_visit !== 0);
  if (!changed.length) return null;

  const lastVisitLabel = (() => {
    const d = new Date(diff.last_visit);
    const mins = Math.floor((Date.now() - d) / 60_000);
    if (mins < 60) return `${mins} minutes ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  })();

  return (
    <div className="digest-banner">
      <span className="digest-banner-icon">⏱</span>
      <div className="digest-banner-body">
        <span className="digest-banner-title">
          {changed.length} stock{changed.length !== 1 ? 's' : ''} changed since your last visit
        </span>
        <span className="digest-banner-since"> · Last visit: {lastVisitLabel}</span>
        <div className="digest-banner-chips">
          {changed.map(i => (
            <span
              key={i.symbol}
              className={`digest-chip ${i.change_pct_visit >= 0 ? 'up' : 'down'}`}
            >
              {i.symbol} {i.change_pct_visit >= 0 ? '+' : ''}{Number(i.change_pct_visit).toFixed(2)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WatchlistPage({ userId }) {
  const { symbols, prices, diff, meta, loading, error, add, remove } = useWatchlist(userId);
  const [selected, setSelected]     = useState(null);
  const [activeSector, setActiveSector] = useState(null);
  const [searchQuery, setSearchQuery]   = useState('');

  const diffMap = Object.fromEntries(
    (diff?.items ?? []).map(item => [item.symbol, item])
  );

  // Filter by sector + search
  const visibleSymbols = symbols.filter(({ symbol }) => {
    if (activeSector && meta[symbol]?.sector !== activeSector) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchSymbol = symbol.toLowerCase().includes(q);
      const matchName   = (meta[symbol]?.shortName ?? '').toLowerCase().includes(q);
      const matchSector = (meta[symbol]?.sector ?? '').toLowerCase().includes(q);
      if (!matchSymbol && !matchName && !matchSector) return false;
    }
    return true;
  });

  // ── Detail view ──────────────────────────────────────────────
  if (selected) {
    return (
      <div className="app-shell app-shell--detail">
        <header className="app-header">
          <div className="header-inner">
            <span className="app-logo">
              <span className="logo-icon">📈</span> Smart Watchlist
            </span>
            <span className="app-count">{symbols.length} stocks</span>
          </div>
        </header>
        <main className="detail-main">
          <StockDetail
            userId={userId}
            symbol={selected}
            priceData={prices[selected] ?? null}
            diffItem={diffMap[selected] ?? null}
            metaItem={meta[selected] ?? null}
            allMeta={meta}
            allPrices={prices}
            diffMap={diffMap}
            onBack={() => setSelected(null)}
          />
        </main>
      </div>
    );
  }

  // ── Main list view ───────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <span className="app-logo">
              Smart Watchlist
            </span>
          <span className="app-count">{symbols.length} stocks</span>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <Sidebar
          symbols={symbols}
          diff={diff}
          meta={meta}
          activeSector={activeSector}
          onSectorClick={setActiveSector}
        />

        {/* Main content */}
        <main className="app-main">
          {/* Search + Add bar */}
          <form
            className="search-bar-row"
            onSubmit={e => {
              e.preventDefault();
              const q = searchQuery.trim().toUpperCase();
              if (q && /^[A-Z0-9.\-^]+$/.test(q)) {
                add(q);
                setSearchQuery('');
              }
            }}
          >
            <div className="search-bar-wrap">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                className="search-input"
                type="text"
                placeholder="e.g. AAPL, Infosys, semiconductors..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Search watchlist or add ticker"
              />
            </div>
            <button
              type="submit"
              className="btn-add-main"
              disabled={loading || !searchQuery.trim()}
            >
              + Add
            </button>
          </form>

          {error && <p className="error-banner" role="alert">⚠ {error}</p>}

          {/* Digest banner */}
          {!loading && <DigestBanner diff={diff} prices={prices} />}

          {/* Stock rows */}
          {loading ? (
            <div className="loading-inline"><div className="spinner spinner--sm" /><span>Loading…</span></div>
          ) : visibleSymbols.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">{searchQuery || activeSector ? 'No stocks match your filter.' : 'Your watchlist is empty.'}</p>
              {!searchQuery && !activeSector && <p className="empty-state-hint">Add a ticker above to get started.</p>}
            </div>
          ) : (
            <div className="rows-list">
              {visibleSymbols.map(({ symbol }) => (
                <div key={symbol} className="row-wrapper">
                  <StockRow
                    userId={userId}
                    symbol={symbol}
                    priceData={prices[symbol] ?? null}
                    diffItem={diffMap[symbol] ?? null}
                    metaItem={meta[symbol] ?? null}
                    onOpenDetail={setSelected}
                  />
                  <button
                    className="srow-remove-btn"
                    onClick={() => remove(symbol)}
                    aria-label={`Remove ${symbol}`}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom: sector chart + correlation side by side */}
          {!loading && Object.keys(meta).length > 0 && (
            <div className="bottom-panels">
              <SectorChart
                meta={meta}
                activeSector={activeSector}
                onSectorClick={setActiveSector}
              />
              <div className="bottom-right">
                <CorrelationInsight
                  meta={meta}
                  prices={prices}
                  diffMap={diffMap}
                  variant="list"
                />
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">Prices via Yahoo Finance · Refreshes every 5s</footer>
    </div>
  );
}
