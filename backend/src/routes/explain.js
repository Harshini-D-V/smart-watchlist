/**
 * POST /api/explain
 *
 * Returns a one-sentence plain-English description of a flagged price move.
 * Uses Claude API. Falls back to a plain string template on ANY failure.
 *
 * Body: { symbol: string, changePct: number, volumeRatio?: number }
 *
 * Hard constraints (per spec):
 *   - Never assert or imply a cause for the move.
 *   - Never mention news, earnings, analysts, events, or use causal language.
 *   - If volumeRatio is absent, omit volume language entirely.
 *   - Always return HTTP 200 with a usable explanation — never 500.
 *   - No DB reads or writes — in-memory cache only.
 */

import { Router } from 'express';
import { requireUserId } from '../middleware/auth.js';

const router = Router();
router.use(requireUserId);

// ── In-memory cache: cacheKey → explanation string ────────────────────────────
const explainCache = new Map();

function makeCacheKey(symbol, changePct, volumeRatio) {
  const pct = Number(changePct).toFixed(2);
  const vol = volumeRatio != null ? Number(volumeRatio).toFixed(2) : 'none';
  return `${symbol}::${pct}::${vol}`;
}

// ── Plain-string fallback (built from numbers only, no AI) ────────────────────
function buildFallback(symbol, changePct, volumeRatio) {
  const dir = changePct >= 0 ? 'Up' : 'Down';
  const pct = Math.abs(changePct).toFixed(1);
  const volPart =
    volumeRatio != null && volumeRatio > 1.1
      ? ` on ${Number(volumeRatio).toFixed(1)}× usual volume`
      : '';
  return `${dir} ${pct}%${volPart} since your last visit.`;
}

// ── Gemini API call ───────────────────────────────────────────────────────────
// Models in preference order — first one that responds wins
const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];

async function callAI(symbol, changePct, volumeRatio) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const volLine = volumeRatio != null
    ? `Volume ratio vs recent average: ${Number(volumeRatio).toFixed(2)}×`
    : '';

  const prompt = [
    `Symbol: ${symbol}`,
    `Price change since user's last visit: ${changePct >= 0 ? '+' : ''}${Number(changePct).toFixed(2)}%`,
    volLine,
    '',
    'Write ONE sentence (max 15 words) describing ONLY the size of this price move.',
    'STRICT RULES — any violation makes the response wrong:',
    '  - State only the observed numbers. Zero interpretation.',
    '  - FORBIDDEN words: due to, following, after, because, driven, amid, reflecting,',
    '    investor, enthusiasm, momentum, sector, news, earnings, analyst, report, event.',
    '  - If no volume ratio given, do NOT mention volume.',
    '  - Plain text only. No markdown.',
    'Good example: "Up 6.2% since the previous visit, on 2.1× the usual volume."',
    'Bad example: "Up 6.2% reflecting strong investor demand." ← FORBIDDEN, has interpretation.',
  ].filter(Boolean).join('\n');

  const reqBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 60, temperature: 0.1 },
  };

  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(8000), // gemini-3.1-flash-lite averages ~3.5s
      });
      if (!resp.ok) { lastErr = new Error(`Gemini HTTP ${resp.status} (${model})`); continue; }
      const json = await resp.json();
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      // Gemini thinking models attach thoughtSignature to the text part itself —
      // filter only parts that have ONLY a thoughtSignature and no text
      const text = parts
        .filter((p) => p.text)
        .map((p) => p.text.trim())
        .join(' ').trim();
      if (text) {
        // Safety check: reject if causal language slipped through
        const causal = /\b(due to|following|because|driven|amid|reflecting|investor|enthusiasm|momentum|analyst|earnings|news|report)\b/i;
        if (causal.test(text)) {
          console.warn(`[explain] Causal language detected from ${model}, using fallback. Text: "${text}"`);
          lastErr = new Error(`Causal language in response`);
          continue;
        }
        return text;
      }
      lastErr = new Error(`Empty response from ${model}`);
    } catch (err) { lastErr = err; }
  }
  throw lastErr ?? new Error('All Gemini models failed');
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { symbol, changePct, volumeRatio } = req.body;

  // Basic input validation — but always respond 200 even on bad input
  if (!symbol || changePct === undefined || changePct === null) {
    const fallback = buildFallback(symbol ?? '?', changePct ?? 0, volumeRatio);
    return res.json({ explanation: fallback, source: 'fallback' });
  }

  const key = makeCacheKey(symbol, changePct, volumeRatio);

  // 1. Cache hit — return immediately
  if (explainCache.has(key)) {
    return res.json({ explanation: explainCache.get(key), source: 'cache' });
  }

  // 2. Try Claude
  let explanation = null;
  let source = 'ai';

  try {
    explanation = await callAI(symbol, changePct, volumeRatio);
  } catch (err) {
    console.error('[explain] AI failed, using fallback:', err.message);
    source = 'fallback';
  }

  // 3. Fallback if AI returned nothing
  if (!explanation) {
    explanation = buildFallback(symbol, changePct, volumeRatio);
    source = 'fallback';
  }

  // 4. Cache and respond
  explainCache.set(key, explanation);
  res.json({ explanation, source });
});

export default router;
