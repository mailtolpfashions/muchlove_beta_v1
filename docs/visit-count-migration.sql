-- ── Atomic customer visit-count increment ────────────────────────────────────
--
-- Replaces the client-side fetch → increment → update pattern that was
-- vulnerable to a TOCTOU race condition when two devices synced offline
-- sales for the same customer simultaneously.
--
-- The UPDATE expression `visit_count = visit_count + 1` is evaluated inside
-- a single statement, so Postgres serialises concurrent calls automatically
-- via row-level locking. No application-level coordination is required.
--
-- Called from the JS client via:
--   supabase.rpc('increment_customer_visit_count', { p_customer_id: '...' })
--
-- SECURITY DEFINER runs with the permissions of the function owner (service
-- role), ensuring the update succeeds even when the calling user's RLS policy
-- only allows SELECT on the customers table.

CREATE OR REPLACE FUNCTION increment_customer_visit_count(p_customer_id TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE customers
  SET visit_count = visit_count + 1
  WHERE id = p_customer_id;
$$;
