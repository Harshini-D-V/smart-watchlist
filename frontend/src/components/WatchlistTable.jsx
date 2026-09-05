/**
 * Main watchlist table with all stock rows.
 */

import { StockRow } from './StockRow.jsx';

export function WatchlistTable({ userId, symbols, prices, diff, onRemove }) {
  const diffMap = Object.fromEntries(
    (diff?.items ?? []).map((item) => [item.symbol, item])
  );

  if (!symbols.length) {
    return (
      <div className="empty-state" role="status">
        <p className="empty-state-text">Your watchlist is empty.</p>
        <p className="empty-state-hint">Add a stock ticker above to get started.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper" role="region" aria-label="Watchlist">
      <table className="watchlist-table">
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Price</th>
            <th scope="col">Today</th>
            <th scope="col">Since last visit</th>
            <th scope="col">Freshness</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {symbols.map(({ symbol }) => (
            <StockRow
              key={symbol}
              userId={userId}
              symbol={symbol}
              priceData={prices[symbol] ?? null}
              diffItem={diffMap[symbol] ?? null}
              onRemove={onRemove}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
