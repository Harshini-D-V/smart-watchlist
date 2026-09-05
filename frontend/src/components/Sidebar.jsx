/**
 * Left sidebar — two panels:
 *  1. Stats: watchlist count, last visit time, flagged count
 *  2. Filter by Sector: clickable list, active sector highlighted
 */

const SECTOR_COLORS = {
  'Semiconductors':      '#6366f1',
  'Technology':          '#3b82f6',
  'Consumer Electronics':'#3b82f6',
  'IT Services':         '#8b5cf6',
  'Electric Vehicles':   '#10b981',
  'Social Media':        '#f59e0b',
  'Internet':            '#06b6d4',
  'Software':            '#8b5cf6',
  'Banking':             '#ec4899',
  'Financials':          '#ec4899',
  'Pharma':              '#84cc16',
  'Energy':              '#f97316',
  'Auto':                '#64748b',
  'Biotech':             '#14b8a6',
  'Other':               '#94a3b8',
};

export function getSectorColor(sector) {
  return SECTOR_COLORS[sector] ?? '#94a3b8';
}

function formatVisitTime(iso) {
  if (!iso) return null;
  const d    = new Date(iso);
  const mins = Math.floor((Date.now() - d) / 60_000);
  if (mins < 2)    return 'just now';
  if (mins < 60)   return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function Sidebar({ symbols, diff, meta, activeSector, onSectorClick }) {
  const flaggedCount = (diff?.items ?? []).filter(i => i.flagged).length;
  const lastVisit    = diff?.last_visit ?? null;

  // Build sector counts from meta
  const sectorCounts = {};
  for (const [, m] of Object.entries(meta ?? {})) {
    const s = m?.sector ?? 'Other';
    sectorCounts[s] = (sectorCounts[s] ?? 0) + 1;
  }
  const sectors = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, color: getSectorColor(name) }));

  return (
    <aside className="sidebar">
      {/* Stats panel */}
      <div className="sidebar-panel">
        <p className="sidebar-section-label">WATCHLIST</p>
        <p className="sidebar-stat-big">{symbols.length}</p>
        <p className="sidebar-stat-sub">stocks tracked</p>

        {lastVisit && (
          <>
            <p className="sidebar-section-label" style={{ marginTop: '1.1rem' }}>LAST VISIT</p>
            <p className="sidebar-stat-mid">{formatVisitTime(lastVisit)}</p>
            <p className="sidebar-stat-sub">
              {new Date(lastVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' · '}
              {new Date(lastVisit).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        )}

        {flaggedCount > 0 && (
          <>
            <p className="sidebar-section-label" style={{ marginTop: '1.1rem' }}>FLAGGED TODAY</p>
            <p className="sidebar-stat-big sidebar-stat-flagged">{flaggedCount}</p>
            <p className="sidebar-stat-sub">meaningful changes</p>
          </>
        )}
      </div>

      {/* Filter by sector */}
      {sectors.length > 0 && (
        <div className="sidebar-panel">
          <div className="sidebar-filter-header">
            <p className="sidebar-section-label">FILTER BY SECTOR</p>
            {activeSector && (
              <button className="sidebar-clear" onClick={() => onSectorClick(null)}>Clear</button>
            )}
          </div>
          <ul className="sidebar-sector-list">
            {sectors.map(({ name, count, color }) => (
              <li key={name}>
                <button
                  className={`sidebar-sector-btn${activeSector === name ? ' sidebar-sector-btn--active' : ''}`}
                  onClick={() => onSectorClick(activeSector === name ? null : name)}
                  aria-pressed={activeSector === name}
                >
                  <span className="sidebar-sector-dot" style={{ background: color }} />
                  <span className="sidebar-sector-name">{name}</span>
                  <span className="sidebar-sector-count">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
