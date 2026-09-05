/**
 * GET /api/prices?symbols=RELIANCE.NS,TCS.NS
 *
 * Returns latest price snapshots from the DB (served from cache),
 * with a `stale` flag if the last fetch failed or is older than 90s.
 */

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireUserId } from '../middleware/auth.js';

const router = Router();
router.use(requireUserId);

const STALE_THRESHOLD_MS = 90_000; // 90 seconds

router.get('/', async (req, res) => {
  const raw = req.query.symbols || '';
  const symbols = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols.length) return res.status(400).json({ error: 'symbols query param required' });

  const { data, error } = await supabase
    .from('price_snapshots')
    .select('symbol, price, change_pct, volume, fetched_at, fetch_failed')
    .in('symbol', symbols);

  if (error) return res.status(500).json({ error: error.message });

  const now = Date.now();
  const result = symbols.map((sym) => {
    const row = data?.find((r) => r.symbol === sym);
    if (!row) return { symbol: sym, price: null, change_pct: null, stale: true, fetched_at: null };

    const age = now - new Date(row.fetched_at).getTime();
    const stale = row.fetch_failed || age > STALE_THRESHOLD_MS;
    return {
      symbol: sym,
      price: row.price,
      change_pct: row.change_pct,
      volume: row.volume,
      stale,
      fetched_at: row.fetched_at,
    };
  });

  res.json(result);
});

export default router;
