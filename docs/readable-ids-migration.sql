-- ============================================================
-- Readable IDs & Denormalized Names Migration
-- ============================================================
-- This migration adds employee_name columns to attendance/HR tables
-- so records are identifiable when browsing Supabase directly.
--
-- New records will also use short prefixed IDs (e.g. ATT-a3x7k2)
-- instead of the old lxyz1234_abc12345 format. Both formats are
-- valid TEXT and coexist — no need to migrate existing IDs.
-- ============================================================

-- 1. Add employee_name column to attendance tables
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS employee_name TEXT NOT NULL DEFAULT '';
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS employee_name TEXT NOT NULL DEFAULT '';
ALTER TABLE permission_requests ADD COLUMN IF NOT EXISTS employee_name TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_salaries ADD COLUMN IF NOT EXISTS employee_name TEXT NOT NULL DEFAULT '';

-- 2. Backfill existing rows with names from profiles
UPDATE attendance SET employee_name = p.name
FROM profiles p WHERE attendance.employee_id = p.id AND attendance.employee_name = '';

UPDATE leave_requests SET employee_name = p.name
FROM profiles p WHERE leave_requests.employee_id = p.id AND leave_requests.employee_name = '';

UPDATE permission_requests SET employee_name = p.name
FROM profiles p WHERE permission_requests.employee_id = p.id AND permission_requests.employee_name = '';

UPDATE employee_salaries SET employee_name = p.name
FROM profiles p WHERE employee_salaries.employee_id = p.id AND employee_salaries.employee_name = '';

-- 3. Enable realtime for updated tables (skip if already added)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'attendance') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'leave_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'permission_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE permission_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'employee_salaries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE employee_salaries;
  END IF;
END $$;
