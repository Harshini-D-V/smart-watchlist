-- Grant full access to service_role on all tables
grant all on watchlist       to service_role, anon, authenticated;
grant all on price_snapshots to service_role, anon, authenticated;
grant all on last_seen       to service_role, anon, authenticated;
grant all on explain_cache   to service_role, anon, authenticated;

-- Also grant sequence usage (for uuid generation)
grant usage on schema public to service_role, anon, authenticated;
