# Much Love — Beauty Salon CRM & Billing App

> **Version**: 1.1.5  
> **Author**: Mugundan M P  
> **Business**: Much Love Beauty Salon, Kundrathur, Chennai - 69  
> **Business Contact**: 9092890546

A full-featured, offline-first CRM and billing application for beauty salons built with React Native (Expo) and Supabase. Supports multi-role access (admin/employee), real-time sync, tamper-proof offline sales, subscription management, combo pricing, offer engine, UPI QR payments, PDF invoicing, and push notifications.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Identity & Configuration](#2-project-identity--configuration)
3. [Project Structure](#3-project-structure)
4. [Type System](#4-type-system)
5. [Database Schema](#5-database-schema)
6. [Provider Architecture](#6-provider-architecture)
7. [Hooks](#7-hooks)
8. [Utilities](#8-utilities)
9. [Navigation & Screens](#9-navigation--screens)
10. [Components](#10-components)
11. [Business Rules](#11-business-rules)
12. [State Management Architecture](#12-state-management-architecture)
13. [Offline Sync Architecture](#13-offline-sync-architecture)
14. [Constants & Theming](#14-constants--theming)
15. [Build & Deploy](#15-build--deploy)
16. [Environment Setup](#16-environment-setup)
17. [Roadmap](#17-roadmap)

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React Native | 0.81.5 |
| Platform | Expo SDK | ~54.0.27 |
| Router | expo-router | ~6.0.17 |
| Language | TypeScript | 5.9.2 (strict mode) |
| Backend | Supabase | ^2.97.0 |
| Auth | Supabase Auth | email/password + admin approval system |
| State | TanStack React Query | ^5.83.0 |
| Offline Cache | AsyncStorage | ^2.1.2 |
| Network | @react-native-community/netinfo | ^11.4.1 |
| Charts | react-native-chart-kit | ^6.12.0 |
| QR Codes | react-native-qrcode-svg | ^6.3.14 |
| Icons | lucide-react-native | ^0.511.0 |
| Crypto | expo-crypto | ~14.0.3 |
| Notifications | expo-notifications | ~0.32.3 |
| Printing | expo-print | ~14.0.6 |
| Sharing | expo-sharing | ~13.0.5 |
| File System | expo-file-system | ~19.0.21 |
| Gradient | expo-linear-gradient | ~14.0.3 |
| Dates | date-fns | ^4.1.0 |
| Gestures | react-native-gesture-handler | ~2.25.0 |
| SVG | react-native-svg | 15.11.2 |
| Build | EAS Build | CLI >=18.0.3 |
| Context | @nkzw/create-context-hook | (used in all providers) |
| Edge Functions | Supabase Edge Functions (Deno) | Server-side push notifications |
| Push Service | Expo Push API | `exp.host/--/api/v2/push/send` (free) |

---

## 2. Project Identity & Configuration

### app.json

| Field | Value |
|---|---|
| App Name | Much Love |
| Slug | offline-crm-billing-app |
| Deep Link Scheme | much-love-billing-app |
| Orientation | portrait (locked) |
| iOS Bundle ID | app.muchlove.billing |
| Android Package | app.muchlove.billing |
| Entry Point | expo-router/entry |
| EAS Project ID | 627cb85d-ae16-4fc0-ad2d-b1aefd8aad80 |
| Google Services File | `./google-services.json` (Firebase/FCM) |
| Plugins | expo-router, expo-font (Billabong), expo-web-browser, expo-notifications (icon + color), expo-dev-client |

### eas.json (Build Profiles)

| Profile | Distribution | Features |
|---|---|---|
| development | internal | developmentClient: true |
| preview | internal | env vars EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY |
| production | (store) | autoIncrement: true + same env vars |

`appVersionSource: "remote"` — EAS manages version numbering.

### Other Config

- **tsconfig.json** — Extends `expo/tsconfig.base`, strict mode. Path alias: `@/*` → `./*`.
- **babel.config.js** — `babel-preset-expo` with `unstable_transformImportMeta: true`. `module-resolver` plugin for `@/` alias.
- **metro.config.js** — Default expo metro config, no customizations.
- **eslint.config.js** — Flat config using `eslint-config-expo`, ignores `dist/*`.
- **package.json** — 30 dependencies, 9 devDependencies. Scripts: `start`, `android`, `ios`, `web`, `lint`. Package name: `expo-app`.

---

## 3. Project Structure

```
app.json                          # Expo config
babel.config.js                   # Babel with module-resolver (@/ alias)
eas.json                          # EAS Build profiles
eslint.config.js                  # ESLint flat config
metro.config.js                   # Metro bundler config
package.json                      # Dependencies & scripts
tsconfig.json                     # TypeScript strict config
README.md                         # This file

app/
  _layout.tsx                     # Root layout — provider hierarchy + nav guard + splash
  +native-intent.tsx              # Deep link redirect → /
  +not-found.tsx                  # 404 page
  login.tsx                       # Login/signup screen with animated hero
  (tabs)/
    _layout.tsx                   # Tab navigator — 4 tabs (Dashboard, Billing, Sales, Settings)
    (home)/
      _layout.tsx                 # Home stack layout
      index.tsx                   # Dashboard — stats cards, charts, quick overview
    billing/
      _layout.tsx                 # Billing stack layout
      index.tsx                   # Core billing flow — service picker, combos, subscriptions, cart, payment
    sales/
      _layout.tsx                 # Sales stack layout
      index.tsx                   # Sales history — search, filters, invoice download/share
    settings/
      _layout.tsx                 # Settings stack layout
      index.tsx                   # Settings hub — profile, menu sections, about, logout
      inventory.tsx               # Service/product CRUD
      staff.tsx                   # Staff management (admin only)
      customers.tsx               # Customer CRUD
      subscription-plans.tsx      # Subscription plan CRUD
      customer-subscriptions.tsx  # Customer subscription management
      offers.tsx                  # Offer CRUD (promo/visit/student types)
      payments.tsx                # UPI config CRUD
      combos.tsx                  # Combo CRUD with nested service picker

components/
  BillSummary.tsx                 # Billing calculation engine + payment flow (3-step modal)
  CustomerPicker.tsx              # Customer selection/creation modal
  DatePickerModal.tsx             # Custom calendar date picker
  HeaderRight.tsx                 # Header branding ("Much Love" in Billabong font)
  OfflineBanner.tsx               # Persistent offline/sync status banner (sales + mutations)
  OfflineBadge.tsx                 # Per-entity offline indicator badge (add/update/delete)
  QuickPayment.tsx                # Walk-in quick payment modal (3-step)
  SaleComplete.tsx                # Sale confirmation modal with offline badge
  SortPills.tsx                   # Reusable horizontal pill selector
  SubscriptionPicker.tsx          # Subscription selection modal with maxSelection

constants/
  app.ts                          # App identity constants
  colors.ts                       # 30+ color tokens (salon-themed pink/gold palette)
  typography.ts                   # FontSize, Spacing, BorderRadius constants

docs/
  ROADMAP.md                      # Feature roadmap
  seed-default-users.sql          # Legacy seed SQL (pre-Supabase Auth)
  SUPABASE_SETUP.md               # Supabase configuration guide
  PUSH_NOTIFICATIONS_SETUP.md     # Push notifications deployment guide
  supabase-migration.sql          # Complete SQL schema (10 tables + RLS + realtime)
  push-notifications-migration.sql # Push tokens table + DB trigger for background push

hooks/
  useOfflineQuery.ts              # Offline-first query wrapper (AsyncStorage cache)
  useRealtimeSync.ts              # Supabase Realtime subscription + admin notifications

lib/
  supabase.ts                     # Supabase client initialization

providers/
  AlertProvider.tsx               # Custom modal-based alert system
  AuthProvider.tsx                # Auth state management (login, signup, logout, session, profile)
  DataProvider.tsx                # Central data hub — all CRUD + stats + offline fallback
  OfflineSyncProvider.tsx         # Network-aware sync engine with integrity verification
  PaymentProvider.tsx             # UPI config management

scripts/
  generate-icons.js               # Programmatic app icon generation (sharp + SVG)

types/
  index.ts                        # Complete type system

utils/
  database.ts                     # DB initialization + timeout utility
  format.ts                       # Currency, date, name, mobile formatting/validation
  hash.ts                         # ID generation (timestamp + random)
  invoice.ts                      # HTML invoice + sales report generation, PDF print/share, standardized file naming
  notifications.ts                # Push notification setup, local notifications, push token registration/unregistration
  offlineQueue.ts                 # Tamper-proof offline sale queue (blockchain-style hashing)
  offlineMutationQueue.ts          # Generic offline mutation queue for all entity CRUD
  supabaseDb.ts                   # Complete CRUD for all entities (row mappers + mutations)

supabase/
  functions/
    push-sale-notification/
      index.ts                    # Edge Function — sends Expo push notifications to admins on new sale
```

---

## 4. Type System

Defined in `types/index.ts`:

```typescript
type UserRole = 'admin' | 'employee';

interface User {
  id: string;           // UUID from auth.users
  email: string;
  name: string;
  role: UserRole;
  approved: boolean;    // admin must approve before login works
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  age?: number;
  mobile: string;       // 10-digit Indian mobile (starts 6-9)
  altNumber?: string;
  location?: string;
  isStudent: boolean;
  visitCount: number;   // auto-incremented on each sale
  createdAt: string;
}

type ServiceKind = 'service' | 'product';

interface Service {
  id: string;
  name: string;
  code: string;
  price: number;
  kind: ServiceKind;
  mrp?: number;
  offerPrice?: number;
  createdAt: string;
  paymentMethod?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  createdAt: string;
}

interface SaleItem {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  kind: ServiceKind;
}

interface SubscriptionSaleItem {
  id: string;
  planId: string;
  planName: string;
  price: number;
  discountedPrice: number;
}

type SaleType = 'service' | 'subscription' | 'other';

interface Sale {
  id: string;
  customerId: string;
  customerName: string;
  employeeId: string;
  employeeName: string;
  items: SaleItem[];
  subscriptionItems: SubscriptionSaleItem[];
  type: SaleType;
  paymentMethod?: string;      // 'cash' | 'gpay'
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  createdAt: string;
}

type CustomerSubscriptionStatus = 'active' | 'paused';

interface CustomerSubscription {
  id: string;
  customerId: string;
  customerName: string;
  planId: string;
  planName: string;
  planDurationMonths: number;
  planPrice: number;
  status: CustomerSubscriptionStatus;
  startDate: string;
  assignedByUserId: string;
  assignedByName: string;
  createdAt: string;
}

interface Offer {
  id: string;
  name: string;
  percent: number;
  visitCount?: number;     // 0=first visit, ≥N=at least N visits, -1=student
  startDate?: string;
  endDate?: string;
  appliesTo: string;       // 'services' | 'subscriptions' | 'both'
  studentOnly: boolean;
  createdAt: string;
}

interface UpiData {
  id: string;
  upiId: string;
  payeeName: string;
}

interface ComboItem {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceKind: ServiceKind;
  originalPrice: number;
}

interface Combo {
  id: string;
  name: string;
  comboPrice: number;
  items: ComboItem[];
  createdAt: string;
}
```

---

## 5. Database Schema

Full schema in `docs/supabase-migration.sql` + `docs/push-notifications-migration.sql`. **13 tables total** (10 primary + 2 child + 1 push tokens):

### Tables

#### 1. `profiles`
```sql
id           UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE
email        TEXT
name         TEXT
role         TEXT CHECK (role IN ('admin', 'employee')) DEFAULT 'employee'
approved     BOOLEAN DEFAULT false
created_at   TIMESTAMPTZ DEFAULT now()
```
- Auto-created via trigger `on_auth_user_created` when a user signs up
- Trigger function `handle_new_user()` extracts `name` from `raw_user_meta_data`

#### 2. `customers`
```sql
id           TEXT PRIMARY KEY
name         TEXT NOT NULL
age          INTEGER
mobile       TEXT UNIQUE NOT NULL
alt_number   TEXT
location     TEXT
is_student   BOOLEAN DEFAULT false
visit_count  INTEGER DEFAULT 0
created_at   TIMESTAMPTZ DEFAULT now()
```

#### 3. `services`
```sql
id             TEXT PRIMARY KEY
name           TEXT NOT NULL
code           TEXT NOT NULL
price          NUMERIC NOT NULL
kind           TEXT CHECK (kind IN ('service', 'product')) DEFAULT 'service'
mrp            NUMERIC
offer_price    NUMERIC
payment_method TEXT
created_at     TIMESTAMPTZ DEFAULT now()
```

#### 4. `subscription_plans`
```sql
id               TEXT PRIMARY KEY
name             TEXT NOT NULL
duration_months  INTEGER NOT NULL
price            NUMERIC NOT NULL
created_at       TIMESTAMPTZ DEFAULT now()
```

#### 5. `customer_subscriptions`
```sql
id                   TEXT PRIMARY KEY
customer_id          TEXT NOT NULL
customer_name        TEXT
plan_id              TEXT NOT NULL
plan_name            TEXT
plan_duration_months INTEGER
plan_price           NUMERIC
status               TEXT CHECK (status IN ('active', 'paused')) DEFAULT 'active'
start_date           TIMESTAMPTZ DEFAULT now()
assigned_by_user_id  TEXT
assigned_by_name     TEXT
created_at           TIMESTAMPTZ DEFAULT now()
```

#### 6. `offers`
```sql
id           TEXT PRIMARY KEY
name         TEXT NOT NULL
percent      NUMERIC NOT NULL
visit_count  INTEGER
start_date   TIMESTAMPTZ
end_date     TIMESTAMPTZ
applies_to   TEXT CHECK (applies_to IN ('services', 'subscriptions', 'both')) DEFAULT 'services'
student_only BOOLEAN DEFAULT false
created_at   TIMESTAMPTZ DEFAULT now()
```

#### 7. `combos`
```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
combo_price NUMERIC NOT NULL
created_at  TIMESTAMPTZ DEFAULT now()
```

#### 8. `combo_items` (child of combos)
```sql
id             TEXT PRIMARY KEY
combo_id       TEXT REFERENCES combos(id) ON DELETE CASCADE
service_id     TEXT
service_name   TEXT
service_kind   TEXT CHECK (service_kind IN ('service', 'product'))
original_price NUMERIC
```

#### 9. `sales`
```sql
id                 TEXT PRIMARY KEY
customer_id        TEXT
customer_name      TEXT
employee_id        TEXT
employee_name      TEXT
type               TEXT CHECK (type IN ('service', 'subscription', 'other')) DEFAULT 'service'
payment_method     TEXT CHECK (payment_method IN ('cash', 'gpay'))
subtotal           NUMERIC DEFAULT 0
discount_percent   NUMERIC DEFAULT 0
discount_amount    NUMERIC DEFAULT 0
total              NUMERIC DEFAULT 0
created_at         TIMESTAMPTZ DEFAULT now()
is_offline_sale    BOOLEAN DEFAULT false
offline_created_at TIMESTAMPTZ
synced_at          TIMESTAMPTZ
```

#### 10. `sale_items` (child of sales)
```sql
id             TEXT PRIMARY KEY
sale_id        TEXT REFERENCES sales(id) ON DELETE CASCADE
service_id     TEXT
service_name   TEXT
service_code   TEXT
price          NUMERIC
original_price NUMERIC
quantity       INTEGER DEFAULT 1
kind           TEXT CHECK (kind IN ('service', 'product'))
```

#### 11. `subscription_sale_items` (child of sales)
```sql
id               TEXT PRIMARY KEY
sale_id          TEXT REFERENCES sales(id) ON DELETE CASCADE
plan_id          TEXT
plan_name        TEXT
price            NUMERIC
discounted_price NUMERIC
```

#### 12. `upi_configs`
```sql
id         TEXT PRIMARY KEY
upi_id     TEXT NOT NULL
payee_name TEXT NOT NULL
```

#### 13. `push_tokens`
```sql
id         TEXT PRIMARY KEY
user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
token      TEXT NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(user_id, token)
```
- Stores Expo Push Tokens for background push notifications
- RLS: users manage own tokens; admins can read all
- Trigger: `on_sale_insert_push` on `sales` INSERT calls `notify_sale_push()` which uses `pg_net` to invoke the Edge Function

### Row Level Security (RLS)

- **profiles**: SELECT for all authenticated users; UPDATE/DELETE for own profile or admin
- **push_tokens**: Users manage own tokens; admins can read all
- **All other tables**: Full CRUD access for all authenticated users

### Realtime

All 13 tables are added to the `supabase_realtime` publication for live updates.

### Database Triggers

| Trigger | Table | Function | Description |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | `handle_new_user()` | Auto-creates profile on signup |
| `on_sale_insert_push` | `sales` | `notify_sale_push()` | Calls Edge Function via `pg_net` to send push notifications to admins |

### Seed Data

On first launch, the app seeds (if tables are empty):
- 2 default services: Haircut (₹100, service), Hair Color (₹200, service)
- 2 default subscription plans: Trial (1 month, ₹0), 6 Months (₹5000)

---

## 6. Provider Architecture

Root layout wraps the entire app in this provider hierarchy (outermost → innermost):

```
QueryClientProvider
  └── AuthProvider
       └── DataProvider
            └── OfflineSyncProvider
                 └── PaymentProvider
                      └── AlertProvider
                           └── SafeAreaProvider
                                └── GestureHandlerRootView
                                     └── <Stack />
```

### AuthProvider (`providers/AuthProvider.tsx`)

**Pattern**: `@nkzw/create-context-hook`

**State**: `user: User | null`, `session`, `isLoading`, `isInitialized`

**Derived**: `isAuthenticated = !!user && !!session`, `isAdmin = user?.role === 'admin'`

**Key Functions**:

| Function | Behavior |
|---|---|
| `fetchProfile(authUserId, email)` | Queries `profiles` table, maps snake_case→camelCase to `User` |
| `login(email, password)` | `signInWithPassword`, sets session locally, checks `profile.approved`, returns `{success, error, pendingApproval}` |
| `signUp(email, password, name)` | Creates auth user with metadata, always signs out after (needs admin approval) |
| `logout()` | Unregisters push token, clears local state for instant UI update, then calls `supabase.auth.signOut()` |
| `refreshProfile()` | Re-fetches profile from DB using current session user |

**Init Sequence**:
1. Seeds database in background (non-blocking)
2. Checks existing session with **15s timeout** (does NOT sign out on timeout — preserves valid session for slow networks)
3. Fetches profile with **8s timeout** (separate try/catch — profile failure doesn't break session)
4. Clears stale sessions
5. `onAuthStateChange` — handles `TOKEN_REFRESHED` (signs out if no session), **skips `SIGNED_IN`** (login handles it directly to avoid double fetchProfile)

> **Session Resilience**: On timeout, the app stays on the login screen without invalidating the session. This prevents unnecessary logouts on slow/flaky connections (same pattern used by Instagram, Facebook). The next app open will retry session retrieval.

### DataProvider (`providers/DataProvider.tsx`)

**Central data hub** using `useOfflineQuery` for all 8 entity types:
- customers, services, subscriptions (plans), sales, users, customerSubscriptions, offers, combos

**Each entity** has a `getAll` query + CRUD mutations via `supabaseDb`.

**Key features**:
- `useRealtimeSync` for live updates + admin sale notifications
- **Offline-aware CRUD** — all entity add/update/delete operations catch network errors, enqueue via `offlineMutationQueue`, and apply optimistic cache updates
- `addSale` wraps mutation with offline fallback — on network error, enqueues via `enqueueSale()`, returns synthetic result with `_offline: true`
- `createOfflineMutation` — generic wrapper that handles network error → enqueue → optimistic update for any entity
- `isPendingSync(entity, entityId)` — checks if an entity has a pending offline mutation
- `isOffline` — network connectivity state from NetInfo
- `pendingOps` — Map of all pending mutation operations for UI indicators
- `stats` (memoized): `totalSalesAmount`, `totalSalesCount`, `todaySalesTotal`, `todaySalesCount`, `totalCustomers`, `activeSubscriptions`
- `reload()` — refetches all 8 queries in parallel

### PaymentProvider (`providers/PaymentProvider.tsx`)

UPI config management. Uses `useOfflineQuery` for `upiConfigs.getAll`. CRUD: `addUpi` (generates ID), `updateUpi`, `removeUpi`. All call `reloadUpi()` after mutation.

### AlertProvider (`providers/AlertProvider.tsx`)

Custom modal-based alert system (replaces native Alert). Supports types: `error`, `warning`, `success`, `info`, `confirm`. Animated with spring scale + opacity. Color-coded accent bar, lucide icon per type.

**API**: `showAlert(title, message, type)` and `showConfirm(title, message, onConfirm, confirmText)`

### OfflineSyncProvider (`providers/OfflineSyncProvider.tsx`)

Watches network via NetInfo. Syncs both offline sales (tamper-proof queue) and generic entity mutations (offlineMutationQueue). See [Offline Sync Architecture](#13-offline-sync-architecture).

---

## 7. Hooks

### `useOfflineQuery` (`hooks/useOfflineQuery.ts`)

Offline-first query pattern wrapping TanStack `useQuery`:

1. **Hydrates** from AsyncStorage on mount (cache key: `@oq:${JSON.stringify(queryKey)}`)
2. **Network-aware** query execution (enabled when online)
3. **Persists** fresh data to AsyncStorage on success with cache-age metadata (`@oq_meta:` prefix)
4. **Falls back** to cache when offline (up to 7-day cache retention)
5. **Cache age tracking** — `cacheAge` field returns human-readable age (e.g. '2h ago', '3d ago')
6. **`isFromCache`** flag — indicates when data is served from offline cache
7. **Auto-cleanup** — expired cache entries (>7 days) are purged on hydration

### `useRealtimeSync` (`hooks/useRealtimeSync.ts`)

Subscribes to Supabase Realtime `postgres_changes` on **all** tables. Maps table name → query keys (e.g., `profiles→['users']`, `sales→['sales']`). On `INSERT` to sales table by a different user, fires local push notification to admin via `sendSaleNotification`.

---

## 8. Utilities

### `utils/database.ts`
- `initializeDatabase()` — calls `seedSupabaseIfNeeded()` with 5s timeout
- `withTimeout<T>(promise, ms, label)` — races promise against timeout

### `utils/format.ts`
| Function | Description |
|---|---|
| `capitalizeWords(str)` | Title-case transformation |
| `formatCurrency(n)` | `₹` with Indian locale formatting |
| `formatDate(str)` | en-IN date format |
| `formatDateTime(str)` | Date + time format |
| `isValidName(str)` | ≥4 chars, letters+spaces only |
| `isValidMobile(str)` | 10 digits starting with 6-9 |
| `formatDateDDMMYYYY` | DD/MM/YYYY format |
| `parseDDMMYYYY` | Parse DD/MM/YYYY string |
| `isSameDay`, `isToday`, `isYesterday`, `isLastWeek`, `isThisMonth` | Date comparison helpers |

### `utils/hash.ts`
- `generateId()` — `Date.now().toString(36)` + random suffix, produces IDs like `lxyz1234_abc12345`

### `utils/invoice.ts` (512 lines)
| Function | Description |
|---|---|
| `sanitizeFileName(name)` | Removes non-alphanumeric characters from file names |
| `buildInvoiceHtml(sale)` | Full HTML invoice with gradient header, meta strip, customer/biller cards, items table (combo items get COMBO badge + savings), totals, footer |
| `openInvoice(sale)` | `Print.printAsync({ html })` |
| `shareInvoice(sale)` | `Print.printToFileAsync` → renames to `CustomerName_INVOICEID.pdf` → `Sharing.shareAsync` |
| `buildSalesReportHtml(sales, filters)` | PDF report with filter chips, summary cards, cash/UPI breakdown, full table |
| `shareSalesReport(sales, filters)` | Generates report PDF, renames to `SalesReport_YYYYMMDD_HHmmss.pdf`, shares |

**PDF File Naming**: Uses `expo-file-system` to rename generated PDFs from temp paths to cache directory with standardized names. Invoice PDFs use `CustomerName_ABCD1234.pdf` format (sanitized customer name + first 8 chars of invoice ID uppercased). Sales report PDFs use `SalesReport_YYYYMMDD_HHmmss.pdf` format.

### `utils/notifications.ts`
- Detects Expo Go (skips notifications in dev)
- `registerForNotifications()` — requests permissions, creates Android "sales" channel with pink light color
- `sendSaleNotification(customerName, total, employeeName)` — immediate local notification "💰 New Sale Recorded"
- `registerPushToken(userId)` — gets Expo push token via `getExpoPushTokenAsync({ projectId })`, upserts to `push_tokens` table (enables background notifications)
- `unregisterPushToken(userId)` — deletes all push tokens for user from `push_tokens` table (called on logout)

### `utils/offlineQueue.ts`
See [Offline Sync Architecture](#13-offline-sync-architecture).

### `utils/supabaseDb.ts` (575 lines)

Complete CRUD for all entities with snake_case↔camelCase row mappers.

**Row mappers**: `mapUser`, `mapCustomer`, `mapService`, `mapSubscriptionPlan`, `mapCustomerSubscription`, `mapOffer`, `mapUpiData`, `mapComboItem`, `mapSaleRow`, `mapSaleItem`, `mapSubscriptionSaleItem`

**Entity namespaces**:
| Namespace | Operations |
|---|---|
| `users` | getAll, useUpdate (name, role, approved), useRemove |
| `customers` | getAll, useAdd, useUpdate, useRemove |
| `services` | getAll, useAdd, useUpdate, useRemove |
| `subscriptions` | getAll, useAdd, useUpdate, useRemove |
| `sales` | getAll (joins sales + sale_items + subscription_sale_items), useAdd (creates sale + items + subscription items + customer_subscriptions + increments visit_count) |
| `customerSubscriptions` | getAll (with joins), useAdd, useUpdate, useRemove |
| `offers` | getAll, useAdd, useUpdate, useRemove |
| `upiConfigs` | getAll, useAdd, useUpdate, useRemove |
| `combos` | getAll (joins combos + combo_items), useAdd (insert combo + items), useUpdate (delete old items + re-insert), useRemove |

`seedSupabaseIfNeeded()` — seeds 2 default services + 2 plans if tables are empty.

---

## 9. Navigation & Screens

### Navigation Structure

```
/ (root Stack)
  ├── /login
  ├── /(tabs) (Tab Navigator)
  │     ├── /(home)/index     → Dashboard
  │     ├── /billing/index    → Billing
  │     ├── /sales/index      → Sales History
  │     └── /settings/
  │           ├── index       → Settings Hub
  │           ├── inventory   → Service/Product CRUD
  │           ├── staff       → Staff Management (admin only)
  │           ├── customers   → Customer CRUD (admin only)
  │           ├── subscription-plans    → Plan CRUD (admin only)
  │           ├── customer-subscriptions → Subscription Management (admin only)
  │           ├── offers      → Offer CRUD (admin only)
  │           ├── payments    → UPI Config CRUD (all users)
  │           └── combos      → Combo CRUD (admin only)
  └── +not-found              → 404
```

### Tab Icons
1. **Dashboard** — Sparkles icon
2. **Billing** — Scissors icon
3. **Sales** — BarChart3 icon
4. **Settings** — Settings icon

Pink header (`#E91E63`), white tab bar, safe area insets. Settings header conditionally shown based on focused route.

### Root Layout (`app/_layout.tsx`)

- QueryClient config: `staleTime: 5min`, `gcTime: 30min`, `retries: 2`, no `refetchOnWindowFocus`
- Navigation guard: redirects to `/(tabs)/` if authenticated, `/login` if not
- Loads **Billabong** custom font
- Shows `OfflineBanner` above Stack navigator
- **6s safety timeout** for splash screen
- Registers for push notifications on auth + registers Expo push token to `push_tokens` table via `registerPushToken(userId)`

### Login (`app/login.tsx` — 579 lines)

Gradient login screen with rose/pink/gold palette. Features:
- Animated hero with scissors logo (`✂`), sparkles, brand name "Much Love" + "BEAUTY SALON" in Billabong font
- Form card with email, password (toggle visibility), optional name field (for signup)
- Shake animation on validation error
- Login ↔ signup toggle
- Signup requires admin approval — shows "pending approval" message
- Success/error messages with colored boxes

### Dashboard (`app/(tabs)/(home)/index.tsx` — 550 lines)

**Admin view**:
- Today's Sales (₹), This Month (₹), Total Customers, Active Subscriptions — stat cards
- 7-day revenue BarChart
- Quick Overview: transactions, revenue, avg sale value

**Employee view**:
- My Today's Sales, My Transactions (filtered by `employeeId`)

- Pull-to-refresh via RefreshControl
- Error banner with retry button

### Billing (`app/(tabs)/billing/index.tsx` — 1531 lines)

**Core billing flow** — the largest and most complex screen.

**Sections**:

1. **Customer selection** — `CustomerPicker` modal with StudentBadge, SubscriptionBadge, renewal notices
2. **Subscription add** — integrated into customer card with policy enforcement (see Business Rules)
3. **Service picker modal** — Search bar, `SortPills` (a-z, z-a, recent/popularity), filter tabs (Services, Products, Combos — nullable/toggleable with `null` = show all), quantity +/- buttons for services/products
4. **Combo handling** — inline display with savings calculation, combos mixed with services/products in the list
5. **Cart section** — grouped items with quantities
6. **BillSummary component** — discount calculation + payment flow
7. **Quick Payment FAB** (Sparkles icon) — `QuickPayment` modal for walk-in payments
8. **Sticky footer** — shown when items selected but no customer assigned

**Filter tabs**: `FilterTab = 'services' | 'products' | 'combos' | null`
- Tabs are toggleable — tapping active tab sets it to `null` (show all)
- Default is `null` (all items shown)

**`handlePlaceOrder`** function:
- Builds sale object with **proportional combo pricing** — each combo item gets price allocated proportionally from combo total price based on original price ratios
- Sets `paymentMethod` ('cash' or 'gpay')
- Calls `addSale` (which may offline-enqueue on network error)
- Shows `SaleComplete` modal on success

**`handleQuickPayment`** function:
- Creates sale with `type: 'other'`, `customerName: 'Walk-in Customer'`
- No customer association required

**Key helper functions** (defined outside component):
- `getSubscriptionEndDate(startDate, durationMonths)` — calculates expiry
- `getDaysUntilExpiry(endDate)` — days remaining until subscription expires

### Sales (`app/(tabs)/sales/index.tsx` — 843 lines)

Sales history with search and filters.

**Search**: by customer name, employee name, invoice ID

**Filter modal**:
| Filter | Admin Options | Employee Options |
|---|---|---|
| Date | Today, Yesterday, Last Week, This Month, Pick Date, All | Today, Yesterday, All (where "All" = today+yesterday only) |
| Payment | Cash, UPI, All | Cash, UPI, All |
| Type | Service, Product, Others, All | Service, Product, Others, All |

**Sale cards** display:
- Customer name, invoice ID (first 8 chars), total amount
- Payment badge (Cash = green, UPI = pink)
- Expandable items list
- Date/time, billed-by employee name
- Download PDF / Share buttons

**Results row**: count + total amount + PDF report download button (admin only)

Uses: `openInvoice`, `shareInvoice`, `shareSalesReport`

### Settings Hub (`app/(tabs)/settings/index.tsx` — 556 lines)

- Profile card: avatar (gradient circle with first initial), name, email, role badge
- Menu sections (admin-guarded where noted):
  - **MANAGEMENT**: Inventory, Staff, Customers (admin only)
  - **SUBSCRIPTIONS**: Plans, Customer Subscriptions (admin only)
  - **OFFERS**: Offers, Combos (admin only)
  - **PAYMENTS**: UPI (all users)
- APP INFO section with About Us modal (business name, address, contact, version)
- Logout button with confirmation dialog
- Footer: app name + version + author

### Settings Sub-Screens

#### Inventory (`settings/inventory.tsx`)
Service/product CRUD. Search + filter (All/Services/Products) + SortPills. Form modal: name*, code*, price*, MRP (optional), type toggle. Validation: `isValidName` (≥4 chars, letters+spaces). Cards show name, type badge, price, MRP strikethrough, code.

#### Staff (`settings/staff.tsx`)
Staff management (admin only). Search by name/email. Info banner: "Staff members sign up from the login screen. Admin can edit roles here." Edit modal: name + role toggle (Employee/Admin). Delete with confirmation (cannot delete self). **No add button** — users self-register through signup, admin approves.

#### Customers (`settings/customers.tsx`)
Customer list/CRUD. Search + SortPills (a-z, z-a, recent, visits-high, visits-low). Form: name*, mobile* (10-digit validation). Duplicate mobile check on add. Cards show name, mobile, student tag, visit count.

#### Subscription Plans (`settings/subscription-plans.tsx`)
Plan CRUD. List with name, duration badge, price (or "FREE"). Discount hint: "Student: 30% off • Under ₹2000: 30% off / Over ₹2000: 20% off". FAB for add. Form: name, duration months, price.

#### Customer Subscriptions (`settings/customer-subscriptions.tsx`)
View/manage subscriptions. Search + filter (All/Active/Paused with counts). Cards: customer name, plan name, start date, assigned by. Status toggle (active↔paused) and remove with confirmations. Sorted by start date descending.

#### Offers (`settings/offers.tsx`)
Three offer types:
1. **Promo** — code + optional date range (start/end via DatePickerModal)
2. **Visit** — visit threshold count
3. **Student** — `appliesTo`: services/subscriptions/both

Form with type selector, name, discount %, type-specific fields. Filter: all/promo/visit/student. Cards show type badge, discount %, details, appliesTo tag, studentOnly tag.

#### Payments (`settings/payments.tsx`)
UPI config CRUD. Simple list with payee name + UPI ID. Add/edit modal.

#### Combos (`settings/combos.tsx` — 810 lines)
Combo CRUD. Create combo from services/products via nested service picker modal (search + filter tabs). Validation: ≥2 items required, combo price must be < sum of original prices. Summary: original total, combo price, customer savings. Cards: items as chips with service/product icons + prices, savings badge. Edit replaces all items (delete + re-insert pattern).

---

## 10. Components

### BillSummary (`components/BillSummary.tsx` — 793 lines)

**Critical billing calculation engine** + payment flow.

**Props**: `items` (Service[]), `subs` (SubscriptionPlan[]), `addedCombos` (Combo[]), `customer`, `offers`, `customerSubscriptions`, `onRemoveItem/Sub/Combo`, `onAddQuantity/SubtractQuantity`, `onPlaceOrder`, `upiList`

**Discount calculation logic** (memoized):

1. **Service discounts** (applied only to items with `kind === 'service'`, **NOT products**):
   - If customer has **active subscription**: `max(studentDiscount 30%, priceDiscount(subtotal < ₹2000 → 30%, else 20%))`
   - Else: find best **offer** matching services + student/visit criteria
   - Offer filtering: `appliesTo` includes services, `studentOnly` matches, `visitCount` rules

2. **Subscription discounts**: find best offer matching subscriptions + criteria

3. **Combos**: fixed price, **no discount applied**

4. **Total** = `subtotalServices - serviceDiscount + subtotalCombos + subtotalSubs - subsDiscount`

**Payment flow** (3-step modal within component):
1. `handlePlaceOrder` → if no UPI configured, direct cash. If UPI exists, show method picker
2. **Method step**: Cash or UPI selection with card UI
3. **QR step**: Horizontal pageable QR code carousel with `upi://pay?pa=...&am=...&cu=INR` URI. "Payment Received" confirmation button

**Special case**: if `total <= 0 && subtotal > 0` (100% discount), skips payment flow entirely.

### CustomerPicker (`components/CustomerPicker.tsx`)

Modal for customer selection/creation.

**Two modes**:
1. **Add form** — Name*, Mobile* (10-digit), Student toggle. Validates via `isValidName`, `isValidMobile`. Checks duplicate mobile. Calls `addCustomer`, auto-selects on success
2. **Select list** — Search (name/mobile), SortPills (a-z, z-a, recent), FlatList with highlighted selection. "Add New Customer" link at top

Props: `visible`, `customers`, `onClose`, `onSelect`, `selectedCustomer`, `showAddFormInitially?`, `addOnly?`

### DatePickerModal (`components/DatePickerModal.tsx` — 345 lines)

Custom calendar date picker with month navigation, 7-column grid (Sun–Sat), today/selected highlighting, min/max date constraints. Actions: Clear (returns null) + Confirm (returns Date).

### HeaderRight (`components/HeaderRight.tsx`)

Simple branding: displays "Much Love" in Billabong font (size 32), white, right-aligned.

### OfflineBanner (`components/OfflineBanner.tsx`)

Persistent top banner with 3 states:
1. **Syncing** (blue) — ActivityIndicator + "Syncing N sales · M changes…"
2. **Offline** (gray) — WifiOff icon + "You're offline" + combined pending count (sales + mutations)
3. **Pending** (yellow, tappable) — CloudUpload icon + combined pending label + "Tap to sync now" + conflict resolution summary

Shows both sale count and entity mutation count. Displays conflict resolution outcomes when server-wins conflicts occur.

Returns `null` when online + no pending + not syncing.

### OfflineBadge (`components/OfflineBadge.tsx`)

Per-entity offline indicator badge. Shows operation-specific icons and colors:
- **Add** (blue Upload icon) — "Pending upload"
- **Update** (amber Pencil icon) — "Pending update"
- **Delete** (red Trash2 icon) — "Pending delete"

Supports `compact` mode (icon-only, 16px circle) and full mode (pill badge with label).

Usage: `<OfflineBadge entity="customers" entityId={customer.id} />`

### QuickPayment (`components/QuickPayment.tsx` — 558 lines)

Walk-in payment modal with 3 steps:
1. **Amount** — Large currency input (₹), quick amount chips (₹100, ₹200, ₹500, ₹1000), optional note (max 100 chars)
2. **Method** — Cash / UPI card selector
3. **QR** — Horizontal pageable QR carousel

### SaleComplete (`components/SaleComplete.tsx`)

Sale confirmation modal with success icon, invoice #, offline badge ("Saved offline · will sync when online" when `sale._offline`), download PDF button, itemized details, Done button.

### SortPills (`components/SortPills.tsx`)

Reusable horizontal pill selector.

```typescript
type SortOption = 'a-z' | 'z-a' | 'recent' | 'visits-high' | 'visits-low';
type SortPillOption = { key: SortOption; label: string; Icon: LucideIcon };
```

Default options: Recent (Flame icon), A–Z (ArrowDownAZ), Z–A (ArrowUpZA).
Extra export: `visitSortOptions` (Visits ↓, Visits ↑).
Accepts custom `options` array to override defaults.

### SubscriptionPicker (`components/SubscriptionPicker.tsx`)

Modal for subscription plan selection. Search by name, FlatList with CheckCircle/Circle toggle. `maxSelection` prop — when exceeded, replaces previous selection. "Add (N)" button, disabled when none selected. Used with `maxSelection={1}` from billing screen.

---

## 11. Business Rules

### Subscription Rules
1. **Subscription discount**: Active subscriber gets `max(student 30%, price-based 30%/<₹2000 or 20%/≥₹2000)` on **services only** (not products, not combos)
2. **Max 2 active subscriptions** per customer
3. **Subscription renewal**: only allowed within **15-day window** before earliest subscription expiry
4. **Max 1 subscription per bill**

### Pricing Rules
5. **Combo pricing**: combo has fixed price; individual items get proportionally allocated price for invoice line items
6. **Combo discounts**: combos excluded from service discounts ("Combos at fixed price, no extra discounts")

### Offer Rules
7. **Offer eligibility**: `visitCount=0` → first visit; `visitCount≥N` → at least N visits; `visitCount=-1` → student-only offer
8. **Offer filtering**: checks `appliesTo` (services/subscriptions/both), `studentOnly`, date range validity

### Security Rules
9. **Offline sales**: tamper-proof queue with blockchain-style integrity hashing, **no delete/edit API** — employees cannot tamper with offline sales
10. **Staff registration**: users self-register, admin must approve `profile.approved = true` before login works
11. **Employee view restrictions**: dashboard shows only own sales; sales page date filter limited to today+yesterday

### Validation Rules
12. **Mobile validation**: Indian format, 10 digits, starts with 6-9
13. **Name validation**: ≥4 characters, letters and spaces only

### Payment Rules
14. **Payment methods**: cash or gpay (UPI); UPI shows QR code carousel with `upi://pay` URI
15. **Zero total shortcut**: if total ≤ 0 but subtotal > 0 (100% discount), skips payment flow entirely

### Data Rules
16. **Sale types**: `service`, `subscription`, `other` (quick payment)
17. **Visit count**: automatically incremented on each sale
18. **Duplicate mobile check**: prevents adding customer with existing mobile number

---

## 12. State Management Architecture

```
QueryClient (TanStack React Query v5)
  ├── staleTime: 5 min
  ├── gcTime: 30 min
  ├── retries: 2
  ├── refetchOnWindowFocus: false
  └── Queries:
       ├── ['customers']             → useOfflineQuery → AsyncStorage cache (7-day retention)
       ├── ['services']              → useOfflineQuery → AsyncStorage cache (7-day retention)
       ├── ['subscriptions']         → useOfflineQuery → AsyncStorage cache (7-day retention)
       ├── ['sales']                 → useOfflineQuery → AsyncStorage cache (7-day retention)
       ├── ['users']                 → useOfflineQuery → AsyncStorage cache (7-day retention)
       ├── ['customerSubscriptions'] → useOfflineQuery → AsyncStorage cache (7-day retention)
       ├── ['offers']                → useOfflineQuery → AsyncStorage cache (7-day retention)
       ├── ['combos']                → useOfflineQuery → AsyncStorage cache (7-day retention)
       └── ['upiConfigs']            → useOfflineQuery → AsyncStorage cache (7-day retention)

Realtime Channel (Supabase postgres_changes on all tables)
  → INSERT/UPDATE/DELETE detected
  → invalidates matching TanStack query keys
  → INSERT on sales by another user → local push notification to admin (foreground)

Background Push Notifications (Server-side)
  → sales INSERT triggers notify_sale_push()
  → pg_net calls Edge Function (push-sale-notification)
  → Edge Function queries admin push tokens
  → sends via Expo Push API → FCM/APNs delivery
  → works even when app is closed/backgrounded

Offline Sale Queue (AsyncStorage key: '@offline_sales')
  → blockchain-hashed append-only entries
  → syncs on reconnect (2s debounce) or app foreground
  → integrity verification before sync
  → purges synced entries older than 30 days

Offline Mutation Queue (AsyncStorage key: '@offline_mutation_queue')
  → generic CRUD queue for all entity types
  → smart optimization: merges updates into pending adds, cancels add+delete pairs
  → conflict resolution: server-wins when record modified after offline mutation
  → syncs on reconnect alongside sales
  → optimistic UI updates via TanStack Query cache
```

---

## 13. Offline Sync Architecture

### Sale Queue Design (`utils/offlineQueue.ts`)

**Anti-fraud, tamper-proof, append-only** queue stored in AsyncStorage with blockchain-style integrity hashing (MurmurHash via expo-crypto).

```typescript
interface OfflineSale {
  id: string;
  payload: Sale;           // full sale object
  offlineCreatedAt: string;
  integrityHash: string;   // chain hash from previous entry
  synced: boolean;
  syncedAt?: string;
  retryCount: number;
  lastError?: string;
}
```

**Operations**:
| Function | Description |
|---|---|
| `enqueueSale(sale)` | Computes chain hash from previous entry, appends to queue |
| `getPendingSales()` | Returns unsynced entries sorted by date |
| `getPendingCount()` | Count of unsynced entries |
| `markSynced(id)` | Sets `synced=true`, `syncedAt` timestamp |
| `markSyncFailed(id, error)` | Increments `retryCount`, stores `lastError` |
| `verifyIntegrity()` | Returns array of corrupted entry IDs |
| `purgeSyncedOlderThan(days)` | Cleanup synced entries |

**No delete/edit API** — by design, employees cannot tamper with offline sales.

### Generic Mutation Queue (`utils/offlineMutationQueue.ts`)

**Flexible CRUD queue** for all entity types (customers, services, subscriptions, offers, combos, customerSubscriptions).

```typescript
interface OfflineMutation {
  id: string;
  entity: MutationEntity;      // 'customers' | 'services' | ...
  entityId: string;
  operation: MutationOperation; // 'add' | 'update' | 'delete'
  payload: Record<string, any>;
  createdAt: string;
  synced: boolean;
  syncedAt?: string;
  retryCount: number;
  lastError?: string;
  conflictResolution: 'none' | 'resolved-server' | 'resolved-local';
}
```

**Smart queue optimization**:
- **Update merging**: If an entity already has a pending `add`, subsequent `update` merges payload into the `add` entry
- **Add+delete cancellation**: If an entity has a pending `add` and a `delete` is queued, both are removed (entity never existed server-side)
- **Sequential sync**: Mutations processed in order to maintain consistency

**Operations**:
| Function | Description |
|---|---|
| `enqueueMutation(entity, entityId, operation, payload)` | Smart-enqueue with optimization |
| `getPendingMutations()` | Returns all unsynced mutations |
| `getPendingMutationCount()` | Count of pending mutations |
| `markMutationSynced(id)` | Marks mutation as synced |
| `markMutationFailed(id, error)` | Stores error + increments retry |
| `getPendingEntityIds(entity)` | IDs of pending entities for a type |
| `getPendingOperations(entity)` | Map of entityId → operation for UI indicators |
| `purgeSyncedMutations()` | Cleanup all synced mutation entries |

### Conflict Resolution

Server-wins strategy at sync time:
1. For **updates**: fetch server record's `updated_at`, compare with mutation's `createdAt`
2. If server record was modified **after** the offline mutation → **server wins** (skip offline change)
3. If server record was modified **before** → **local wins** (apply offline change)
4. For **deletes**: if record doesn't exist on server → treat as already deleted
5. For **adds**: check for duplicates before inserting (idempotent)

### Sync Engine (`providers/OfflineSyncProvider.tsx`)

| Feature | Behavior |
|---|---|
| Auto-sync trigger | Network reconnect (2s debounce) + app foreground |
| Sale upload | `uploadSale(entry)` → inserts sale + sale_items + subscription_sale_items + customer_subscriptions + increments visit_count |
| Mutation upload | `syncMutation(mutation)` → handles add/update/delete per entity table with conflict resolution |
| Concurrency | Sync lock prevents concurrent syncs |
| Integrity | Verifies integrity chain for sales before upload |
| Conflict resolution | Server-wins for updates when server record is newer |
| Error handling | Duplicate key errors treated as already-synced |
| Cleanup | Purges synced sales >30 days + all synced mutations after sync |
| Query refresh | Invalidates affected entity queries after sync |

**Exposed**: `isOffline`, `pendingCount`, `pendingMutationCount`, `totalPendingCount`, `isSyncing`, `lastSyncResult`, `syncNow()`, `refreshPendingCount()`

---

## 14. Constants & Theming

### App Constants (`constants/app.ts`)
```typescript
APP_NAME = 'Much Love'
APP_VERSION = '1.1.5'
APP_AUTHOR = 'Mugundan M P'
BUSINESS_NAME = 'Much Love Beauty Salon'
BUSINESS_ADDRESS = 'Kundrathur, Chennai - 69'
BUSINESS_CONTACT = '9092890546'
```

### Color Palette (`constants/colors.ts`)

Salon-themed palette (30+ tokens):

| Token | Value | Usage |
|---|---|---|
| primary | `#E91E63` | Rose/pink — main brand color |
| primaryLight | `#FCE4EC` | Light pink backgrounds |
| accent | `#D4AF37` | Gold accent |
| background | `#FFF5F7` | App background |
| surface | `#FFFFFF` | Card/surface background |
| success | `#10B981` | Success states, cash badge |
| danger | `#EF4444` | Error/delete states |
| warning | `#F59E0B` | Warning states |
| info | `#3B82F6` | Info states |
| headerBg | `#E91E63` | Header background |
| headerText | `#FFFFFF` | Header text |
| inputBg | `#FFF0F3` | Input field background |
| border | (light gray) | Borders |
| textSecondary | (gray) | Secondary text |
| textTertiary | (lighter gray) | Tertiary text |
| shadow | (dark) | Shadow color |
| overlay | (dark transparent) | Modal overlay |

Plus light variants: `successLight`, `dangerLight`, `warningLight`, `infoLight`

### Typography (`constants/typography.ts`)

```typescript
FontSize:     xs(10), sm(11), body(13), md(14), title(16), heading(18), hero(24)
Spacing:      xs(4), sm(8), md(12), lg(16), xl(20), screen(20), modal(24), modalBottom(36)
BorderRadius: sm(8), md(12), lg(14), xl(16), xxl(24)
```

All exported `as const`.

---

## 15. Build & Deploy

### Prerequisites
- Node.js ≥18
- Expo CLI
- EAS CLI (`npm install -g eas-cli`)
- Android SDK (for local development)

### Development
```bash
npm install
npx expo start           # Start Metro bundler
npx expo start --android # Start with Android
```

### ADB Setup (Windows)
```powershell
$env:Path += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools"
adb reverse tcp:8081 tcp:8081   # Connect Metro to emulator
```

### Build
```bash
eas build --profile development --platform android   # Dev build
eas build --profile preview --platform android       # Preview APK
eas build --profile production --platform android    # Production AAB
```

### Environment Variables
Set in `.env` (local) or EAS secrets (builds):
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 16. Environment Setup

### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Get **Project URL** from Dashboard → Settings → API
3. Get **Legacy Anon JWT key** (not the "publishable" key) from Settings → API → Project API Keys
4. Set environment variables:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
   ```
5. Run `docs/supabase-migration.sql` in the Supabase SQL Editor (creates all 13 tables + RLS + triggers + realtime)
6. Run `docs/push-notifications-migration.sql` in the SQL Editor (creates push_tokens table + sale trigger — replace `<YOUR_SUPABASE_URL>` and `<YOUR_SERVICE_ROLE_KEY>` placeholders first)
7. Enable `pg_net` extension: Dashboard → Database → Extensions → search `pg_net` → Enable
8. Deploy Edge Function: `npx supabase functions deploy push-sale-notification --no-verify-jwt`
9. App auto-seeds default services and subscription plans on first launch

See `docs/PUSH_NOTIFICATIONS_SETUP.md` for detailed push notification setup instructions.

### Firebase / FCM Setup (for Push Notifications)

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add an Android app with package name `app.muchlove.billing`
3. Download `google-services.json` and place it in project root
4. In Firebase Console → Project Settings → Service Accounts → Generate new private key (JSON)
5. Upload FCM V1 Service Account Key to Expo:
   ```bash
   eas credentials -p android
   # Select "Push Notifications: Manage your FCM V1 service account key"
   # Upload the JSON key downloaded in step 4
   ```
   **Important**: Ensure the key is linked to the correct application identifier (`app.muchlove.billing`) on the Expo dashboard under Credentials.
6. Create an Expo Access Token at [expo.dev/accounts/.../access-tokens](https://expo.dev/accounts) (Personal Access Token, never expires)
7. Set the token as a Supabase secret:
   ```bash
   npx supabase secrets set EXPO_ACCESS_TOKEN=your-expo-access-token
   ```
8. The Edge Function (`push-sale-notification`) uses this token in the `Authorization: Bearer` header when calling the Expo Push API

### Supabase Client Configuration (`lib/supabase.ts`)
- Auth persistence via AsyncStorage
- `autoRefreshToken: true`
- `detectSessionInUrl: false`

### Icon Generation
```bash
node scripts/generate-icons.js
```
Generates `icon.png`, `adaptive-icon.png`, `favicon.png`, `splash-icon.png` in `assets/images/` using `sharp` library.

---

## 17. Roadmap

### Completed
- ✅ Supabase backend migration
- ✅ Sales fixes and improvements
- ✅ Offers engine (promo/visit/student)
- ✅ Billing QR code payments
- ✅ Data loading error handling
- ✅ Offline-first architecture with tamper-proof queue
- ✅ Combo system with proportional pricing
- ✅ Subscription management with renewal policies
- ✅ Real-time sync across devices
- ✅ PDF invoice generation and sharing
- ✅ Sales report generation
- ✅ Push notifications for admin (foreground via Realtime + background via Edge Function)
- ✅ Background push notifications (works when app is closed)
- ✅ Standardized PDF file naming (invoices + sales reports)
- ✅ Employee role restrictions
- ✅ Enhanced offline support (offline CRUD for all entities, conflict resolution, 7-day cache, per-entity indicators)
- ✅ Firebase FCM V1 integration (replaced legacy FCM key)
- ✅ Expo Access Token for authenticated push delivery
- ✅ Session timeout resilience (15s timeout, no sign-out on timeout)
- ✅ Safe area insets fix for billing modal (navigation bar overlap)
- ✅ Performance optimization (25 files — memoization, virtualization, reduced re-renders)

### Planned
- 🔮 OTP validation via WhatsApp
- 🔮 WhatsApp API integration for invoices/confirmations
