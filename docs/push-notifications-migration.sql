-- Push Tokens table for background push notifications
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run)

-- ═══════════════════════════════════════════════════════════════════════════════
-- push_tokens — stores Expo Push Tokens for each user/device
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS push_tokens (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
DROP POLICY IF EXISTS "Users manage own push tokens" ON push_tokens;
CREATE POLICY "Users manage own push tokens"
  ON push_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all tokens (needed if you want to query from client-side, 
-- but the Edge Function uses service_role key so this is optional)
DROP POLICY IF EXISTS "Admins read all push tokens" ON push_tokens;
CREATE POLICY "Admins read all push tokens"
  ON push_tokens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add to realtime publication (optional, not strictly required)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE push_tokens;
EXCEPTION WHEN duplicate_object THEN
  -- already a member
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Database webhook function — triggers on sales INSERT and calls Edge Function
-- ═══════════════════════════════════════════════════════════════════════════════

-- This function is called by the trigger below.
-- It makes an HTTP request to the Edge Function using pg_net (built into Supabase).
-- Replace <YOUR_SUPABASE_URL> and <YOUR_SERVICE_ROLE_KEY> before running.

CREATE OR REPLACE FUNCTION public.notify_sale_push()
RETURNS trigger AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
  payload JSONB;
BEGIN
  -- ⚠️ REPLACE these with your actual values:
  edge_url := '<YOUR_SUPABASE_URL>/functions/v1/push-sale-notification';
  service_key := '<YOUR_SERVICE_ROLE_KEY>';

  payload := jsonb_build_object(
    'sale_id', NEW.id,
    'customer_name', NEW.customer_name,
    'employee_id', NEW.employee_id,
    'employee_name', NEW.employee_name,
    'total', NEW.total
  );

  -- Use pg_net to make async HTTP request (non-blocking)
  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on sales INSERT
DROP TRIGGER IF EXISTS on_sale_insert_push ON sales;
CREATE TRIGGER on_sale_insert_push
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sale_push();
