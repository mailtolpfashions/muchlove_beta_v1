-- Salon Config – Supabase Migration
-- Run this in SQL Editor in Supabase Dashboard
-- This creates a single-row config table for admin-editable attendance/salary settings.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Create salon_config table
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS salon_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_off_day INT NOT NULL DEFAULT 2,          -- 0=Sun,1=Mon,2=Tue…
  shift_start_hour INT NOT NULL DEFAULT 9,        -- 9:00 AM
  shift_start_min INT NOT NULL DEFAULT 0,
  shift_end_hour INT NOT NULL DEFAULT 20,         -- 8:00 PM
  shift_end_min INT NOT NULL DEFAULT 0,
  working_hours_per_day NUMERIC(4,1) NOT NULL DEFAULT 9,   -- Net hours (shift minus breaks)
  grace_minutes INT NOT NULL DEFAULT 15,          -- Late grace period
  free_permission_hours NUMERIC(4,1) NOT NULL DEFAULT 2,   -- Free monthly permission hours
  monthly_leave_allowance NUMERIC(4,1) NOT NULL DEFAULT 0,  -- Paid leave days earned per month (0=disabled)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Insert default row (only if table is empty)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO salon_config (
  weekly_off_day,
  shift_start_hour,
  shift_start_min,
  shift_end_hour,
  shift_end_min,
  working_hours_per_day,
  grace_minutes,
  free_permission_hours
)
SELECT 2, 9, 0, 20, 0, 9, 15, 2
WHERE NOT EXISTS (SELECT 1 FROM salon_config);

-- If table already exists, add column for monthly leave allowance
ALTER TABLE salon_config
  ADD COLUMN IF NOT EXISTS monthly_leave_allowance NUMERIC(4,1) NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RLS policies
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE salon_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read the config
CREATE POLICY "salon_config_read" ON salon_config
  FOR SELECT USING (true);

-- Only admin can update
CREATE POLICY "salon_config_update" ON salon_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Prevent inserting extra rows (should only ever be 1 row)
CREATE POLICY "salon_config_insert" ON salon_config
  FOR INSERT WITH CHECK (
    NOT EXISTS (SELECT 1 FROM salon_config)
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Prevent deletion
CREATE POLICY "salon_config_no_delete" ON salon_config
  FOR DELETE USING (false);
