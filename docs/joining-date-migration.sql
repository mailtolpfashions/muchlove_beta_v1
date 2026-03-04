-- ============================================================
-- Add joining_date column to profiles table
-- Run this in your Supabase SQL editor.
-- ============================================================

-- Add joining_date column (defaults to created_at for existing rows)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS joining_date DATE;

-- Backfill existing rows: set joining_date = created_at::date
UPDATE profiles
SET joining_date = created_at::date
WHERE joining_date IS NULL;

-- Set a default for future rows
ALTER TABLE profiles
  ALTER COLUMN joining_date SET DEFAULT CURRENT_DATE;
