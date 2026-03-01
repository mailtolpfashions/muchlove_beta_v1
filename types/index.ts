export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  approved: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  age?: string;
  mobile: string;
  altNumber?: string;
  location?: string;
  isStudent: boolean;
  visitCount: number;
  createdAt: string;
  /** true when created/updated offline and not yet synced */
  _offline?: boolean;
}

export type ServiceKind = 'service' | 'product';

export interface Service {
  id: string;
  name: string;
  code: string;
  price: number;
  kind: ServiceKind;
  mrp?: number;
  offerPrice?: number;
  createdAt: string;
  paymentMethod?: 'cash' | 'gpay';
  _offline?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  createdAt: string;
  _offline?: boolean;
}

export interface SaleItem {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  kind: ServiceKind;
}

export interface SubscriptionSaleItem {
  id: string;
  planId: string;
  planName: string;
  price: number;
  discountedPrice: number;
}

export type SaleType = 'service' | 'subscription' | 'other';

export interface Sale {
  id: string;
  customerId: string;
  customerName: string;
  employeeId: string;
  employeeName: string;
  items: SaleItem[];
  subscriptionItems: SubscriptionSaleItem[];
  type: SaleType;
  paymentMethod?: 'cash' | 'gpay';
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  _offline?: boolean;
}

export type CustomerSubscriptionStatus = 'active' | 'paused';

export interface CustomerSubscription {
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
  _offline?: boolean;
}

export interface Offer {
  id: string;
  name: string;
  percent: number;
  visitCount?: number;
  startDate?: string;
  endDate?: string;
  appliesTo: 'services' | 'subscriptions' | 'both';
  studentOnly: boolean;
  createdAt: string;
  _offline?: boolean;
}

export interface UpiData {
  id: string;
  upiId: string;
  payeeName: string;
}

export interface ComboItem {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceKind: ServiceKind;
  originalPrice: number;
}

export interface Combo {
  id: string;
  name: string;
  comboPrice: number;
  items: ComboItem[];
  createdAt: string;
  _offline?: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  categoryId: string | null;
  categoryName: string;
  amount: number;
  description: string;
  expenseDate: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}
