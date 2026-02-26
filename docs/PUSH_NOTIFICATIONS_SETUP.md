# Push Notifications Setup Guide

This guide enables **background push notifications** so admins get notified of new sales even when the app is closed.

## How It Works

```
Sale Created → DB Trigger → Edge Function → Expo Push API → Device Notification
```

1. When a sale is inserted, a PostgreSQL trigger calls a Supabase Edge Function
2. The Edge Function queries `push_tokens` table for all admin device tokens
3. It sends push notifications via Expo's Push API (handles FCM/APNs automatically)
4. Admin devices receive the notification even when the app is closed

---

## Step 1: Run the Migration SQL

1. Go to **Supabase Dashboard** → **SQL Editor** → **New Query**
2. Copy the contents of `docs/push-notifications-migration.sql`
3. **Before running**, replace these placeholders in the SQL:
   - `<YOUR_SUPABASE_URL>` → Your Supabase project URL (e.g., `https://ddaptndonmardgqyemah.supabase.co`)
   - `<YOUR_SERVICE_ROLE_KEY>` → Your Supabase service_role key (from Dashboard → Settings → API → `service_role` key)
4. Click **Run**

This creates:
- `push_tokens` table (stores device tokens)
- `notify_sale_push()` trigger function
- `on_sale_insert_push` trigger on the `sales` table

---

## Step 2: Enable pg_net Extension

The trigger uses `pg_net` to make HTTP requests to the Edge Function.

1. Go to **Supabase Dashboard** → **Database** → **Extensions**
2. Search for `pg_net`
3. Enable it (it may already be enabled)

---

## Step 3: Deploy the Edge Function

### Prerequisites
- Install Supabase CLI: `npm install -g supabase`
- Login: `supabase login`
- Link your project: `supabase link --project-ref ddaptndonmardgqyemah`

### Deploy
```bash
supabase functions deploy push-sale-notification --no-verify-jwt
```

> The `--no-verify-jwt` flag is needed because the trigger calls the function with the service_role key directly, not a user JWT.

### Verify
You can test the function manually:
```bash
curl -X POST https://ddaptndonmardgqyemah.supabase.co/functions/v1/push-sale-notification \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sale_id":"test","customer_name":"Test","employee_id":"fake-id","employee_name":"Test","total":100}'
```

---

## Step 4: Verify It Works

1. Open the app on **Device A** (admin account) — the push token is automatically registered on login
2. Close/background the app on Device A
3. On **Device B**, make a sale (as employee or another admin)
4. Device A should receive a push notification: "💰 New Sale Recorded"

---

## Troubleshooting

### No notification received?

1. **Check push_tokens table**: Go to Supabase Dashboard → Table Editor → `push_tokens`. Verify tokens exist for the admin user.
2. **Check Edge Function logs**: Dashboard → Edge Functions → `push-sale-notification` → Logs
3. **Check trigger exists**: Run in SQL Editor:
   ```sql
   SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_sale_insert_push';
   ```
4. **Test Edge Function manually** with the curl command above
5. **Ensure permissions are granted**: The app requests notification permissions on login. Check device Settings → App → Notifications.

### Token format
Expo push tokens look like: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`
If you see tokens in a different format, the EAS project ID may not be configured correctly.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ App (React Native)                                       │
│                                                          │
│  Login → registerForNotifications()                      │
│        → registerPushToken(userId)                       │
│          └── saves ExponentPushToken to push_tokens      │
│                                                          │
│  Logout → unregisterPushToken(userId)                    │
│          └── deletes tokens from push_tokens             │
│                                                          │
│  Foreground: useRealtimeSync still fires local           │
│              notifications (immediate, no server needed) │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Supabase (Server-side)                                   │
│                                                          │
│  sales INSERT                                            │
│    → trigger: on_sale_insert_push                        │
│      → function: notify_sale_push()                      │
│        → pg_net HTTP POST to Edge Function               │
│                                                          │
│  Edge Function: push-sale-notification                   │
│    → queries profiles (role='admin', id≠employee_id)     │
│    → queries push_tokens for those admin IDs             │
│    → POST to https://exp.host/--/api/v2/push/send       │
│      → Expo handles FCM/APNs delivery                   │
└──────────────────────────────────────────────────────────┘
```
