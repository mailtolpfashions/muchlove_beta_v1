-- Google Contacts Sync — Database Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run)
--
-- Prerequisites:
--   1. pg_net extension enabled (Dashboard → Database → Extensions → pg_net → Enable)
--   2. Edge Function deployed: supabase functions deploy sync-google-contact
--   3. Google secrets set:
--        supabase secrets set GOOGLE_CLIENT_ID="..."
--        supabase secrets set GOOGLE_CLIENT_SECRET="..."
--        supabase secrets set GOOGLE_REFRESH_TOKEN="..."

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Add tracking column to customers table
-- ═══════════════════════════════════════════════════════════════════════════════

-- Stores the Google People API resource name (e.g. "people/c12345678")
-- Used to update existing contacts and prevent duplicates
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS google_contact_resource_name TEXT DEFAULT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Trigger function — calls sync-google-contact Edge Function via pg_net
-- ═══════════════════════════════════════════════════════════════════════════════

-- This function fires on both INSERT and UPDATE of the customers table.
-- It sends an async HTTP request to the Edge Function (non-blocking).
-- ⚠️ REPLACE <YOUR_SUPABASE_URL> and <YOUR_SERVICE_ROLE_KEY> before running.

CREATE OR REPLACE FUNCTION public.notify_google_contact_sync()
RETURNS trigger AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
  payload JSONB;
BEGIN
  -- ⚠️ REPLACE these with your actual values:
  edge_url := '<YOUR_SUPABASE_URL>/functions/v1/sync-google-contact';
  service_key := '<YOUR_SERVICE_ROLE_KEY>';

  -- Build payload with customer data and operation type
  payload := jsonb_build_object(
    'operation', TG_OP,
    'customer_id', NEW.id,
    'customer_name', NEW.name,
    'customer_mobile', NEW.mobile,
    'customer_alt_number', NEW.alt_number,
    'customer_location', NEW.location,
    'is_student', COALESCE(NEW.is_student, false)
  );

  -- On UPDATE, include old mobile and existing resource name for contact lookup
  IF TG_OP = 'UPDATE' THEN
    payload := payload || jsonb_build_object(
      'old_mobile', OLD.mobile,
      'google_contact_resource_name', OLD.google_contact_resource_name
    );
  END IF;

  -- Use pg_net to make async HTTP request (non-blocking, won't slow down INSERT/UPDATE)
  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Triggers on customers table
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigger on INSERT — sync new customers to Google Contacts
DROP TRIGGER IF EXISTS on_customer_insert_google_sync ON customers;
CREATE TRIGGER on_customer_insert_google_sync
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_google_contact_sync();

-- Trigger on UPDATE — sync changes only when relevant fields change
-- (name, mobile, alt_number, location, is_student)
DROP TRIGGER IF EXISTS on_customer_update_google_sync ON customers;
CREATE TRIGGER on_customer_update_google_sync
  AFTER UPDATE ON customers
  FOR EACH ROW
  WHEN (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.mobile IS DISTINCT FROM NEW.mobile OR
    OLD.alt_number IS DISTINCT FROM NEW.alt_number OR
    OLD.location IS DISTINCT FROM NEW.location OR
    OLD.is_student IS DISTINCT FROM NEW.is_student
  )
  EXECUTE FUNCTION public.notify_google_contact_sync();
