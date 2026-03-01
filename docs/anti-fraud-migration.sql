-- Anti-Fraud System — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run)
--
-- Creates 3 new tables + server-side fraud detection triggers.
-- Requires: pg_net extension (built into Supabase) for async HTTP calls.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. device_heartbeats — periodic pings from the app (every 5 min)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS device_heartbeats (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  install_id TEXT NOT NULL,
  pending_sale_count INTEGER NOT NULL DEFAULT 0,
  pending_mutation_count INTEGER NOT NULL DEFAULT 0,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_user_id ON device_heartbeats(user_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_install_id ON device_heartbeats(install_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_created_at ON device_heartbeats(created_at DESC);

ALTER TABLE device_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own heartbeats" ON device_heartbeats;
CREATE POLICY "Users insert own heartbeats"
  ON device_heartbeats FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own heartbeats" ON device_heartbeats;
CREATE POLICY "Users read own heartbeats"
  ON device_heartbeats FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all heartbeats" ON device_heartbeats;
CREATE POLICY "Admins read all heartbeats"
  ON device_heartbeats FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. sale_shadows — minimal sale records sent instantly for fraud detection
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sale_shadows (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'gpay')),
  install_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_sale_synced BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_shadows_user_id ON sale_shadows(user_id);
CREATE INDEX IF NOT EXISTS idx_shadows_sale_id ON sale_shadows(sale_id);
CREATE INDEX IF NOT EXISTS idx_shadows_install_id ON sale_shadows(install_id);
CREATE INDEX IF NOT EXISTS idx_shadows_unsynced ON sale_shadows(full_sale_synced) WHERE NOT full_sale_synced;

ALTER TABLE sale_shadows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own shadows" ON sale_shadows;
CREATE POLICY "Users insert own shadows"
  ON sale_shadows FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own shadows" ON sale_shadows;
CREATE POLICY "Users update own shadows"
  ON sale_shadows FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own shadows" ON sale_shadows;
CREATE POLICY "Users read own shadows"
  ON sale_shadows FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all shadows" ON sale_shadows;
CREATE POLICY "Admins read all shadows"
  ON sale_shadows FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. fraud_logs — audit trail of all detected fraud events
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fraud_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  auto_locked BOOLEAN NOT NULL DEFAULT false,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_logs_user_id ON fraud_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_created_at ON fraud_logs(created_at DESC);

ALTER TABLE fraud_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage fraud logs" ON fraud_logs;
CREATE POLICY "Admins manage fraud logs"
  ON fraud_logs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Service role can insert fraud logs (used by triggers)
DROP POLICY IF EXISTS "Service role inserts fraud logs" ON fraud_logs;
CREATE POLICY "Service role inserts fraud logs"
  ON fraud_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Reinstall detection trigger — fires on heartbeat INSERT
--    If install_id changed and there are unsynced shadows → auto-lock
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.detect_reinstall()
RETURNS trigger AS $$
DECLARE
  prev_install_id TEXT;
  unsynced_count INTEGER;
  edge_url TEXT;
  service_key TEXT;
  user_name TEXT;
  fraud_id TEXT;
BEGIN
  -- Get the previous heartbeat's install_id for this user
  SELECT h.install_id INTO prev_install_id
  FROM device_heartbeats h
  WHERE h.user_id = NEW.user_id
    AND h.id != NEW.id
  ORDER BY h.created_at DESC
  LIMIT 1;

  -- No previous heartbeat = first time, skip
  IF prev_install_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Same install_id = no reinstall, skip
  IF prev_install_id = NEW.install_id THEN
    RETURN NEW;
  END IF;

  -- Install ID changed! Check for truly unsynced sale shadows from old install
  -- A shadow is only suspicious if full_sale_synced is false AND the sale
  -- doesn't actually exist in the sales table (handles timing gaps where
  -- the shadow was sent after the sale INSERT so the trigger missed it)
  SELECT COUNT(*) INTO unsynced_count
  FROM sale_shadows s
  WHERE s.user_id = NEW.user_id
    AND s.install_id = prev_install_id
    AND s.full_sale_synced = false
    AND NOT EXISTS (SELECT 1 FROM sales WHERE sales.id = s.sale_id);

  -- If there are truly unsynced shadows → fraud detected
  IF unsynced_count > 0 THEN
    -- Generate a fraud log ID
    fraud_id := 'fraud_' || gen_random_uuid()::text;

    -- Get user name
    SELECT p.name INTO user_name
    FROM profiles p WHERE p.id = NEW.user_id;

    -- Log the fraud event
    INSERT INTO fraud_logs (id, user_id, reason, details, auto_locked)
    VALUES (
      fraud_id,
      NEW.user_id,
      'reinstall_unsynced_sales',
      jsonb_build_object(
        'old_install_id', prev_install_id,
        'new_install_id', NEW.install_id,
        'unsynced_shadow_count', unsynced_count,
        'user_name', user_name
      ),
      true
    );

    -- Auto-lock the account
    UPDATE profiles SET approved = false WHERE id = NEW.user_id;

    -- Call fraud alert Edge Function (async, non-blocking)
    -- ⚠️ REPLACE these with your actual values:
    edge_url := 'ddaptndonmardgqyemah/functions/v1/push-fraud-alert';
    service_key := 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE';

    BEGIN
      PERFORM net.http_post(
        url := edge_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'user_id', NEW.user_id,
          'user_name', user_name,
          'reason', 'reinstall_unsynced_sales',
          'unsynced_count', unsynced_count,
          'old_install_id', prev_install_id,
          'new_install_id', NEW.install_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail the heartbeat insert if push notification fails
      NULL;
    END;
  ELSE
    -- Reinstall detected but all shadows are accounted for.
    -- Also mark any remaining false-unsynced shadows as synced (cleanup).
    UPDATE sale_shadows
    SET full_sale_synced = true
    WHERE user_id = NEW.user_id
      AND install_id = prev_install_id
      AND full_sale_synced = false
      AND EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_shadows.sale_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_heartbeat_detect_reinstall ON device_heartbeats;
CREATE TRIGGER on_heartbeat_detect_reinstall
  AFTER INSERT ON device_heartbeats
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_reinstall();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Shadow mismatch detection — checks for unsynced shadows older than 1 hour
--    Call this periodically (via pg_cron or from the app's heartbeat)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.detect_shadow_mismatch()
RETURNS void AS $$
DECLARE
  r RECORD;
  fraud_id TEXT;
  user_name TEXT;
  edge_url TEXT;
  service_key TEXT;
BEGIN
  -- ⚠️ REPLACE these with your actual values:
  edge_url := 'ddaptndonmardgqyemah/functions/v1/push-fraud-alert';
  service_key := 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE';

  -- Find users with 3+ unsynced shadows older than 1 hour
  FOR r IN
    SELECT s.user_id, COUNT(*) as unsynced_count, MIN(s.created_at) as oldest_shadow
    FROM sale_shadows s
    WHERE s.full_sale_synced = false
      AND s.created_at < now() - interval '1 hour'
    GROUP BY s.user_id
    HAVING COUNT(*) >= 3
  LOOP
    -- Check if we already logged this recently (avoid duplicate alerts)
    IF EXISTS (
      SELECT 1 FROM fraud_logs f
      WHERE f.user_id = r.user_id
        AND f.reason = 'shadow_mismatch'
        AND f.created_at > now() - interval '1 hour'
    ) THEN
      CONTINUE;
    END IF;

    fraud_id := 'fraud_' || gen_random_uuid()::text;

    SELECT p.name INTO user_name
    FROM profiles p WHERE p.id = r.user_id;

    -- Log the fraud event
    INSERT INTO fraud_logs (id, user_id, reason, details, auto_locked)
    VALUES (
      fraud_id,
      r.user_id,
      'shadow_mismatch',
      jsonb_build_object(
        'unsynced_count', r.unsynced_count,
        'oldest_shadow', r.oldest_shadow,
        'user_name', user_name
      ),
      true
    );

    -- Auto-lock the account
    UPDATE profiles SET approved = false WHERE id = r.user_id;

    -- Notify admins
    BEGIN
      PERFORM net.http_post(
        url := edge_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'user_id', r.user_id,
          'user_name', user_name,
          'reason', 'shadow_mismatch',
          'unsynced_count', r.unsynced_count,
          'oldest_shadow', r.oldest_shadow
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Optional: pg_cron to run shadow mismatch check every 10 minutes
--    (Only works if pg_cron extension is enabled in your Supabase project)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Uncomment the lines below if you have pg_cron enabled:
--
-- SELECT cron.schedule(
--   'detect-shadow-mismatch',
--   '*/10 * * * *',
--   $$SELECT public.detect_shadow_mismatch();$$
-- );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Mark sale shadows as synced when the full sale arrives
--    Trigger on sales INSERT — marks matching shadow as synced
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mark_shadow_synced()
RETURNS trigger AS $$
BEGIN
  UPDATE sale_shadows
  SET full_sale_synced = true
  WHERE sale_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sale_mark_shadow ON sales;
CREATE TRIGGER on_sale_mark_shadow
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_shadow_synced();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. Cleanup: purge old heartbeats (older than 30 days) to save storage
-- ═══════════════════════════════════════════════════════════════════════════════
-- Uncomment if you have pg_cron:
--
-- SELECT cron.schedule(
--   'purge-old-heartbeats',
--   '0 3 * * *',
--   $$DELETE FROM device_heartbeats WHERE created_at < now() - interval '30 days';$$
-- );
