/**
 * Watchlist CRUD
 *
 * All routes expect a header:  x-user-id: <uuid>
 * (set by the frontend from Supabase anonymous auth)
 *
 * GET    /api/watchlist          — list user's symbols
 * POST   /api/watchlist          — add symbol  { symbol: "RELIANCE.NS" }
 * DELETE /api/watchlist/:symbol  — remove symbol
 */

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireUserId } from '../middleware/auth.js';

const router = Router();
router.use(requireUserId);

// GET /api/watchlist
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('watchlist')
    .select('symbol, created_at')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/watchlist
router.post('/', async (req, res) => {
  const symbol = (req.body.symbol || '').trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  const { data, error } = await supabase
    .from('watchlist')
    .upsert({ user_id: req.userId, symbol }, { onConflict: 'user_id,symbol' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/watchlist/:symbol
router.delete('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', req.userId)
    .eq('symbol', symbol);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, symbol });
});

export default router;
