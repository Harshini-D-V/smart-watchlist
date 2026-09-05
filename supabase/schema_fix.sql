-- ============================================================
-- RLS fix: grant service_role bypass + allow anon auth users
-- Run this in the Supabase SQL Editor after schema.sql
-- ============================================================

-- Drop old policies so we can recreate cleanly
drop policy if exists "watchlist: own rows only"    on watchlist;
drop policy if exists "last_seen: own rows only"    on last_seen;
drop policy if exists "price_snapshots: public read" on price_snapshots;
drop policy if exists "explain_cache: public read"  on explain_cache;

-- ── service_role bypass (for backend service key) ─────────────
-- The service_role is exempt from RLS by default in Postgres,
-- but with new Supabase API keys we also add explicit policies.

-- watchlist: authenticated users own their rows; service_role full access
create policy "watchlist: authenticated users"
  on watchlist for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "watchlist: service_role full access"
  on watchlist for all
  to service_role
  using (true)
  with check (true);

-- last_seen: same pattern
create policy "last_seen: authenticated users"
  on last_seen for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "last_seen: service_role full access"
  on last_seen for all
  to service_role
  using (true)
  with check (true);

-- price_snapshots: public read, service_role write
create policy "price_snapshots: public read"
  on price_snapshots for select
  to anon, authenticated
  using (true);

create policy "price_snapshots: service_role full access"
  on price_snapshots for all
  to service_role
  using (true)
  with check (true);

-- explain_cache: public read, service_role write
create policy "explain_cache: public read"
  on explain_cache for select
  to anon, authenticated
  using (true);

create policy "explain_cache: service_role full access"
  on explain_cache for all
  to service_role
  using (true)
  with check (true);

-- ── Enable anonymous sign-ins (required for useAuth.js) ───────
-- Run this if you haven't already enabled it in Auth settings:
-- Dashboard → Authentication → Providers → Anonymous → Enable
-- (Cannot be done via SQL — must be toggled in the dashboard)
