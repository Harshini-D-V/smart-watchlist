-- ============================================================
-- Smart Market Watchlist — Supabase Schema
-- Run this in the Supabase SQL Editor (once, in order)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── 1. watchlist ─────────────────────────────────────────────
-- One row per (user, symbol). Tied to Supabase Auth user_id.
create table if not exists watchlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,          -- from Supabase Auth (anon or real user)
  symbol      text not null,          -- e.g. "RELIANCE.NS", "TCS.NS"
  created_at  timestamptz not null default now(),

  constraint watchlist_user_symbol_unique unique (user_id, symbol)
);

-- Fast lookups by user
create index if not exists idx_watchlist_user_id on watchlist (user_id);

-- ── 2. price_snapshots ───────────────────────────────────────
-- One row per symbol (shared across all users — deduplicated).
-- Updated by the backend poller every ~25 seconds.
create table if not exists price_snapshots (
  symbol        text primary key,
  price         numeric,
  change_pct    numeric,              -- today's % change (from yahoo)
  volume        bigint,
  fetched_at    timestamptz not null default now(),
  fetch_failed  boolean not null default false
);

-- ── 3. last_seen ─────────────────────────────────────────────
-- Stores the price each user last saw for each symbol.
-- Updated whenever the frontend calls GET /api/diff.
create table if not exists last_seen (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null,
  symbol    text not null,
  price     numeric,
  seen_at   timestamptz not null default now(),

  constraint last_seen_user_symbol_unique unique (user_id, symbol)
);

create index if not exists idx_last_seen_user_id on last_seen (user_id);

-- ── 4. explain_cache ─────────────────────────────────────────
-- Caches AI-generated explanations per change-event bucket.
-- Prevents re-calling Gemini on every frontend refresh.
create table if not exists explain_cache (
  cache_key   text primary key,       -- "<SYMBOL>::<rounded_pct>"
  explanation text not null,
  created_at  timestamptz not null default now()
);

-- ── 5. Row Level Security ─────────────────────────────────────
-- price_snapshots and explain_cache are read-only from the frontend
-- (the service-role key on the backend bypasses RLS anyway).
-- watchlist and last_seen must be scoped to the authenticated user.

alter table watchlist       enable row level security;
alter table last_seen       enable row level security;
alter table price_snapshots enable row level security;
alter table explain_cache   enable row level security;

-- watchlist: users can only see/edit their own rows
create policy "watchlist: own rows only"
  on watchlist for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- last_seen: same
create policy "last_seen: own rows only"
  on last_seen for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- price_snapshots: readable by everyone (no PII)
create policy "price_snapshots: public read"
  on price_snapshots for select
  using (true);

-- explain_cache: readable by everyone
create policy "explain_cache: public read"
  on explain_cache for select
  using (true);

-- ── 6. Indexes for scale (per plan §5c) ──────────────────────
-- "Index on (user_id, symbol) so lookups stay fast as rows grow"
create index if not exists idx_watchlist_user_symbol   on watchlist  (user_id, symbol);
create index if not exists idx_last_seen_user_symbol   on last_seen  (user_id, symbol);
create index if not exists idx_snapshots_fetched_at    on price_snapshots (fetched_at desc);
