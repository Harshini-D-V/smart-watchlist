/**
 * GET /api/diff  (requires x-user-id header)
 *
 * Returns a diff of what changed for this user since their last visit.
 * Also updates the `last_seen` snapshot to the current prices.
 *
 * Meaningful change definition (per plan §2):
 *   A stock is "flagged" if  |change_since_last_visit| > 1.5 × avg_daily_move
 *   where avg_daily_move ≈ |regularMarketChangePercent| averaged over recent days.
 *   Since we only have current data, we approximate:
 *     avg_daily_move = abs(current_change_pct) — and compare the
 *     price delta since the user's last visit against 1.5× that average.
 *
 *   For a production version you'd store a rolling 5-day avg; this is the
 *   explicit simple-over-ML choice documented in the README.
 *
 * Response shape:
 *   {
 *     items: [
 *       { symbol, price_now, price_then, change_abs, change_pct_visit, flagged, explanation }
 *     ],
 *     last_visit: ISO string | null,
 *     summary: "3 stocks changed since your last visit"
 *   }
 */

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireUserId } from '../middleware/auth.js';

const router = Router();
router.use(requireUserId);

const MEANINGFUL_MULTIPLIER = 1.5;

router.get('/', async (req, res) => {
  const userId = req.userId;

  // 1. Get user's watchlist symbols
  const { data: watchRows, error: wErr } = await supabase
    .from('watchlist')
    .select('symbol')
    .eq('user_id', userId);

  if (wErr) return res.status(500).json({ error: wErr.message });
  const symbols = (watchRows || []).map((r) => r.symbol);
  if (!symbols.length) return res.json({ items: [], last_visit: null, summary: 'Your watchlist is empty.' });

  // 2. Get current price snapshots (include volume for volumeRatio computation)
  const { data: snapshots, error: sErr } = await supabase
    .from('price_snapshots')
    .select('symbol, price, change_pct, volume, fetched_at')
    .in('symbol', symbols);

  if (sErr) return res.status(500).json({ error: sErr.message });

  // 3. Get user's last-seen prices
  const { data: lastSeen, error: lErr } = await supabase
    .from('last_seen')
    .select('symbol, price, seen_at')
    .eq('user_id', userId)
    .in('symbol', symbols);

  if (lErr) return res.status(500).json({ error: lErr.message });

  const lastSeenMap = Object.fromEntries((lastSeen || []).map((r) => [r.symbol, r]));
  const snapshotMap = Object.fromEntries((snapshots || []).map((r) => [r.symbol, r]));

  // 4. Compute diffs
  const items = symbols.map((symbol) => {
    const snap = snapshotMap[symbol];
    const seen = lastSeenMap[symbol];

    const price_now = snap?.price ?? null;
    const price_then = seen?.price ?? null;
    const last_visit = seen?.seen_at ?? null;
    const volume = snap?.volume ?? null;

    let change_abs = null;
    let change_pct_visit = null;
    let flagged = false;

    if (price_now !== null && price_then !== null && price_then !== 0) {
      change_abs = price_now - price_then;
      change_pct_visit = (change_abs / price_then) * 100;

      // avg_daily_move approximated as the absolute current daily % move
      const avg_daily_move = Math.abs(snap?.change_pct ?? change_pct_visit);
      flagged = Math.abs(change_pct_visit) > MEANINGFUL_MULTIPLIER * avg_daily_move;
    }

    return {
      symbol,
      price_now,
      price_then,
      change_abs: change_abs !== null ? +change_abs.toFixed(4) : null,
      change_pct_visit: change_pct_visit !== null ? +change_pct_visit.toFixed(2) : null,
      flagged,
      last_visit,
      volume,  // raw today's volume — frontend uses this + avgVolume from chart to compute ratio
    };
  });

  // 5. Update last_seen — but only if this is a "new session".
  //    A new session = either no prior last_seen row exists, OR the most
  //    recent seen_at was more than SESSION_GAP_MS ago (user was away).
  //    This prevents the diff being zeroed out on every 25s poll refresh.
  const SESSION_GAP_MS = 5 * 60 * 1000; // 5 minutes
  const now = new Date();
  const mostRecentSeen = lastSeen?.length
    ? Math.max(...lastSeen.map((r) => new Date(r.seen_at).getTime()))
    : 0;
  const isNewSession = !mostRecentSeen || (now.getTime() - mostRecentSeen) > SESSION_GAP_MS;

  if (isNewSession) {
    const lastSeenUpsert = symbols
      .map((symbol) => {
        const snap = snapshotMap[symbol];
        if (!snap?.price) return null;
        return { user_id: userId, symbol, price: snap.price, seen_at: now.toISOString() };
      })
      .filter(Boolean);

    if (lastSeenUpsert.length) {
      await supabase
        .from('last_seen')
        .upsert(lastSeenUpsert, { onConflict: 'user_id,symbol' });
    }
  }

  const firstVisit = !lastSeen?.length;
  const flaggedCount = items.filter((i) => i.flagged).length;
  const changedCount = items.filter((i) => i.change_abs !== null && i.change_abs !== 0).length;

  const last_visit = lastSeen?.[0]?.seen_at ?? null;
  const summary = firstVisit
    ? 'Welcome! Prices are being tracked from this visit.'
    : flaggedCount > 0
    ? `${flaggedCount} stock${flaggedCount > 1 ? 's' : ''} moved significantly since your last visit.`
    : changedCount > 0
    ? `${changedCount} stock${changedCount > 1 ? 's' : ''} changed since your last visit.`
    : 'No significant changes since your last visit.';

  res.json({ items, last_visit, summary });
});

export default router;
