/**
 * GET /api/meta/:symbol
 *
 * Returns lightweight metadata for a symbol: shortName, sector, industry.
 * Used to populate sector tags and company names on cards without a full chart fetch.
 * Responses are cached in-memory for 1 hour — metadata rarely changes.
 */

import { Router } from 'express';
import { requireUserId } from '../middleware/auth.js';

const router = Router();
router.use(requireUserId);

// In-memory cache: symbol → { shortName, sector, industry, cachedAt }
const metaCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
};

// Hardcoded sector overrides for well-known tickers
const KNOWN_SECTORS = {
  'AAPL':       'Consumer Electronics',
  'MSFT':       'Software',
  'GOOGL':      'Internet',
  'GOOG':       'Internet',
  'AMZN':       'Internet',
  'META':       'Social Media',
  'TSLA':       'Electric Vehicles',
  'NVDA':       'Semiconductors',
  'AMD':        'Semiconductors',
  'INTC':       'Semiconductors',
  'QCOM':       'Semiconductors',
  'AVGO':       'Semiconductors',
  'TSM':        'Semiconductors',
  'NFLX':       'Internet',
  'UBER':       'Internet',
  'CRM':        'Software',
  'ORCL':       'Software',
  'IBM':        'IT Services',
  'JPM':        'Banking',
  'GS':         'Banking',
  'BAC':        'Banking',
  'V':          'Financials',
  'MA':         'Financials',
  'JNJ':        'Pharma',
  'PFE':        'Pharma',
  'XOM':        'Energy',
  'CVX':        'Energy',
  'TCS.NS':     'IT Services',
  'INFY.NS':    'IT Services',
  'WIPRO.NS':   'IT Services',
  'HCLTECH.NS': 'IT Services',
  'RELIANCE.NS':'Energy',
  'TATAMOTORS.NS':'Auto',
  'BAJFINANCE.NS':'Financials',
  'HDFC.NS':    'Banking',
  'HDFCBANK.NS':'Banking',
  'ICICIBANK.NS':'Banking',
  'SBIN.NS':    'Banking',
  'MARUTI.NS':  'Auto',
};

function guessSector(symbol, industry = '', shortName = '') {
  // Check hardcoded known sectors first
  if (KNOWN_SECTORS[symbol]) return KNOWN_SECTORS[symbol];
  // Fall back to industry string matching
  const lower = (industry + ' ' + shortName).toLowerCase();
  const INDUSTRY_MAP = {
    'semiconductor': 'Semiconductors',
    'consumer electronics': 'Consumer Electronics',
    'software': 'Software',
    'internet': 'Internet',
    'electric vehicle': 'Electric Vehicles',
    'auto': 'Auto',
    'social media': 'Social Media',
    'financial': 'Financials',
    'bank': 'Banking',
    'biotech': 'Biotech',
    'pharma': 'Pharma',
    'oil': 'Energy',
    'energy': 'Energy',
    'information technology': 'IT Services',
  };
  for (const [key, val] of Object.entries(INDUSTRY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  // Cache hit
  const cached = metaCache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return res.json({ symbol, shortName: cached.shortName, sector: cached.sector });
  }

  try {
    // Use the chart meta endpoint — it reliably returns longName for most tickers
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = await resp.json();
    const meta = json?.chart?.result?.[0]?.meta ?? {};

    const shortName = meta.longName ?? meta.shortName ?? symbol;
    const sector    = guessSector(symbol, meta.industry ?? '', shortName);

    metaCache.set(symbol, { shortName, sector, cachedAt: Date.now() });
    res.json({ symbol, shortName, sector });
  } catch (err) {
    // Non-fatal — return symbol as name
    res.json({ symbol, shortName: symbol, sector: KNOWN_SECTORS[symbol] ?? null });
  }
});

// Batch endpoint: POST /api/meta with { symbols: ['AAPL', 'NVDA'] }
router.post('/', async (req, res) => {
  const symbols = (req.body.symbols ?? []).map(s => s.toUpperCase()).slice(0, 20);
  const results = {};

  await Promise.all(symbols.map(async (symbol) => {
    const cached = metaCache.get(symbol);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      results[symbol] = { shortName: cached.shortName, sector: cached.sector };
      return;
    }
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const meta = json?.chart?.result?.[0]?.meta ?? {};
      const shortName = meta.longName ?? meta.shortName ?? symbol;
      const sector    = guessSector(symbol, meta.industry ?? '', shortName);
      metaCache.set(symbol, { shortName, sector, cachedAt: Date.now() });
      results[symbol] = { shortName, sector };
    } catch {
      results[symbol] = { shortName: symbol, sector: KNOWN_SECTORS[symbol] ?? null };
    }
  }));

  res.json(results);
});

export default router;
