-- ============================================================
-- Fix: disable RLS on all tables so the backend secret key works
-- The backend is server-side only — RLS on these tables is
-- handled at the application layer (x-user-id header check).
-- ============================================================

alter table watchlist       disable row level security;
alter table last_seen       disable row level security;
alter table price_snapshots disable row level security;
alter table explain_cache   disable row level security;
