/**
 * Thin API client. All requests include x-user-id header.
 */

const BASE = import.meta.env.VITE_API_BASE || '';

async function request(method, path, body, userId) {
  const headers = { 'Content-Type': 'application/json' };
  if (userId) headers['x-user-id'] = userId;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// Watchlist
export const getWatchlist   = (userId) => request('GET',    '/api/watchlist',       null,   userId);
export const addSymbol      = (userId, symbol) => request('POST',   '/api/watchlist', { symbol }, userId);
export const removeSymbol   = (userId, symbol) => request('DELETE', `/api/watchlist/${symbol}`, null, userId);

// Prices (pass comma-joined symbols string)
export const getPrices      = (userId, symbols) =>
  request('GET', `/api/prices?symbols=${encodeURIComponent(symbols)}`, null, userId);

// Diff (what changed since last visit)
export const getDiff        = (userId) => request('GET', '/api/diff', null, userId);

// AI explain
export const explainChange  = (userId, payload) => request('POST', '/api/explain', payload, userId);

// Chart data
export const getChart = (userId, symbol, range = '1w') =>
  request('GET', `/api/chart/${encodeURIComponent(symbol)}?range=${range}`, null, userId);

// Metadata (shortName, sector) — batch
export const getMeta = (userId, symbols) =>
  request('POST', '/api/meta', { symbols }, userId);
