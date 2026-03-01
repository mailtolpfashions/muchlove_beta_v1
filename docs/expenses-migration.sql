-- ============================================================
-- Expense Tracking — Migration
-- Run in: Supabase SQL Editor
-- ============================================================

-- 1. Expense Categories (admin-managed, fully custom)
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories readable by authenticated"
  ON expense_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage categories"
  ON expense_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Expenses (individual entries)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT DEFAULT '',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expenses readable by authenticated"
  ON expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage expenses"
  ON expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Index for fast monthly queries
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id);
