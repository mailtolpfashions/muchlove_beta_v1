-- ============================================================
-- Sales Incentive Migration
-- Adds incentive_percent column to employee_salaries table
-- Run this AFTER the existing attendance/salary migrations
-- ============================================================

-- Add incentive percentage column (0 = no incentive)
ALTER TABLE employee_salaries
ADD COLUMN IF NOT EXISTS incentive_percent NUMERIC NOT NULL DEFAULT 0;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'employee_salaries'
ORDER BY ordinal_position;
