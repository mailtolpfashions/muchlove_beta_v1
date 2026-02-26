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
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  createdAt: string;
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
}

export interface CartItem {
  service: Service;
  quantity: number;
}

export interface VisitRecord {
  customerId: string;
  saleId: string;
  date: string;
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
}
