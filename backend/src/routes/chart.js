/**
 * GET /api/chart/:symbol?range=1d|1w|1m|1y
 *
 * Returns OHLC + metadata for charting.
 * Combines Yahoo Finance chart API (for price history) with
 * the quote API (for open, avgVolume, marketCap).
 */

import { Router } from 'express';
import { requireUserId } from '../middleware/auth.js';

const router = Router();
router.use(requireUserId);

const RANGE_MAP = {
  '1d': { range: '1d',  interval: '5m'  },
  '1w': { range: '5d',  interval: '30m' },
  '1m': { range: '1mo', interval: '1d'  },
  '1y': { range: '1y',  interval: '1wk' },
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
};

async function fetchJSON(url) {
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const rangeKey = RANGE_MAP[req.query.range] ? req.query.range : '1w';
  const { range, interval } = RANGE_MAP[rangeKey];

  try {
    // Fetch chart data and quote data in parallel
    const [chartJson, quoteJson] = await Promise.all([
      fetchJSON(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?interval=${interval}&range=${range}&includePrePost=false`
      ),
      fetchJSON(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?interval=1d&range=5d&includePrePost=false`
      ).catch(() => null), // non-fatal if this fails
    ]);

    const result = chartJson?.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'No data for symbol' });

    const meta       = result.meta;
    const timestamps = result.timestamp ?? [];
    const closes     = result.indicators?.quote?.[0]?.close ?? [];

    // Build chart points
    const points = timestamps
      .map((t, i) => ({ t: t * 1000, c: closes[i] }))
      .filter((p) => p.c !== null && p.c !== undefined);

    const price     = meta.regularMarketPrice ?? null;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const changePct = price !== null && prevClose
      ? ((price - prevClose) / prevClose) * 100
      : null;

    // Try to get open, volume, marketCap from the quote meta
    // Yahoo v8 chart meta contains these fields — grab from the 5d fetch too
    const quoteMeta = quoteJson?.chart?.result?.[0]?.meta ?? {};

    // These fields are reliably available for all exchanges
    const high52w    = meta.fiftyTwoWeekHigh ?? null;
    const low52w     = meta.fiftyTwoWeekLow  ?? null;
    const dayHigh    = meta.regularMarketDayHigh ?? null;
    const dayLow     = meta.regularMarketDayLow  ?? null;
    const volume     = meta.regularMarketVolume  ?? null;
    // avgVolume + marketCap + open are only available for US stocks via this API
    const avgVolume  = meta.averageDailyVolume3Month ?? meta.averageDailyVolume10Day ?? null;
    const marketCap  = meta.marketCap ?? null;
    const open       = meta.regularMarketOpen ?? null;

    res.json({
      symbol:    meta.symbol ?? symbol,
      shortName: meta.longName ?? meta.shortName ?? symbol,
      price,
      changePct,
      open,
      prevClose,
      high52w,
      low52w,
      dayHigh,
      dayLow,
      volume,
      avgVolume,
      marketCap,
      currency:  meta.currency ?? 'USD',
      range:     rangeKey,
      points,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
