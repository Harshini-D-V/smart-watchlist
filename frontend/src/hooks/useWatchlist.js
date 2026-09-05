/**
 * Manages watchlist state + live price + diff polling.
 * Every 25s: fetches fresh prices AND re-fetches the diff so
 * "since last visit" values update in real time on screen.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWatchlist, addSymbol, removeSymbol, getPrices, getDiff, getMeta } from '../lib/api.js';

const POLL_INTERVAL = 5_000; // 5s for demo visibility (set to 25_000 for production)

export function useWatchlist(userId) {
  const [symbols, setSymbols] = useState([]);
  const [prices, setPrices]   = useState({});
  const [diff, setDiff]       = useState(null);
  const [meta, setMeta]       = useState({}); // { SYMBOL: { shortName, sector } }
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const pollRef               = useRef(null);
  const symbolsRef            = useRef([]);

  // Keep ref in sync so interval callback always has latest symbols
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);

  // ── Fetch prices ──────────────────────────────────────────────
  const fetchPrices = useCallback(async (currentSymbols) => {
    if (!userId || !currentSymbols.length) return;
    try {
      const symStr = currentSymbols.map((s) => s.symbol).join(',');
      const data = await getPrices(userId, symStr);
      const map = {};
      data.forEach((row) => { map[row.symbol] = row; });
      setPrices(map);
    } catch (err) {
      console.error('[prices] fetch error:', err.message);
      // Keep stale prices — don't clear
    }
  }, [userId]);

  // ── Fetch diff (what changed since last visit) ────────────────
  const fetchDiff = useCallback(async () => {
    if (!userId) return;
    try {
      const diffData = await getDiff(userId);
      setDiff(diffData);
    } catch (err) {
      console.error('[diff] fetch error:', err.message);
    }
  }, [userId]);

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const [list, diffData] = await Promise.all([
          getWatchlist(userId),
          getDiff(userId),
        ]);
        setSymbols(list);
        setDiff(diffData);
        setError(null);
        // Fetch meta for all symbols (non-blocking)
        if (list.length) {
          getMeta(userId, list.map(s => s.symbol))
            .then(setMeta)
            .catch(() => {});
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // ── Polling: prices + diff every 25s ─────────────────────────
  useEffect(() => {
    if (!symbols.length || !userId) return;

    // Immediate first price fetch
    fetchPrices(symbols);

    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      const current = symbolsRef.current;
      fetchPrices(current);
      fetchDiff();          // ← re-fetch diff on every poll so UI stays live
    }, POLL_INTERVAL);

    return () => clearInterval(pollRef.current);
  }, [symbols, userId, fetchPrices, fetchDiff]);

  // ── Add symbol ────────────────────────────────────────────────
  const add = useCallback(async (symbol) => {
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed || symbols.find((s) => s.symbol === trimmed)) return;
    try {
      const row = await addSymbol(userId, trimmed);
      setSymbols((prev) => [...prev, row]);
      // Immediately fetch prices + diff for new symbol
      fetchPrices([...symbolsRef.current, row]);
      fetchDiff();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [userId, symbols, fetchPrices, fetchDiff]);

  // ── Remove symbol ─────────────────────────────────────────────
  const remove = useCallback(async (symbol) => {
    try {
      await removeSymbol(userId, symbol);
      setSymbols((prev) => prev.filter((s) => s.symbol !== symbol));
      setPrices((prev) => { const p = { ...prev }; delete p[symbol]; return p; });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [userId]);

  return { symbols, prices, diff, meta, loading, error, add, remove };
}
