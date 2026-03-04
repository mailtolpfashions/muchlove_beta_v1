export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  email: string;
  name: string;
  mobile?: string;
  role: UserRole;
  approved: boolean;
  joiningDate: string;
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
  discountPercent: number;
  maxCartValue: number;
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

// ── Attendance & HR ─────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'permission' | 'leave';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'leave' | 'compensation' | 'earned';

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  notes: string | null;
  markedBy: string | null;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: RequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface PermissionRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  fromTime: string;
  toTime: string;
  reason: string | null;
  status: RequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface EmployeeSalary {
  id: string;
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  incentivePercent: number;
  effectiveFrom: string;
  createdAt: string;
}

// ── Salon Configuration ─────────────────────────────────────

export interface SalonConfig {
  id: string;
  weeklyOffDay: number;       // JS Date.getDay(): 0=Sun,1=Mon,2=Tue…
  shiftStartHour: number;     // e.g. 9
  shiftStartMin: number;      // e.g. 0
  shiftEndHour: number;       // e.g. 20
  shiftEndMin: number;        // e.g. 0
  workingHoursPerDay: number;  // Net working hours (shift minus breaks)
  graceMinutes: number;       // Late check-in grace period
  latesPerHalfDay: number;     // How many late check-ins = 0.5 day deduction (e.g. 3)
  freePermissionHours: number; // Free permission hours per month
  monthlyLeaveAllowance: number; // Paid leave days earned per month (e.g. 0.5 or 1)
  updatedAt: string;
}

/** Default configuration values (used as fallback) */
export const DEFAULT_SALON_CONFIG: Omit<SalonConfig, 'id' | 'updatedAt'> = {
  weeklyOffDay: 2,            // Tuesday
  shiftStartHour: 9,          // 9:00 AM
  shiftStartMin: 0,
  shiftEndHour: 20,           // 8:00 PM
  shiftEndMin: 0,
  workingHoursPerDay: 9,      // 11hr shift − 2hr break
  graceMinutes: 15,
  latesPerHalfDay: 3,          // 3 lates = 0.5 day salary deduction
  freePermissionHours: 2,
  monthlyLeaveAllowance: 0,   // 0 = disabled, 0.5 or 1 = days per month
};
