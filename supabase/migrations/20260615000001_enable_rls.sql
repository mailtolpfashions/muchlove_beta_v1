-- ============================================================
-- Row Level Security (RLS) migration
-- Apply via: supabase db push  OR  Supabase Dashboard → SQL Editor
--
-- Design:
--   • Admins can read and write everything.
--   • Employees can read/write only their own HR rows
--     (attendance, leave_requests, permission_requests, salaries).
--   • Employees can read non-sensitive shared data
--     (customers, services, combos, offers, subscriptions, combos).
--   • Employees CANNOT read other employees' salaries or HR records.
--   • Push tokens are private to each user.
--   • App settings are admin-only write, readable by all authenticated users.
-- ============================================================

-- Helper: is the calling user an admin?
-- Cast both sides to text so this works whether profiles.id is uuid or text.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id::text = auth.uid()::text AND role = 'admin'
  )
$$;

-- ── Enable RLS on all tables ──────────────────────────────────────────────────

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE services               ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE upi_configs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_config           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance             ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings           ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "profiles_admin_all"    ON profiles;
DROP POLICY IF EXISTS "profiles_own_read"     ON profiles;
DROP POLICY IF EXISTS "profiles_own_update"   ON profiles;

CREATE POLICY "profiles_admin_all"
  ON profiles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_own_read"
  ON profiles FOR SELECT
  USING (id::text = auth.uid()::text);

CREATE POLICY "profiles_own_update"
  ON profiles FOR UPDATE
  USING (id::text = auth.uid()::text)
  WITH CHECK (id::text = auth.uid()::text);

-- ── customers ────────────────────────────────────────────────────────────────
-- All authenticated staff can read/write customers (needed for billing)

DROP POLICY IF EXISTS "customers_authenticated" ON customers;

CREATE POLICY "customers_authenticated"
  ON customers FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── services, subscription_plans, combos, combo_items, offers ────────────────
-- Read: any authenticated user. Write: admin only.

DROP POLICY IF EXISTS "services_read"    ON services;
DROP POLICY IF EXISTS "services_write"   ON services;

CREATE POLICY "services_read"  ON services  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "services_write" ON services  FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "subs_plans_read"  ON subscription_plans;
DROP POLICY IF EXISTS "subs_plans_write" ON subscription_plans;

CREATE POLICY "subs_plans_read"  ON subscription_plans FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "subs_plans_write" ON subscription_plans FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "combos_read"  ON combos;
DROP POLICY IF EXISTS "combos_write" ON combos;

CREATE POLICY "combos_read"  ON combos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "combos_write" ON combos FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "combo_items_read"  ON combo_items;
DROP POLICY IF EXISTS "combo_items_write" ON combo_items;

CREATE POLICY "combo_items_read"  ON combo_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "combo_items_write" ON combo_items FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "offers_read"  ON offers;
DROP POLICY IF EXISTS "offers_write" ON offers;

CREATE POLICY "offers_read"  ON offers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "offers_write" ON offers FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── customer_subscriptions ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "cs_authenticated" ON customer_subscriptions;

CREATE POLICY "cs_authenticated"
  ON customer_subscriptions FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── sales, sale_items, subscription_sale_items ───────────────────────────────
-- Employees can insert their own sales and read all sales.
-- Admins can do everything.

DROP POLICY IF EXISTS "sales_read"    ON sales;
DROP POLICY IF EXISTS "sales_insert"  ON sales;
DROP POLICY IF EXISTS "sales_admin"   ON sales;

CREATE POLICY "sales_read"   ON sales FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (employee_id::text = auth.uid()::text OR public.is_admin());
CREATE POLICY "sales_admin"  ON sales FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sale_items_authenticated"      ON sale_items;
DROP POLICY IF EXISTS "sub_sale_items_authenticated"  ON subscription_sale_items;

CREATE POLICY "sale_items_authenticated"
  ON sale_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "sub_sale_items_authenticated"
  ON subscription_sale_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── upi_configs ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "upi_read"  ON upi_configs;
DROP POLICY IF EXISTS "upi_write" ON upi_configs;

CREATE POLICY "upi_read"  ON upi_configs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "upi_write" ON upi_configs FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── salon_config ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "salon_config_read"  ON salon_config;
DROP POLICY IF EXISTS "salon_config_write" ON salon_config;

CREATE POLICY "salon_config_read"
  ON salon_config FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "salon_config_write"
  ON salon_config FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── HR tables: attendance, leave_requests, permission_requests ───────────────
-- Admins: full access. Employees: read/write their own rows only.

DROP POLICY IF EXISTS "attendance_admin"  ON attendance;
DROP POLICY IF EXISTS "attendance_own"    ON attendance;

CREATE POLICY "attendance_admin"
  ON attendance FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "attendance_own"
  ON attendance FOR ALL
  USING (employee_id::text = auth.uid()::text)
  WITH CHECK (employee_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "leave_requests_admin" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_own"   ON leave_requests;

CREATE POLICY "leave_requests_admin"
  ON leave_requests FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "leave_requests_own"
  ON leave_requests FOR ALL
  USING (employee_id::text = auth.uid()::text)
  WITH CHECK (employee_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "perm_requests_admin" ON permission_requests;
DROP POLICY IF EXISTS "perm_requests_own"   ON permission_requests;

CREATE POLICY "perm_requests_admin"
  ON permission_requests FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "perm_requests_own"
  ON permission_requests FOR ALL
  USING (employee_id::text = auth.uid()::text)
  WITH CHECK (employee_id::text = auth.uid()::text);

-- ── employee_salaries ─────────────────────────────────────────────────────────
-- Admins: full access. Employees: read their own salary only.

DROP POLICY IF EXISTS "salaries_admin" ON employee_salaries;
DROP POLICY IF EXISTS "salaries_own"   ON employee_salaries;

CREATE POLICY "salaries_admin"
  ON employee_salaries FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "salaries_own"
  ON employee_salaries FOR SELECT
  USING (employee_id::text = auth.uid()::text);

-- ── expense_categories, expenses ─────────────────────────────────────────────

DROP POLICY IF EXISTS "exp_cat_read"  ON expense_categories;
DROP POLICY IF EXISTS "exp_cat_write" ON expense_categories;

CREATE POLICY "exp_cat_read"  ON expense_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "exp_cat_write" ON expense_categories FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "expenses_read"  ON expenses;
DROP POLICY IF EXISTS "expenses_write" ON expenses;

CREATE POLICY "expenses_read"  ON expenses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_write" ON expenses FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── push_tokens ───────────────────────────────────────────────────────────────
-- Each user manages only their own tokens.

DROP POLICY IF EXISTS "push_tokens_own"   ON push_tokens;
DROP POLICY IF EXISTS "push_tokens_admin" ON push_tokens;

CREATE POLICY "push_tokens_own"
  ON push_tokens FOR ALL
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "push_tokens_admin"
  ON push_tokens FOR SELECT
  USING (public.is_admin());

-- ── app_settings ──────────────────────────────────────────────────────────────
-- Read: any authenticated user. Write: admin only.

DROP POLICY IF EXISTS "app_settings_read"  ON app_settings;
DROP POLICY IF EXISTS "app_settings_write" ON app_settings;

CREATE POLICY "app_settings_read"
  ON app_settings FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "app_settings_write"
  ON app_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
