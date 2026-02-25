# Supabase Setup for BillPro CRM

To connect BillPro CRM to Supabase for online sync, you need the following from your Supabase project:

## 1. Project URL

- Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
- **Settings** → **API** → **Project URL**
- Example: `https://xxxxxxxxxxxx.supabase.co`

## 2. Anon Key (use Legacy JWT)

- **Settings** → **API** → open the **"Connect to your project"** / **API Keys** view.
- Use the **"Anon Key (Legacy)"** – the long token starting with `eyJ...` (JWT).
- Do **not** use the "Publishable Key" (`sb_publishable_...`) for `EXPO_PUBLIC_SUPABASE_ANON_KEY`; the app expects the legacy anon JWT.
- Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 3. Service Role Key (Optional – server only)

- Use for backend/Edge Functions or admin operations
- **Never** expose this in the mobile app

## 4. Environment Variables

Create a `.env` (or `.env.local`) in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Expo requires `EXPO_PUBLIC_` for variables used in the app.

## 5. Create database tables

In Supabase Dashboard → **SQL Editor**, run the contents of **`docs/supabase-migration.sql`**. This creates all required tables. On first launch the app seeds default users (admin / admin123, employee / emp123), services, and subscription plans if the `users` table is empty.

Suggested tables (created by the migration):

| Table              | Purpose                    |
|--------------------|----------------------------|
| `users`            | Admin & staff accounts     |
| `customers`        | Customer records           |
| `services`         | Services & products        |
| `subscriptions`    | Subscription plans         |
| `sales`            | Sales/transactions         |
| `customer_subscriptions` | Assigned plans     |
| `offers`           | Visit & promo offers       |

Each table should have:
- `id` (UUID, primary key)
- `created_at` (timestamptz)
- `updated_at` (timestamptz) for sync
- Columns matching your local TypeScript types

## 6. Row Level Security (RLS)

Enable RLS for each table and define policies so only your app’s users can read/write their own data.

## 7. Run the app

Run the SQL in **`docs/supabase-migration.sql`** in Supabase SQL Editor first. Then ensure `.env` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and run `npx expo start`. All data is now stored in Supabase.
