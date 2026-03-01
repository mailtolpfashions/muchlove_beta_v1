-- ============================================================
-- Offline Sales Toggle — Migration
-- Run in: Supabase SQL Editor
-- ============================================================

-- 1. App Settings table (key-value admin config)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'true'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read settings
CREATE POLICY "Settings readable by authenticated"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete settings
CREATE POLICY "Admins can manage settings"
  ON app_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Seed default value (offline sales enabled by default)
INSERT INTO app_settings (key, value)
VALUES ('offline_sales_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Enable Realtime on the table so clients get instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
