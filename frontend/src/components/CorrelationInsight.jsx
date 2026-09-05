/**
 * Detects 2+ stocks in the same sector moving in the same direction today
 * and surfaces an insight card.
 *
 * On the list page: shown in the insight-row panel.
 * On the detail page: shown as a standalone detail-card.
 *
 * Threshold: any non-zero today's % change (change_pct from prices).
 * We don't require flagging — correlation is interesting even on quiet days.
 */

function fmt(n) {
  if (n === null || n === undefined) return '—';
  const s = n >= 0 ? '+' : '';
  return `${s}${Number(n).toFixed(1)}%`;
}

export function CorrelationInsight({ meta, prices, diffMap, currentSymbol, currentSector, variant = 'list' }) {
  // Group stocks by sector — include any stock with a known change_pct
  const bySector = {};

  for (const [symbol, m] of Object.entries(meta ?? {})) {
    const sector = m?.sector;
    if (!sector) continue;
    const changePct = prices?.[symbol]?.change_pct ?? null;
    if (changePct === null) continue; // no price data yet

    if (!bySector[sector]) bySector[sector] = [];
    bySector[sector].push({ symbol, changePct });
  }

  // Find sectors where 2+ stocks moved the same direction
  const correlated = Object.entries(bySector)
    .filter(([, stocks]) => {
      if (stocks.length < 2) return false;
      const allUp   = stocks.every(s => s.changePct > 0);
      const allDown = stocks.every(s => s.changePct < 0);
      return allUp || allDown;
    })
    .map(([sector, stocks]) => ({ sector, stocks, allUp: stocks.every(s => s.changePct > 0) }));

  if (!correlated.length) return null;

  // On detail page: prefer the sector matching the current stock, else first
  const match = currentSector
    ? correlated.find(c => c.sector === currentSector) ?? correlated[0]
    : correlated[0];

  const { sector, stocks, allUp } = match;
  const direction = allUp ? '↑' : '↓';
  const dirClass  = allUp ? 'up' : 'down';
  const pcts      = stocks.map(s => `${s.symbol} ${fmt(s.changePct)}`).join(' and ');

  if (variant === 'detail') {
    return (
      <div className="detail-card insight-card--detail" aria-label={`Correlation: ${sector}`}>
        <span className="insight-icon" aria-hidden="true">📊</span>
        <div className="insight-body">
          <p className="insight-title">
            Correlated with your other {sector.toLowerCase()} holdings
          </p>
          <p className="insight-text">
            {pcts} — their moves are correlated, not independent signals.
          </p>
        </div>
      </div>
    );
  }

  // List view variant
  return (
    <div className="insight-card" aria-label={`Correlation: ${sector}`}>
      <span className="insight-icon" aria-hidden="true">📊</span>
      <div className="insight-body">
        <p className="insight-title">
          Your {stocks.length} {sector.toLowerCase()} stocks moved together today{' '}
          <span className={dirClass}>{direction}</span>
        </p>
        <p className="insight-text">
          {pcts} — their moves are correlated, not independent signals.
        </p>
      </div>
    </div>
  );
}
