-- ============================================================
-- Smart Market Watchlist — Supabase Schema
-- Run this once in the Supabase SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ── watchlist ────────────────────────────────────────────────
-- One row per (user, symbol). Tied to Supabase Auth user_id.
create table if not exists watchlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  symbol      text not null,
  created_at  timestamptz not null default now(),
  constraint watchlist_user_symbol_unique unique (user_id, symbol)
);

-- ── price_snapshots ──────────────────────────────────────────
-- One row per symbol, shared across all users.
-- Updated by the backend poller every ~25 seconds.
create table if not exists price_snapshots (
  symbol        text primary key,
  price         numeric,
  change_pct    numeric,
  volume        bigint,
  fetched_at    timestamptz not null default now(),
  fetch_failed  boolean not null default false
);

-- ── last_seen ────────────────────────────────────────────────
-- Stores the price each user last saw for each symbol.
-- Updated when the user opens the app (new session detection).
create table if not exists last_seen (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null,
  symbol    text not null,
  price     numeric,
  seen_at   timestamptz not null default now(),
  constraint last_seen_user_symbol_unique unique (user_id, symbol)
);

-- ── explain_cache ────────────────────────────────────────────
-- Caches AI-generated explanations per change-event bucket.
create table if not exists explain_cache (
  cache_key   text primary key,
  explanation text not null,
  created_at  timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_watchlist_user_id       on watchlist        (user_id);
create index if not exists idx_watchlist_user_symbol   on watchlist        (user_id, symbol);
create index if not exists idx_last_seen_user_id       on last_seen        (user_id);
create index if not exists idx_last_seen_user_symbol   on last_seen        (user_id, symbol);
create index if not exists idx_snapshots_fetched_at    on price_snapshots  (fetched_at desc);

-- ── RLS ──────────────────────────────────────────────────────
alter table watchlist       disable row level security;
alter table last_seen       disable row level security;
alter table price_snapshots disable row level security;
alter table explain_cache   disable row level security;

-- ── Permissions ──────────────────────────────────────────────
grant usage on schema public to service_role, anon, authenticated;
grant all   on watchlist       to service_role, anon, authenticated;
grant all   on price_snapshots to service_role, anon, authenticated;
grant all   on last_seen       to service_role, anon, authenticated;
grant all   on explain_cache   to service_role, anon, authenticated;
