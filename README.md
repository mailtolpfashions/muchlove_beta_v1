# muchlove_beta

## Project Overview

This is a __React Native Expo__ application for a beauty salon billing and management system, built with TypeScript and using Supabase as the backend.

## Key Technologies

- __Frontend__: React Native with Expo Router
- __State Management__: TanStack Query (React Query) with offline support
- __Backend__: Supabase (PostgreSQL database + authentication)
- __Styling__: Custom design system with consistent typography and colors
- __Navigation__: Expo Router with tab-based navigation

## Project Structure

### Core Architecture

- __App Entry__: `app/_layout.tsx` - Main layout with providers and authentication
- __Navigation__: Tab-based with 4 main sections: Dashboard, Billing, Sales, Settings
- __Providers__: Auth, Data, and Payment providers for state management
- __Database__: Supabase integration with comprehensive table structure

### Main Screens

1. __Dashboard__ (`app/(tabs)/(home)/index.tsx`)

   - Sales overview with charts and statistics
   - Role-based views (admin vs employee)
   - Real-time data with refresh controls

2. __Billing__ (`app/(tabs)/billing/index.tsx`)

   - Customer selection and service/subscription selection
   - Dynamic bill calculation with discounts
   - UPI payment integration with QR codes
   - Quick payment functionality

3. __Sales__ (`app/(tabs)/sales/index.tsx`)

   - Sales history with filtering and search
   - Invoice generation and download
   - Payment method tracking

4. __Settings__ - Comprehensive admin panel with:

   - __Inventory Management__ - Add/edit services and products
   - __Staff Management__ - Employee CRUD operations
   - __Customer Management__ - Customer records and visit tracking
   - __Subscription Plans__ - Plan configuration
   - __Customer Subscriptions__ - Active/paused subscription management
   - __Offers__ - Visit-based, promo, and student discounts
   - __Payments__ - UPI configuration

### Key Features

#### Authentication & Security

- User login with hashed passwords
- Role-based access (admin/employee)
- Default credentials: admin/admin123, employee/emp123

#### Billing System

- Service and product selection

- Subscription plan sales

- Dynamic discount calculation based on:

  - Customer subscriptions (30% off for active subscribers)
  - Visit count (visit-based offers)
  - Student status
  - Promo codes

#### Payment Integration

- Cash and UPI payment methods
- QR code generation for UPI payments
- Multiple UPI ID support with swipe navigation

#### Data Management

- Offline-first approach with AsyncStorage
- Real-time sync with Supabase
- Comprehensive error handling and retry mechanisms

#### Database Schema

The app uses 10 main tables:

- `users` - Staff accounts
- `customers` - Customer records with visit tracking
- `services` - Services and products
- `subscription_plans` - Subscription configurations
- `sales` - Transaction records
- `customer_subscriptions` - Active subscriptions
- `offers` - Discount rules
- `upi_configs` - Payment configurations

### Development Setup

- __Environment__: Requires Supabase project URL and Anon Key
- __Build System__: Expo with EAS for production builds
- __Code Quality__: ESLint configuration included
- __TypeScript__: Full type safety with comprehensive type definitions

### Notable Features

- __Offline Support__: Graceful handling of network issues
- __Responsive Design__: Consistent UI across all screens
- __Accessibility__: Proper labeling and keyboard navigation
- __Error Handling__: Comprehensive error states and user feedback
- __Security__: Password hashing and role-based permissions

This is a well-architected, production-ready application with a complete billing system for a beauty salon business, featuring modern React Native patterns and robust backend integration.



CRM and Billing Mobile App Beta
------------------------------------------------------------
Billing Page
------------------------------------------------------------
Features:

1. Add New Customer
2. Select Existing Customer
3. Recent Services
4. Quick Payment
5. Payment

Workflow Paths:
Create New Customer → Billing → Payment
Select Existing Customer → Billing → Payment
Quick Payment → Payment
Select Service → Billing → Select Customer/Create Customer → Payment

1. Add New Customer
User can add a new customer using Name and a valid unique Mobile Number.
Once added, the customer should be auto-selected to proceed to payment.

2. Select Existing Customer
User can search for a customer by name or mobile number using a search box.
After selection, the user can proceed to payment.

3. Recent Services
User can view the last 5 frequently billed services.
User must select a customer before proceeding to payment.

4. Quick Payment - In-Progress
User can proceed directly to payment by entering an amount.
Customer name is optional.

5. Payment
User can add, remove or remove all items from cart
User can choose select payment method, cash or online/UPI
User able to view proper error message or sale complete with invoice number 

------------------------------------------------------------
Sales Page :
------------------------------------------------------------
User can add filters in sales page, 
as a admin able to view filter values: today, yesterday, last week and this month.
this month means calendar month not last 30 days
by default selected today
and filter for cash and online/upi
and service and sales

employee only have todays and yesterday
and filter for cash and online/upi
and service and sales

------------------------------------------------------------
Settings Page :
------------------------------------------------------------
Features:
1. Profile
2. Management
	2.1. Inventory
	2.2. Staff
	2.3. Customers
3. Subscriptions
3.1 Subscription Plans
3.2 Customer Subscriptions
4. Offers
5. Payments
6. About Us
7. LogOut 

-----------------------------------------------------------
RUN
-----------------------------------------------------------
npx expo start --clear
eas build -p android --profile preview


failed. bun install --frozen-lockfile exited with non-zero code: 1

Try 
bun install --frozen-lockfile

Else
rm -rf node_modules bun.lockb
Remove-Item -Recurse -Force node_modules
Remove-Item bun.lockb

bun install

--------------------------------------------------------------
SUPABASE
-------------------------------------------------------------
Add Key:
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "<YOUR_SUPABASE_PROJECT_URL>"
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<YOUR_SUPABASE_ANON_KEY>"


Delete Key:
eas env:delete preview --variable-name EXPO_PUBLIC_SUPABASE_ANON_KEY
eas env:delete preview --variable-name EXPO_PUBLIC_SUPABASE_URL


-- Run this in Supabase SQL Editor if the app did not seed users (e.g. RLS blocking).
-- Log in with: admin / admin123  or  employee / emp123

INSERT INTO users (id, username, password_hash, name, role, created_at) VALUES
  ('seed_admin_1', 'admin', 'veeet2c8e6', 'Administrator', 'admin', now()),
  ('seed_employee_1', 'employee', 'vs6h1w80ks', 'Staff Member', 'employee', now())
ON CONFLICT (username) DO NOTHING;
