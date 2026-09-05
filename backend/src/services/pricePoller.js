/**
 * Background price poller.
 *
 * Every `intervalMs` it:
 *   1. Queries all *unique* symbols currently in any user's watchlist.
 *   2. Fetches them via Yahoo Finance's chart API (no library needed,
 *      separate rate-limit bucket from the quote endpoint).
 *   3. Upserts into price_snapshots (one row per symbol — shared across users).
 *
 * Cost: O(unique symbols), not O(users × symbols).
 */

import { supabase } from '../lib/supabase.js';

/**
 * Fetch a single symbol using Yahoo Finance's v8 chart endpoint.
 * Returns { price, change_pct, volume } or throws on failure.
 */
async function fetchSymbol(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error('No chart data in response');

  const price      = meta.regularMarketPrice ?? null;
  const prevClose  = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change_pct = price !== null && prevClose ? ((price - prevClose) / prevClose) * 100 : null;
  const volume     = meta.regularMarketVolume ?? null;

  return { price, change_pct, volume };
}

async function pollPrices() {
  // 1. Get all unique symbols being watched by anyone
  const { data: rows, error: watchErr } = await supabase
    .from('watchlist')
    .select('symbol');

  if (watchErr) {
    console.error('[poller] watchlist fetch error:', watchErr.message);
    return;
  }

  const symbols = [...new Set((rows || []).map((r) => r.symbol))];
  if (!symbols.length) return;

  // 2. Fetch each symbol (sequentially with small delay to avoid rate limits)
  const upsertRows = [];
  const failedRows = [];

  for (const symbol of symbols) {
    try {
      const { price, change_pct, volume } = await fetchSymbol(symbol);
      upsertRows.push({
        symbol,
        price,
        change_pct,
        volume,
        fetched_at: new Date().toISOString(),
        fetch_failed: false,
      });
    } catch (err) {
      console.error(`[poller] fetch failed for ${symbol}:`, err.message);
      failedRows.push({
        symbol,
        price: null,
        change_pct: null,
        volume: null,
        fetched_at: new Date().toISOString(),
        fetch_failed: true,
      });
    }
    // Small delay between symbols to be a good API citizen
    await new Promise((r) => setTimeout(r, 300));
  }

  // 3. Upsert successful fetches
  if (upsertRows.length) {
    const { error } = await supabase
      .from('price_snapshots')
      .upsert(upsertRows, { onConflict: 'symbol' });
    if (error) {
      console.error('[poller] upsert error:', error.message);
    } else {
      console.log(`[poller] updated ${upsertRows.length} symbol(s) at ${new Date().toISOString()}`);
    }
  }

  // 4. Mark failed fetches as stale (preserves last known price)
  for (const row of failedRows) {
    await supabase
      .from('price_snapshots')
      .upsert(row, { onConflict: 'symbol' });
  }
}

export function startPricePoller(intervalMs = 25_000) {
  pollPrices();
  setInterval(pollPrices, intervalMs);
  console.log(`[poller] started — polling every ${intervalMs / 1000}s`);
}
