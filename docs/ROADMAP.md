# BillPro CRM – Roadmap

## Completed / Implemented

- **Supabase (Backend + DB)**: All data (users, customers, services, subscription plans, customer subscriptions, offers, sales, UPI configs) stored in Supabase. Login and CRUD use Supabase; see `docs/SUPABASE_SETUP.md` and `docs/supabase-migration.sql`.
- **Sales Page**: Payment method fix (GPay now saves correctly), View/Download buttons, Payment column on cards
- **Inventory**: Service/Product kinds from tab; no type selector in Add modal
- **Offers**: Visit & promo offers in Settings → Offers
- **Billing**: Dynamic UPI QR from Settings → Payments (up to 3 UPI IDs, swipe at checkout), "Mark as Paid", 30% subscription discount for active subscribers
- **Data loading**: Connection error banner with "Retry" on Home, Sales, and Settings when Supabase load fails

---

## Planned / Future

### 1. Offline support (optional)

**Goal**: Use app when offline; queue changes and sync when back online.

**Ideas**:
- Use `@react-native-community/netinfo` to detect offline/online
- Cache reads in memory/AsyncStorage; queue writes when offline; push/pull when online
- Conflict handling (e.g. last-write-wins or merge by `updated_at`)

---

### 2. OTP validation (future)

**Use cases**:
- Employee login
- Customer subscription confirmation

**Flow**:
- User enters phone → backend sends OTP via WhatsApp API
- User enters OTP → validate → proceed

---

### 3. WhatsApp API integration

**Goal**: Supabase/Edge Functions send WhatsApp messages for:
- OTP for login / subscription
- Bill/invoice links
- Subscription confirmation

**Requirements**:
- WhatsApp Business API account (Meta)
- Or third-party provider (Twilio, MessageBird, etc.)
- Not yet configured

**Architecture**:
```
User action (e.g. checkout) 
  → Supabase Edge Function / DB trigger
  → Call WhatsApp API
  → Send message to customer/employee
```

---

## Config Notes

- **UPI QR**: Add UPI IDs in Settings → Payments. Up to 3 IDs; swipe at checkout to switch QR.
- **Offers**: Admin configures in Settings → Offers. No default seeding.
