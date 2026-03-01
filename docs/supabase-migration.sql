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
  discount_percent NUMERIC NOT NULL DEFAULT 30,
  max_cart_value NUMERIC NOT NULL DEFAULT 2000,
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
  applies_to TEXT NOT NULL DEFAULT 'both' CHECK (applies_to IN ('services', 'subscriptions', 'both')),
  student_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6b. Combos
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS combos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  combo_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS combo_items (
  id TEXT PRIMARY KEY,
  combo_id TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('service', 'product')),
  original_price NUMERIC NOT NULL
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
  original_price NUMERIC,
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

-- Combos
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on combos" ON combos;
CREATE POLICY "Authenticated full access on combos"
  ON combos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Combo Items
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated full access on combo_items" ON combo_items;
CREATE POLICY "Authenticated full access on combo_items"
  ON combo_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. Enable Supabase Realtime for all tables (live updates without refresh)
--     (safe: drops then re-adds each table to avoid "already member" errors)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'profiles','customers','services','subscription_plans',
    'customer_subscriptions','offers','sales','sale_items',
    'subscription_sale_items','upi_configs','combos','combo_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    EXCEPTION WHEN duplicate_object THEN
      -- already a member, skip
    END;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add discount fields to subscription_plans (for existing databases)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS discount_percent NUMERIC NOT NULL DEFAULT 30;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_cart_value NUMERIC NOT NULL DEFAULT 2000;

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Fix detect_reinstall() false-positive on innocent reinstalls
-- The old trigger counted shadows as "unsynced" based solely on full_sale_synced.
-- But for online sales, the shadow is inserted AFTER the sale, so the
-- mark_shadow_synced trigger never fires. All online shadows stay unsynced.
-- Fix: also check if the sale actually exists in the sales table.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.detect_reinstall()
RETURNS trigger AS $$
DECLARE
  prev_install_id TEXT;
  unsynced_count INTEGER;
  edge_url TEXT;
  service_key TEXT;
  user_name TEXT;
  fraud_id TEXT;
BEGIN
  -- Get the previous heartbeat's install_id for this user
  SELECT h.install_id INTO prev_install_id
  FROM device_heartbeats h
  WHERE h.user_id = NEW.user_id
    AND h.id != NEW.id
  ORDER BY h.created_at DESC
  LIMIT 1;

  -- No previous heartbeat = first time, skip
  IF prev_install_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Same install_id = no reinstall, skip
  IF prev_install_id = NEW.install_id THEN
    RETURN NEW;
  END IF;

  -- Install ID changed! Check for truly unsynced sale shadows from old install.
  -- A shadow is only suspicious if full_sale_synced is false AND the sale
  -- doesn't actually exist in the sales table (handles timing gaps where
  -- the shadow was sent after the sale INSERT so the trigger missed it).
  SELECT COUNT(*) INTO unsynced_count
  FROM sale_shadows s
  WHERE s.user_id = NEW.user_id
    AND s.install_id = prev_install_id
    AND s.full_sale_synced = false
    AND NOT EXISTS (SELECT 1 FROM sales WHERE sales.id = s.sale_id);

  -- If there are truly unsynced shadows → fraud detected
  IF unsynced_count > 0 THEN
    -- Generate a fraud log ID
    fraud_id := 'fraud_' || gen_random_uuid()::text;

    -- Get user name
    SELECT p.name INTO user_name
    FROM profiles p WHERE p.id = NEW.user_id;

    -- Log the fraud event
    INSERT INTO fraud_logs (id, user_id, reason, details, auto_locked)
    VALUES (
      fraud_id,
      NEW.user_id,
      'reinstall_unsynced_sales',
      jsonb_build_object(
        'old_install_id', prev_install_id,
        'new_install_id', NEW.install_id,
        'unsynced_shadow_count', unsynced_count,
        'user_name', user_name
      ),
      true
    );

    -- Auto-lock the account
    UPDATE profiles SET approved = false WHERE id = NEW.user_id;

    -- Call fraud alert Edge Function (async, non-blocking)
    -- ⚠️ REPLACE these with your actual values:
    edge_url := 'ddaptndonmardgqyemah/functions/v1/push-fraud-alert';
    service_key := 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE';

    BEGIN
      PERFORM net.http_post(
        url := edge_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'user_id', NEW.user_id,
          'user_name', user_name,
          'reason', 'reinstall_unsynced_sales',
          'unsynced_count', unsynced_count,
          'old_install_id', prev_install_id,
          'new_install_id', NEW.install_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSE
    -- Reinstall detected but all shadows are accounted for.
    -- Also mark any remaining false-unsynced shadows as synced (cleanup).
    UPDATE sale_shadows
    SET full_sale_synced = true
    WHERE user_id = NEW.user_id
      AND install_id = prev_install_id
      AND full_sale_synced = false
      AND EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_shadows.sale_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
