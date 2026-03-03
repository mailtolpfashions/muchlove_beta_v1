-- ============================================================
-- Data Flush Migration
-- ============================================================
-- Adds automatic cleanup of verified/stale system data:
--   - sale_shadows   → delete synced rows older than 7 days
--   - device_heartbeats → delete rows older than 7 days
--   - push_tokens    → delete tokens not refreshed in 90 days
--
-- The app calls flush_verified_data() once per session via heartbeat.
-- ============================================================

-- 1. Add updated_at to push_tokens so we can detect stale devices
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: set updated_at = created_at for existing rows
UPDATE push_tokens SET updated_at = created_at WHERE updated_at = now();

-- 2. Create the flush RPC (SECURITY DEFINER bypasses RLS for cleanup)
CREATE OR REPLACE FUNCTION public.flush_verified_data()
RETURNS jsonb AS $$
DECLARE
  shadows_deleted INTEGER;
  heartbeats_deleted INTEGER;
  tokens_deleted INTEGER;
BEGIN
  -- Synced shadows older than 7 days have served their purpose
  DELETE FROM sale_shadows
  WHERE full_sale_synced = true
    AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS shadows_deleted = ROW_COUNT;

  -- Heartbeats older than 7 days — reinstall detection only needs recent ones
  DELETE FROM device_heartbeats
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS heartbeats_deleted = ROW_COUNT;

  -- Push tokens not refreshed in 90 days are stale (device no longer used)
  DELETE FROM push_tokens
  WHERE updated_at < now() - interval '90 days';
  GET DIAGNOSTICS tokens_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'shadows_deleted', shadows_deleted,
    'heartbeats_deleted', heartbeats_deleted,
    'tokens_deleted', tokens_deleted
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
