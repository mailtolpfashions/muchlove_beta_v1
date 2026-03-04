-- Request Push Notifications — DB triggers for leave_requests & permission_requests
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run)
--
-- ⚠️ REPLACE <YOUR_SUPABASE_URL> and <YOUR_SERVICE_ROLE_KEY> with your actual values
-- (same ones used in push-notifications-migration.sql)
--
-- Prerequisites:
--   1. pg_net extension enabled (should already be if sale notifications work)
--   2. Edge Function deployed:
--      supabase functions deploy push-request-notification --no-verify-jwt

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Trigger function: Employee submits a leave request → notify admins
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_leave_request_push()
RETURNS trigger AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
  payload JSONB;
  emp_name TEXT;
BEGIN
  -- ⚠️ REPLACE these with your actual values:
  edge_url := '<YOUR_SUPABASE_URL>/functions/v1/push-request-notification';
  service_key := '<YOUR_SERVICE_ROLE_KEY>';

  -- Get employee name (fallback to employee_name column if present)
  emp_name := COALESCE(NEW.employee_name, '');
  IF emp_name = '' THEN
    SELECT name INTO emp_name FROM profiles WHERE id = NEW.employee_id;
  END IF;

  payload := jsonb_build_object(
    'event', 'new_request',
    'employee_id', NEW.employee_id,
    'employee_name', COALESCE(emp_name, 'Employee'),
    'request_type', 'leave',
    'leave_type', NEW.type,
    'reason', COALESCE(NEW.reason, '')
  );

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

-- Trigger on leave_requests INSERT
DROP TRIGGER IF EXISTS on_leave_request_insert_push ON leave_requests;
CREATE TRIGGER on_leave_request_insert_push
  AFTER INSERT ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_leave_request_push();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Trigger function: Admin acts on a leave request → notify employee
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_leave_action_push()
RETURNS trigger AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
  payload JSONB;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- ⚠️ REPLACE these with your actual values:
  edge_url := '<YOUR_SUPABASE_URL>/functions/v1/push-request-notification';
  service_key := '<YOUR_SERVICE_ROLE_KEY>';

  payload := jsonb_build_object(
    'event', 'request_action',
    'employee_id', NEW.employee_id,
    'action', NEW.status,
    'old_status', OLD.status,
    'reviewed_by', NEW.reviewed_by
  );

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

-- Trigger on leave_requests UPDATE
DROP TRIGGER IF EXISTS on_leave_request_update_push ON leave_requests;
CREATE TRIGGER on_leave_request_update_push
  AFTER UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_leave_action_push();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Trigger function: Employee submits a permission request → notify admins
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_permission_request_push()
RETURNS trigger AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
  payload JSONB;
  emp_name TEXT;
BEGIN
  -- ⚠️ REPLACE these with your actual values:
  edge_url := '<YOUR_SUPABASE_URL>/functions/v1/push-request-notification';
  service_key := '<YOUR_SERVICE_ROLE_KEY>';

  emp_name := COALESCE(NEW.employee_name, '');
  IF emp_name = '' THEN
    SELECT name INTO emp_name FROM profiles WHERE id = NEW.employee_id;
  END IF;

  payload := jsonb_build_object(
    'event', 'new_request',
    'employee_id', NEW.employee_id,
    'employee_name', COALESCE(emp_name, 'Employee'),
    'request_type', 'permission',
    'reason', COALESCE(NEW.reason, '')
  );

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

-- Trigger on permission_requests INSERT
DROP TRIGGER IF EXISTS on_permission_request_insert_push ON permission_requests;
CREATE TRIGGER on_permission_request_insert_push
  AFTER INSERT ON permission_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_permission_request_push();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Trigger function: Admin acts on a permission request → notify employee
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_permission_action_push()
RETURNS trigger AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
  payload JSONB;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- ⚠️ REPLACE these with your actual values:
  edge_url := '<YOUR_SUPABASE_URL>/functions/v1/push-request-notification';
  service_key := '<YOUR_SERVICE_ROLE_KEY>';

  payload := jsonb_build_object(
    'event', 'request_action',
    'employee_id', NEW.employee_id,
    'action', NEW.status,
    'old_status', OLD.status,
    'reviewed_by', NEW.reviewed_by
  );

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

-- Trigger on permission_requests UPDATE
DROP TRIGGER IF EXISTS on_permission_request_update_push ON permission_requests;
CREATE TRIGGER on_permission_request_update_push
  AFTER UPDATE ON permission_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_permission_action_push();
