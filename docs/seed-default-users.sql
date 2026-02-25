-- Run this in Supabase SQL Editor if the app did not seed users (e.g. RLS blocking).
-- Log in with: admin / admin123  or  employee / emp123

INSERT INTO users (id, username, password_hash, name, role, created_at) VALUES
  ('seed_admin_1', 'admin', 'veeet2c8e6', 'Administrator', 'admin', now()),
  ('seed_employee_1', 'employee', 'vs6h1w80ks', 'Staff Member', 'employee', now())
ON CONFLICT (username) DO NOTHING;
