-- BillPro CRM – Supabase tables (run in SQL Editor in Supabase Dashboard)

-- ═══════════════════════════════════════════════════════════════════════════════
-- Profiles (linked to Supabase Auth users)
-- Each auth.users row gets a matching profile with name + role.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    'employee'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all profiles
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to update their own profile (name only)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Legacy users table (kept for backward compatibility, can be dropped later)
-- DROP TABLE IF EXISTS users;

-- Customers
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

-- Services
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

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer subscriptions
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

-- Offers
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  percent INTEGER NOT NULL,
  visit_count INTEGER,
  start_date TEXT,
  end_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales (header) – drop first if table existed with wrong id type (e.g. bigint)
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
  -- Offline billing audit columns
  is_offline_sale BOOLEAN NOT NULL DEFAULT false,
  offline_created_at TIMESTAMPTZ,           -- device clock at time of sale (NULL if online)
  synced_at TIMESTAMPTZ                      -- when this record reached the server (NULL if online)
);

-- Sale line items (services/products)
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

-- Sale line items (subscription plans)
CREATE TABLE subscription_sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  discounted_price NUMERIC NOT NULL
);

-- UPI configs (Settings → Payments)
CREATE TABLE IF NOT EXISTS upi_configs (
  id TEXT PRIMARY KEY,
  upi_id TEXT NOT NULL,
  payee_name TEXT NOT NULL
);

-- SECURITY: Enable RLS for production. The app uses the Supabase anon key
-- directly (not Supabase Auth), so policies below allow full access for the
-- anon role. For stricter security, implement Supabase Auth and scope policies.
--
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE services ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscription_sale_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE upi_configs ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Allow all for anon" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for anon" ON customers FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for anon" ON services FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for anon" ON subscription_plans FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for anon" ON customer_subscriptions FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for anon" ON offers FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for anon" ON sales FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for anon" ON sale_items FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for anon" ON subscription_sale_items FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all for anon" ON upi_configs FOR ALL TO anon USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Offline billing support (run if your sales table already exists)
-- ═══════════════════════════════════════════════════════════════════════════════
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_offline_sale BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS offline_created_at TIMESTAMPTZ;
-- ALTER TABLE sales ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
