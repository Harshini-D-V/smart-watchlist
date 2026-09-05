/**
 * GET /api/diff  (requires x-user-id header)
 *
 * Meaningful change definition:
 *   A stock is flagged if |change_pct_visit| crosses EITHER:
 *     (a) an absolute floor  — ≥ MIN_ABS_MOVE_PCT (e.g. 2%)  — catches any real move, OR
 *     (b) a relative threshold — > 1.5 × today's intraday % move
 *         (only useful when today's move is large, e.g. earnings day)
 *
 *   Using ONLY today's change_pct as the denominator was a bug:
 *   if a user visits once a day, change_pct_visit ≈ today's change_pct,
 *   so the ratio |X| / |X| ≈ 1.0 and the 1.5× threshold is rarely crossed.
 *   The absolute floor fixes this — a 2%+ move is always flagged regardless
 *   of when the user last visited.
 *
 *   This is documented as an explicit trade-off in the README:
 *   a rolling 5-day average would be more accurate but requires storing
 *   historical snapshots — the absolute floor is a deliberate simplification.
 */

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireUserId } from '../middleware/auth.js';

const router = Router();
router.use(requireUserId);

const MEANINGFUL_MULTIPLIER = 1.5;
const MIN_ABS_MOVE_PCT = 2.0; // flag anything ≥ 2% regardless of timing

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

      const absPctVisit = Math.abs(change_pct_visit);
      const todayMove   = Math.abs(snap?.change_pct ?? 0);

      // Flag if EITHER:
      //   (a) absolute move ≥ 2% since last visit (floor — always meaningful), OR
      //   (b) move since visit > 1.5× today's intraday range (relative — catches
      //       multi-day accumulators that exceed normal single-day volatility)
      flagged = absPctVisit >= MIN_ABS_MOVE_PCT ||
                (todayMove > 0 && absPctVisit > MEANINGFUL_MULTIPLIER * todayMove);
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
