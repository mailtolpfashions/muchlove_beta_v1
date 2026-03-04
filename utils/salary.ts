import type { Attendance, LeaveRequest, PermissionRequest, SalonConfig } from '@/types';
import { DEFAULT_SALON_CONFIG } from '@/types';

// ── Config-aware type ───────────────────────────────────────
/** Partial config that salary functions need. Falls back to defaults. */
export type SalaryConfig = Pick<
  SalonConfig,
  | 'weeklyOffDay'
  | 'shiftStartHour'
  | 'shiftStartMin'
  | 'shiftEndHour'
  | 'shiftEndMin'
  | 'workingHoursPerDay'
  | 'graceMinutes'
  | 'latesPerHalfDay'
  | 'freePermissionHours'
  | 'monthlyLeaveAllowance'
>;

/** Resolve a partial config into a full one, using defaults for missing fields */
function resolveConfig(cfg?: Partial<SalaryConfig>): SalaryConfig {
  return { ...DEFAULT_SALON_CONFIG, ...cfg };
}

// ── Legacy constants (re-exported from defaults for backward compatibility) ──
export const WEEKLY_OFF_DAY = DEFAULT_SALON_CONFIG.weeklyOffDay;
export const SHIFT_START_HOUR = DEFAULT_SALON_CONFIG.shiftStartHour;
export const SHIFT_START_MIN = DEFAULT_SALON_CONFIG.shiftStartMin;
export const SHIFT_END_HOUR = DEFAULT_SALON_CONFIG.shiftEndHour;
export const SHIFT_END_MIN = DEFAULT_SALON_CONFIG.shiftEndMin;
export const WORKING_HOURS_PER_DAY = DEFAULT_SALON_CONFIG.workingHoursPerDay;
export const GRACE_MINUTES = DEFAULT_SALON_CONFIG.graceMinutes;
export const FREE_PERMISSION_HOURS = DEFAULT_SALON_CONFIG.freePermissionHours;

// ── Helpers ─────────────────────────────────────────────────

/** Get total days in a month */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Check if a date string falls on the weekly off day */
export function isWeeklyOff(dateStr: string, cfg?: Partial<SalaryConfig>): boolean {
  const c = resolveConfig(cfg);
  return new Date(dateStr).getDay() === c.weeklyOffDay;
}

/** Returns comp leave value for a weekly-off attendance record (status-based).
 *  present → 1, half_day → 0.5, otherwise → 0 */
export function compLeaveValue(record: Attendance, cfg?: Partial<SalaryConfig>): number {
  const c = resolveConfig(cfg);
  if (!isWeeklyOff(record.date, c)) return 0;
  if (record.status === 'present' || record.status === 'permission') return 1;
  if (record.status === 'half_day') return 0.5;
  return 0;
}

/** Parse a time string "HH:MM" or "HH:MM:SS" into total minutes since midnight */
function parseTimeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/** Calculate hours between two time strings */
function timeDiffHours(from: string, to: string): number {
  const fromMin = parseTimeToMinutes(from);
  const toMin = parseTimeToMinutes(to);
  return Math.max(0, (toMin - fromMin) / 60);
}

// ── Late Check-in Detection ─────────────────────────────────

/** Check if a single attendance record has a late check-in (after shift start + grace) */
export function isLateCheckIn(record: Attendance, cfg?: Partial<SalaryConfig>): boolean {
  const c = resolveConfig(cfg);
  if (!record.checkIn) return false;
  const checkIn = new Date(record.checkIn);
  const threshold = c.shiftStartHour * 60 + c.shiftStartMin + c.graceMinutes;
  const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();
  return checkInMinutes > threshold;
}

// ── Monthly Salary Calculation ──────────────────────────────

export interface SalaryBreakdown {
  baseSalary: number;
  totalDaysInMonth: number;
  weeklyOffs: number;
  workingDays: number;
  perDayRate: number;
  presentDays: number;
  halfDays: number;
  approvedLeaves: number;
  approvedCompLeaves: number;
  approvedEarnedLeaves: number;
  approvedPermissions: number;
  absentDays: number;
  compLeavesEarned: number;
  compLeavesUsed: number;
  earnedLeavesUsed: number;
  totalPermissionHours: number;
  freePermissionHours: number;
  excessPermissionHours: number;
  /** Number of late check-ins this month */
  lateCount: number;
  /** Config: how many lates = 0.5 day deduction */
  latesPerHalfDay: number;
  /** Days deducted due to lates (e.g. 0.5, 1, 1.5…) */
  latePenaltyDays: number;
  /** Days deducted due to excess permission hours */
  permissionPenaltyDays: number;
  earnedDays: number;
  earnedSalary: number;
  /** Late penalty in currency */
  lateDeduction: number;
  /** Permission penalty in currency */
  permissionDeduction: number;
  totalDeduction: number;
  netSalary: number;
}

export function calculateMonthlySalary(
  baseSalary: number,
  attendanceRecords: Attendance[],
  leaveRequests: LeaveRequest[],
  permissionRequests: PermissionRequest[],
  year: number,
  month: number, // 0-indexed (JS convention)
  joiningDate?: string, // YYYY-MM-DD — only count days from this date onward
  cfg?: Partial<SalaryConfig>,
): SalaryBreakdown {
  const c = resolveConfig(cfg);
  const totalDays = daysInMonth(year, month);

  // Determine the first countable day of the month based on joining date
  let firstDay = 1;
  if (joiningDate) {
    const jd = new Date(joiningDate);
    if (jd.getFullYear() === year && jd.getMonth() === month) {
      firstDay = jd.getDate(); // joined mid-month
    } else if (jd.getFullYear() > year || (jd.getFullYear() === year && jd.getMonth() > month)) {
      firstDay = totalDays + 1; // joined after this month — no working days
    }
  }

  // Count weekly offs and working days from firstDay
  let weeklyOffs = 0;
  let workingDays = 0;
  for (let d = firstDay; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === c.weeklyOffDay) {
      weeklyOffs++;
    } else {
      workingDays++;
    }
  }

  const perDayRate = workingDays > 0 ? baseSalary / workingDays : 0;

  // Filter records for this employee's month (from joining date onward)
  const monthRecords = attendanceRecords.filter(r => {
    const d = new Date(r.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return false;
    if (d.getDate() < firstDay) return false;
    return true;
  });

  const monthLeaves = leaveRequests.filter(lr => {
    const start = new Date(lr.startDate);
    const end = new Date(lr.endDate);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    return start <= monthEnd && end >= monthStart;
  });

  const monthPermissions = permissionRequests.filter(pr => {
    const d = new Date(pr.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Count present, half_day, permission attendance + late count
  let presentDays = 0;
  let halfDays = 0;
  let permissionAttendanceDays = 0;
  let compLeavesEarned = 0;
  let lateCount = 0;

  for (const record of monthRecords) {
    // Check if this is a weekly off — earns comp leave based on status
    if (isWeeklyOff(record.date, c)) {
      compLeavesEarned += compLeaveValue(record, c);
      continue; // Don't count weekly off attendance in regular present count
    }

    switch (record.status) {
      case 'present':
        presentDays++;
        break;
      case 'half_day':
        halfDays++;
        break;
      case 'permission':
        permissionAttendanceDays++;
        presentDays++; // Permission day is counted as present
        break;
    }

    // Count late check-ins (only for non-weekly-off working days)
    if (isLateCheckIn(record, c)) {
      lateCount++;
    }
  }

  // Count approved leaves (all types) — deduplicate by date
  const leaveDatesByType = { leave: new Set<string>(), compensation: new Set<string>(), earned: new Set<string>() };
  for (const lr of monthLeaves) {
    if (lr.status !== 'approved') continue;
    const start = new Date(Math.max(new Date(lr.startDate).getTime(), new Date(year, month, 1).getTime()));
    const end = new Date(Math.min(new Date(lr.endDate).getTime(), new Date(year, month + 1, 0).getTime()));
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === c.weeklyOffDay) continue;
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (lr.type === 'compensation') {
        leaveDatesByType.compensation.add(ds);
      } else if (lr.type === 'earned') {
        leaveDatesByType.earned.add(ds);
      } else {
        leaveDatesByType.leave.add(ds);
      }
    }
  }
  const approvedLeaves = leaveDatesByType.leave.size;
  const approvedCompLeaves = leaveDatesByType.compensation.size;
  const approvedEarnedLeaves = leaveDatesByType.earned.size;

  // Half-day absent portion: try to cover with comp balance first, then earned leave balance
  let halfDaysCoveredByComp = 0;
  let halfDaysCoveredByEL = 0;
  const halfDayAbsentPortion = halfDays * 0.5;

  const compBalanceAvailable = Math.max(0, compLeavesEarned - approvedCompLeaves);

  // Step 1: Cover with comp balance
  halfDaysCoveredByComp = Math.min(halfDayAbsentPortion, compBalanceAvailable);
  let remainingHalfAbsent = halfDayAbsentPortion - halfDaysCoveredByComp;

  // Step 2: Cover with earned leave balance
  let earnedLeaveBalance = 0;
  if (c.monthlyLeaveAllowance > 0 && joiningDate) {
    const jd = new Date(joiningDate);
    const now = new Date();
    if (jd <= now) {
      const monthsDiff = (now.getFullYear() - jd.getFullYear()) * 12 + (now.getMonth() - jd.getMonth());
      const completedMonths = now.getDate() >= jd.getDate() ? monthsDiff + 1 : monthsDiff;
      const totalELEarned = Math.max(0, completedMonths) * c.monthlyLeaveAllowance;
      const totalELUsed = leaveRequests.filter(lr => lr.status === 'approved' && lr.type === 'earned').length;
      earnedLeaveBalance = Math.max(0, totalELEarned - totalELUsed);
    }
  }
  halfDaysCoveredByEL = Math.min(remainingHalfAbsent, earnedLeaveBalance);
  remainingHalfAbsent -= halfDaysCoveredByEL;

  const compLeavesUsed = approvedCompLeaves + halfDaysCoveredByComp;
  const earnedLeavesUsed = approvedEarnedLeaves + halfDaysCoveredByEL;

  // Count approved permission hours
  let totalPermissionHours = 0;
  const approvedPermissions = monthPermissions.filter(p => p.status === 'approved').length;
  for (const pr of monthPermissions) {
    if (pr.status !== 'approved') continue;
    totalPermissionHours += timeDiffHours(pr.fromTime, pr.toTime);
  }

  const freePermissionHours = c.freePermissionHours;
  const excessPermissionHours = Math.max(0, totalPermissionHours - freePermissionHours);

  // Calculate absent days
  const today = new Date();
  const lastCountableDay = Math.min(
    totalDays,
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : totalDays,
  );

  let workingDaysSoFar = 0;
  for (let d = firstDay; d <= lastCountableDay; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() !== c.weeklyOffDay) workingDaysSoFar++;
  }

  const accountedDays = presentDays + (halfDays * 0.5) + approvedLeaves + compLeavesUsed + earnedLeavesUsed;
  const absentDays = Math.max(0, workingDaysSoFar - accountedDays);

  // Earned salary
  const earnedDays = presentDays + (halfDays * 0.5) + compLeavesUsed + earnedLeavesUsed;
  const earnedSalary = earnedDays * perDayRate;

  // ── Deductions (day-based) ──

  // 1. Late penalty: floor(lateCount / latesPerHalfDay) × 0.5 day
  const latesPerHalfDay = c.latesPerHalfDay > 0 ? c.latesPerHalfDay : 3;
  const latePenaltyDays = Math.floor(lateCount / latesPerHalfDay) * 0.5;
  const lateDeduction = latePenaltyDays * perDayRate;

  // 2. Permission penalty: proportional — excessHours / shiftHours × perDayRate
  const permissionPenaltyDays = excessPermissionHours > 0
    ? parseFloat((excessPermissionHours / c.workingHoursPerDay).toFixed(4))
    : 0;
  const permissionDeduction = permissionPenaltyDays * perDayRate;

  const totalDeduction = lateDeduction + permissionDeduction;
  const netSalary = Math.max(0, earnedSalary - totalDeduction);

  return {
    baseSalary,
    totalDaysInMonth: totalDays,
    weeklyOffs,
    workingDays,
    perDayRate,
    presentDays,
    halfDays,
    approvedLeaves,
    approvedCompLeaves,
    approvedEarnedLeaves,
    approvedPermissions,
    absentDays,
    compLeavesEarned,
    compLeavesUsed,
    earnedLeavesUsed,
    totalPermissionHours,
    freePermissionHours,
    excessPermissionHours,
    lateCount,
    latesPerHalfDay,
    latePenaltyDays,
    permissionPenaltyDays,
    earnedDays,
    earnedSalary,
    lateDeduction,
    permissionDeduction,
    totalDeduction,
    netSalary,
  };
}
