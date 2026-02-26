-- BillPro CRM – Supabase Migration (run ALL in SQL Editor in Supabase Dashboard)
-- Copy this entire file → paste into SQL Editor → click Run

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Profiles (linked to Supabase Auth users)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    'employee',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can delete any profile" ON profiles;
CREATE POLICY "Admins can delete any profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Customers
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL UNIQUE,
  alt_number TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  is_student BOOLEAN NOT NULL DEFAULT false,
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Services
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  price NUMERIC NOT NULL,
  kind TEXT NOT NULL DEFAULT 'service' CHECK (kind IN ('service', 'product')),
  mrp NUMERIC,
  offer_price NUMERIC,
  payment_method TEXT CHECK (payment_method IN ('cash', 'gpay')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Subscription Plans
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Customer Subscriptions
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  plan_duration_months INTEGER NOT NULL,
  plan_price NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  start_date TIMESTAMPTZ NOT NULL,
  assigned_by_user_id TEXT NOT NULL,
  assigned_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Offers
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  percent INTEGER NOT NULL,
  visit_count INTEGER,
  start_date TEXT,
  end_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Sales + Line Items
--    (drops and recreates to ensure correct schema)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS subscription_sale_items;
DROP TABLE IF EXISTS sale_items;
DROP TABLE IF EXISTS sales;

CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('service', 'subscription', 'other')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'gpay')),
  subtotal NUMERIC NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_offline_sale BOOLEAN NOT NULL DEFAULT false,
  offline_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);

CREATE TABLE sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  service_id TEXT,
  service_name TEXT NOT NULL,
  service_code TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'service' CHECK (kind IN ('service', 'product'))
);

CREATE TABLE subscription_sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  discounted_price NUMERIC NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. UPI Configs
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS upi_configs (
  id TEXT PRIMARY KEY,
  upi_id TEXT NOT NULL,
  payee_name TEXT NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. RLS Policies for all tables (authenticated users get full access)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on customers" ON customers;
CREATE POLICY "Authenticated full access on customers"
  ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on services" ON services;
CREATE POLICY "Authenticated full access on services"
  ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Subscription Plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on subscription_plans" ON subscription_plans;
CREATE POLICY "Authenticated full access on subscription_plans"
  ON subscription_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Customer Subscriptions
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on customer_subscriptions" ON customer_subscriptions;
CREATE POLICY "Authenticated full access on customer_subscriptions"
  ON customer_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Offers
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on offers" ON offers;
CREATE POLICY "Authenticated full access on offers"
  ON offers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on sales" ON sales;
CREATE POLICY "Authenticated full access on sales"
  ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sale Items
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on sale_items" ON sale_items;
CREATE POLICY "Authenticated full access on sale_items"
  ON sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Subscription Sale Items
ALTER TABLE subscription_sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on subscription_sale_items" ON subscription_sale_items;
CREATE POLICY "Authenticated full access on subscription_sale_items"
  ON subscription_sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- UPI Configs
ALTER TABLE upi_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on upi_configs" ON upi_configs;
CREATE POLICY "Authenticated full access on upi_configs"
  ON upi_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. Enable Supabase Realtime for all tables (live updates without refresh)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE services;
ALTER PUBLICATION supabase_realtime ADD TABLE subscription_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE offers;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE sale_items;
ALTER PUBLICATION supabase_realtime ADD TABLE subscription_sale_items;
ALTER PUBLICATION supabase_realtime ADD TABLE upi_configs;
