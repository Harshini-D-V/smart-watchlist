# Smart Market Watchlist — Groww Code 2026

A real-time stock watchlist that answers one question: **what meaningfully changed since you were last here?**

**Live demo:** https://smart-watchlist-blue.vercel.app
**Repo:** https://github.com/Harshini-D-V/smart-watchlist

---

## What it does

1. **Create and manage a watchlist** — add any ticker (NSE: `RELIANCE.NS`, US: `AAPL`, `NVDA`, `TSLA`)
2. **View live market data** — price, today's % change, sparkline, freshness badge per stock
3. **Return later and see what changed** — diffs current prices against what you saw last time, flags meaningful moves, and shows a digest of what happened

Beyond the three required features:
- **Sector composition donut chart** — clickable, filters the watchlist by sector
- **Expandable stock rows** — click any stock to see an inline chart + "WHAT CHANGED" panel + full detail view
- **Correlated-movement insight** — detects when 2+ stocks in the same sector move together on the same day
- **AI-generated explanation** for flagged moves (Gemini API), with a plain-string fallback that always works
- **Filter by sector** in the left sidebar — click any sector to show only those stocks
- **Digest banner** — shows which stocks changed since your last visit with coloured chips

---

## Architecture

Frontend and backend are fully separate apps. The backend owns all market-fetching and data logic — the frontend never calls Yahoo Finance directly.

```
frontend/   React + Vite  →  deployed on Vercel
backend/    Node.js + Express  →  deployed on Render
            ├── price poller: fetches Yahoo Finance every 25s
            ├── diff engine:  compares current vs last-seen prices
            ├── meta:         company names + sector tags
            └── explain:      Gemini API → one sentence, with fallback
database    Supabase (managed Postgres)
```

**Scaling decision — O(symbols) not O(users × symbols):**
The poller fetches each *unique* symbol once per cycle regardless of how many users watch it. All users read from the same shared `price_snapshots` row. Fetch cost stays constant as the user base grows.

---

## Definition of "meaningful change"

A stock is **flagged** if *either* condition is true:

- **Absolute floor:** the move since last visit is ≥ 2% — always meaningful regardless of timing
- **Relative threshold:** the move since last visit is > 1.5× today's intraday % range — catches stocks accumulating a multi-day move that exceeds their normal single-day volatility

**Why both conditions:**
Using only the relative threshold had a real bug — if you visit once a day, `change_since_last_visit` ≈ `today's change_pct`, so the ratio ≈ 1.0 and the 1.5× bar is almost never crossed. The absolute floor fixes this. Explicit math over ML — one auditable condition is more appropriate for a financial context than a black-box model.

**Known trade-off:** the 2% floor is a single tuned constant. A rolling 5-day average per stock would be more accurate but requires storing historical snapshots — deliberately not built within the time constraint.

---

## Where AI was and wasn't used

**Used (exactly one place):** `POST /api/explain` takes structured numbers already computed (`symbol`, `change_pct_visit`, `volume_ratio`) and returns one plain sentence describing the observed pattern. Example: *"Down 2.3% since your last visit, on 1.8× usual volume."*

**Deliberately not used for:**
- Detecting meaningful change (that's the two-condition threshold above)
- Fetching or interpreting market data
- The correlated-movement insight card (pure arithmetic: same sector, same direction)
- Anything the app depends on to function

**Why this restraint matters in fintech:** generating a cause for a price move without grounding it in a real sourced headline is a trust and safety problem. The AI prompt explicitly bans causal language ("due to", "following", "because of", "earnings") and the output is checked against a blocklist. The plain-string fallback means the app works identically with or without the API key.

---

## Edge cases handled

### 1. API fetch failure → stale UI, not a crash

Every Yahoo Finance fetch is wrapped in try/catch. On failure the last known price is served from `price_snapshots` with `fetch_failed: true`. The frontend shows a `⚠ last known price` badge instead of a freshness timestamp — the app degrades gracefully, never goes blank.

**To demo:** turn off WiFi. The poller runs every 25s; the stale badge appears after ~90s (intentional threshold — one missed poll shouldn't alarm the user, only 3–4 consecutive misses do). Turn WiFi back on and it recovers on the next successful poll.

### 2. Concurrent edits from two devices (race condition)

**Last-write-wins via Postgres upsert** (`ON CONFLICT (user_id, symbol) DO UPDATE`). If the same user adds or removes a stock from two devices at once, the later write wins. Postgres row-level locking ensures no partial writes.

Deliberate choice — not an oversight. Optimistic locking with version counters adds complexity without meaningful benefit for a watchlist where conflicts are rare and a lost write costs nothing.

**Not implemented:** server-side push when another device changes your watchlist (would need WebSockets). Documented here, not hidden.

### 3. Cross-device persistence

Supabase anonymous auth creates a stable `user_id` (UUID) in `localStorage`. Every `watchlist` and `last_seen` row is keyed on this ID — the same session persists across tabs and browser restarts.

**Honest limitation:** full cross-device portability requires upgrading to a real account via magic-link email auth. That's a one-line Supabase Auth change and is the documented next step.

---

## Trade-off from time constraint

The flagging threshold uses a fixed 2% floor rather than each stock's own rolling average. A per-stock rolling average would make NVDA flag at a higher % than a low-volatility blue chip. The current approach is slightly aggressive for low-volatility stocks — it's correct and explicit, just not yet personalised per stock.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | Supabase (Postgres) |
| Stock data | Yahoo Finance chart API (free, no key) |
| AI | Gemini API (optional, with plain-string fallback) |
| Auth | Supabase anonymous auth |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Setup (local)

### Prerequisites
- Node.js ≥ 18
- A [Supabase](https://supabase.com) project (free tier)
- Gemini API key (optional)

### 1. Database

Paste `supabase/schema.sql` into the Supabase SQL Editor and run it. Creates all tables, indexes, and permissions in one step.

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
# Set VITE_API_BASE=http://localhost:4000
npm install
npm run dev        # http://localhost:5173
```

### 4. Verify

```bash
curl http://localhost:4000/api/health
# → { "ok": true }
```

---

## Deployed URLs

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://smart-watchlist-blue.vercel.app |
| Backend (Render) | https://smart-watchlist-backend-35al.onrender.com |

> Note: the Render free tier spins down after inactivity — the first request after a cold start may take ~50 seconds. Subsequent requests are instant.
