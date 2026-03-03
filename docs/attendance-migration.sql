-- ============================================================
-- Attendance, Leave/Permission Requests & Employee Salaries
-- Run this in your Supabase SQL editor after the base migration.
-- ============================================================

-- 1. Attendance ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance (
  id            TEXT PRIMARY KEY,
  employee_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  check_in      TIMESTAMPTZ,
  check_out     TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'present'
                  CHECK (status IN ('present', 'absent', 'half_day', 'permission')),
  notes         TEXT,
  marked_by     UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Employees can read their own attendance
CREATE POLICY "Employees read own attendance"
  ON attendance FOR SELECT
  USING (employee_id = auth.uid());

-- Employees can insert their own attendance (check-in)
CREATE POLICY "Employees insert own attendance"
  ON attendance FOR INSERT
  WITH CHECK (employee_id = auth.uid());

-- Employees can update their own attendance (check-out)
CREATE POLICY "Employees update own attendance"
  ON attendance FOR UPDATE
  USING (employee_id = auth.uid());

-- Admins full access
CREATE POLICY "Admins full access attendance"
  ON attendance FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Leave Requests ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leave_requests (
  id            TEXT PRIMARY KEY,
  employee_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'leave'
                  CHECK (type IN ('leave', 'compensation')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES profiles(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees read own leave requests"
  ON leave_requests FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Employees insert own leave requests"
  ON leave_requests FOR INSERT
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Admins full access leave requests"
  ON leave_requests FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Permission Requests ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS permission_requests (
  id            TEXT PRIMARY KEY,
  employee_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  from_time     TIME NOT NULL,
  to_time       TIME NOT NULL,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES profiles(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE permission_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees read own permission requests"
  ON permission_requests FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Employees insert own permission requests"
  ON permission_requests FOR INSERT
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Admins full access permission requests"
  ON permission_requests FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Employee Salaries ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_salaries (
  id            TEXT PRIMARY KEY,
  employee_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  base_salary   NUMERIC NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, effective_from)
);

ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;

-- Employees can read their own salary
CREATE POLICY "Employees read own salary"
  ON employee_salaries FOR SELECT
  USING (employee_id = auth.uid());

-- Admins full access
CREATE POLICY "Admins full access salaries"
  ON employee_salaries FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
