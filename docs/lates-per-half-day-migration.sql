-- Migration: Add lates_per_half_day to salon_config
-- This column controls how many late check-ins equal a 0.5 day salary deduction.
-- Default: 3 (i.e. every 3 lates = half-day deduction)

ALTER TABLE salon_config
  ADD COLUMN lates_per_half_day INTEGER NOT NULL DEFAULT 3;
