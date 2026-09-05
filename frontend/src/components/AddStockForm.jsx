/**
 * Input form to add a new symbol to the watchlist.
 * Accepts NSE tickers (e.g. RELIANCE.NS) or US tickers (AAPL).
 */

import { useState } from 'react';

const PLACEHOLDER_EXAMPLES = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'AAPL', 'NVDA'];

export function AddStockForm({ onAdd, disabled, compact = false }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) { setError('Enter a ticker.'); return; }
    if (!/^[A-Z0-9.\-^]+$/.test(trimmed)) { setError('Invalid ticker.'); return; }
    setError('');
    onAdd(trimmed);
    setValue('');
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} aria-label="Add stock">
        <button type="submit" className="btn-add-compact" disabled={disabled || !value.trim()}>
          + Add
        </button>
      </form>
    );
  }

  return (
    <form className="add-stock-form" onSubmit={handleSubmit} aria-label="Add stock to watchlist">
      <div className="add-stock-input-group">
        <input
          type="text"
          className="input-symbol"
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          placeholder="e.g. AAPL, RELIANCE.NS"
          aria-label="Stock ticker symbol"
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn-add" disabled={disabled || !value.trim()}>+ Add</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
