# Smart Market Watchlist — Groww Code 2026

A real-time stock watchlist that answers one question: **what meaningfully changed since you were last here?**

**Repo:** https://github.com/Harshini-D-V/smart-watchlist

---

## What it does

1. **Create and manage a watchlist** — add any ticker (NSE: `RELIANCE.NS`, US: `AAPL`)
2. **View live market data** — price, today's % change, freshness badge per stock
3. **Return later and see what changed** — diffs current prices against what you saw last time, flags meaningful moves, and shows a digest of what happened

Beyond the three required features, the app also shows:
- Sector composition donut chart (clickable — filters the watchlist)
- Inline sparklines and expandable rows with a "WHAT CHANGED" card
- Correlated-movement insight (detects when 2+ stocks in the same sector moved together)
- AI-generated explanation for flagged moves (Gemini API, with plain-string fallback)

---

## Architecture

Frontend and backend are fully separate apps. The backend owns all market-fetching and data logic — the frontend never calls Yahoo Finance directly.

```
frontend/   React + Vite (port 5173)
backend/    Node.js + Express (port 4000)
            ├── price poller: fetches Yahoo Finance every 25s
            ├── diff engine:  compares current vs last-seen prices
            └── explain:      Gemini API → one sentence, with fallback
database    Supabase (managed Postgres)
```

**Scaling decision — O(symbols) not O(users × symbols):**
The poller fetches each *unique* symbol once per cycle regardless of how many users watch it. All users read from the same shared `price_snapshots` row. Fetch cost stays constant as the user base grows. This is a concrete architectural decision, not hand-waving.

---

## Definition of "meaningful change"

A stock is **flagged** if *either* condition is true:

- **Absolute floor:** the move since last visit is ≥ 2% — always meaningful regardless of timing
- **Relative threshold:** the move since last visit is > 1.5× today's intraday % range — catches stocks accumulating a multi-day move that exceeds their normal single-day volatility

**Why both conditions, not just one:**
Using only the relative threshold had a real bug: if you visit once a day, `change_since_last_visit` ≈ `today's change_pct`, so the ratio is approximately 1.0 and the 1.5× bar is almost never crossed. The absolute floor fixes this. We chose explicit math over ML here — one auditable condition is more appropriate for a financial context than a black-box model.

**Known trade-off:** the 2% floor is a single tuned constant. A more accurate approach would use each stock's rolling 5-day average move (which we'd store as a separate column). We chose not to build that to stay within time constraints. The current floor works correctly — it's just not stock-specific.

---

## Where AI was and wasn't used

**Used (exactly one place):** `POST /api/explain` — takes structured numbers you've already computed (`symbol`, `change_pct_visit`, `volume_ratio`) and returns one plain sentence describing the observed pattern. Example: *"Down 2.3% since your last visit, on 1.8× usual volume."*

**Deliberately not used for:**
- Detecting meaningful change (that's the two-condition threshold above)
- Fetching or interpreting market data
- The correlated-movement insight card (that's pure arithmetic: same sector, same sign)
- Anything the app depends on to function

**Why this restraint matters in fintech:** generating a cause for a price move ("up due to earnings", "driven by AI server demand") without grounding it in a real, sourced headline is a trust and safety problem. The AI is constrained by its prompt to describe only the observable numbers — never a cause. The prompt explicitly bans causal language and the output is checked for it. The plain-string fallback means the app works identically with or without the API key.

---

## Edge cases handled

### 1. API fetch failure → stale UI, not a crash

Every Yahoo Finance fetch is wrapped in try/catch. On failure the last known price is served from `price_snapshots` with `fetch_failed: true`. The frontend shows `⚠ last known price` instead of a freshness timestamp. The app degrades gracefully — it never goes blank or throws.

**To demo this:** turn off WiFi briefly. The stale badge appears within 90 seconds. Turn WiFi back on and it recovers on the next poll cycle.

### 2. Concurrent edits from two devices (race condition)

We chose **last-write-wins via Postgres upsert** (`ON CONFLICT (user_id, symbol) DO UPDATE`). If the same user adds a stock from two devices simultaneously, the later write wins. Postgres row-level locking ensures no partial writes or corrupt rows.

This was a deliberate choice — not an oversight. The alternative (optimistic locking with version counters) adds complexity without meaningful benefit for a watchlist where conflicts are rare and the cost of a lost write is low (you just re-add the stock).

**What's not implemented:** server-side push notification when another device changes your watchlist. That would require WebSockets or SSE. It's out of scope for this sprint and documented here rather than hidden.

### 3. Cross-device persistence

Supabase anonymous auth creates a stable `user_id` (UUID) stored in the browser's `localStorage`. Every `watchlist` and `last_seen` row in Postgres is keyed on this `user_id`.

**What this means in practice:** the same browser session persists across tabs and browser restarts. Opening a new browser on the same device with a fresh session creates a new anonymous user (this is the standard anonymous auth behaviour — the session token is device-local).

**Honest limitation:** full cross-device portability (e.g., "open on your phone and see the same data") requires upgrading the anonymous session to a real account via magic-link email auth. That's a one-line Supabase Auth change and is the documented next step — we didn't build it within the time constraint.

---

## Trade-off from time constraint

The meaningful-change threshold uses a fixed 2% absolute floor rather than each stock's own rolling average daily move. A rolling average (stored as a separate column, computed over 5 days) would make the threshold stock-specific — NVDA would flag at a higher % than a low-volatility blue chip. The current approach is slightly aggressive for low-volatility stocks and slightly conservative for high-volatility ones. It works correctly and the logic is explicit — it's just not yet personalised per stock.

---

## Setup

### Prerequisites
- Node.js ≥ 18
- A [Supabase](https://supabase.com) project (free tier)
- Gemini API key (optional — app works fully without it)

### 1. Database

Paste `supabase/schema.sql` into the Supabase SQL Editor and run it. Then run `supabase/schema_fix3.sql` to grant the correct permissions.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY (optional)
npm install
npm run dev        # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm install
npm run dev        # http://localhost:5173
```

### 4. Verify

```bash
curl http://localhost:4000/api/health
# → { "ok": true }
```

---

## Deployment (Vercel + Render)

| Service | Target | Build/Start command |
|---------|--------|---------------------|
| Render  | `backend/` | `npm start` |
| Vercel  | `frontend/` | `npm run build`, output `dist/` |

Set environment variables in each platform's dashboard. Update `VITE_API_BASE` in the frontend `.env` to point at your Render URL before building.


