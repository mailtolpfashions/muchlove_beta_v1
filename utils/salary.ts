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

  /* Attendance */
  presentDays: number;
  halfDays: number;
  absentDays: number;          // true absents (no record & no leave) + excess leave overflow

  /* Comp leave */
  compLeavesEarned: number;    // from working on weekly offs this month

  /* Leave balance */
  earnedLeaveBalance: number;  // cumulative EL accrued − all EL ever used
  compBalance: number;         // cumulative comp earned − all comp ever used
  freePermDays: number;        // freePermissionHours / workingHoursPerDay (per month)
  leaveBalance: number;        // earnedLeaveBalance + compBalance + freePermDays

  /* Leave consumed this month */
  halfDayLeave: number;        // halfDays × 0.5
  permissionLeaveDays: number; // total approved permission hours ÷ workingHoursPerDay
  approvedLeaveDays: number;   // approved leave request days this month (all types)
  leaveConsumed: number;       // halfDayLeave + permissionLeaveDays + approvedLeaveDays

  /* Paid vs excess */
  paidLeaves: number;          // min(leaveConsumed, leaveBalance)
  excessLeaves: number;        // max(0, leaveConsumed − leaveBalance)

  /* Late penalty */
  lateCount: number;
  latesPerHalfDay: number;
  latePenaltyDays: number;

  /* Incentive */
  incentivePercent: number;    // admin-configured % of employee's monthly sales
  employeeSalesTotal: number;  // total sales amount by this employee in the month
  incentiveAmount: number;     // employeeSalesTotal × incentivePercent / 100

  /* Salary */
  earnedDays: number;          // presentDays + halfDays×0.5 + paidLeaves
  earnedSalary: number;
  lateDeduction: number;
  totalDeduction: number;      // lateDeduction only (excess leaves already reduce earnedDays)
  netSalary: number;           // earnedSalary - totalDeduction + incentiveAmount
}

// ── Leave Balance Helpers (shared with UI) ──────────────────

/** Compute cumulative comp balance across ALL attendance records.
 *  Pass excludeMonth to get the balance *before* that month's comp usage
 *  (so the month's usage can be counted separately without double-counting). */
export function computeCompBalance(
  allAttendance: Attendance[],
  allLeaveRequests: LeaveRequest[],
  cfg?: Partial<SalaryConfig>,
  excludeMonth?: { year: number; month: number },
): number {
  const c = resolveConfig(cfg);
  // Total comp earned across all time
  let totalCompEarned = 0;
  for (const rec of allAttendance) {
    totalCompEarned += compLeaveValue(rec, c);
  }
  // Total comp used — count DAYS (not requests) across all non-rejected compensation leaves
  let totalCompUsed = 0;
  for (const lr of allLeaveRequests) {
    if (lr.status === 'rejected' || lr.type !== 'compensation') continue;
    const start = new Date(lr.startDate);
    const end = new Date(lr.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== c.weeklyOffDay) {
        // Skip days in the excluded month (they'll be counted in leaveConsumed)
        if (excludeMonth && d.getFullYear() === excludeMonth.year && d.getMonth() === excludeMonth.month) continue;
        totalCompUsed++;
      }
    }
  }
  return Math.max(0, totalCompEarned - totalCompUsed);
}

/** Compute cumulative earned leave balance.
 *  Pass excludeMonth to get the balance *before* that month's earned leave usage. */
export function computeEarnedLeaveBalance(
  allLeaveRequests: LeaveRequest[],
  joiningDate: string | undefined,
  cfg?: Partial<SalaryConfig>,
  excludeMonth?: { year: number; month: number },
): number {
  const c = resolveConfig(cfg);
  if (!c.monthlyLeaveAllowance || c.monthlyLeaveAllowance <= 0 || !joiningDate) return 0;
  const jd = new Date(joiningDate);
  const now = new Date();
  if (jd > now) return 0;
  const monthsDiff = (now.getFullYear() - jd.getFullYear()) * 12 + (now.getMonth() - jd.getMonth());
  const completedMonths = now.getDate() >= jd.getDate() ? monthsDiff + 1 : monthsDiff;
  const totalELEarned = Math.max(0, completedMonths) * c.monthlyLeaveAllowance;
  // Count DAYS (not requests) across all non-rejected earned leaves
  let totalELUsed = 0;
  for (const lr of allLeaveRequests) {
    if (lr.status === 'rejected' || lr.type !== 'earned') continue;
    const start = new Date(lr.startDate);
    const end = new Date(lr.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Skip days in the excluded month (they'll be counted in leaveConsumed)
      if (excludeMonth && d.getFullYear() === excludeMonth.year && d.getMonth() === excludeMonth.month) continue;
      totalELUsed++;
    }
  }
  return Math.max(0, totalELEarned - totalELUsed);
}

/** Compute total leave balance = EL + comp + free permission days.
 *  Pass excludeMonth to get the balance *before* that month's typed leave usage. */
export function computeLeaveBalance(
  allAttendance: Attendance[],
  allLeaveRequests: LeaveRequest[],
  joiningDate: string | undefined,
  cfg?: Partial<SalaryConfig>,
  excludeMonth?: { year: number; month: number },
): { earnedLeaveBalance: number; compBalance: number; freePermDays: number; totalBalance: number } {
  const c = resolveConfig(cfg);
  const earnedLeaveBalance = computeEarnedLeaveBalance(allLeaveRequests, joiningDate, c, excludeMonth);
  const compBalance = computeCompBalance(allAttendance, allLeaveRequests, c, excludeMonth);
  const freePermDays = c.workingHoursPerDay > 0
    ? parseFloat((c.freePermissionHours / c.workingHoursPerDay).toFixed(4))
    : 0;
  return {
    earnedLeaveBalance,
    compBalance,
    freePermDays,
    totalBalance: earnedLeaveBalance + compBalance + freePermDays,
  };
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

  const monthPermissions = permissionRequests.filter(pr => {
    const d = new Date(pr.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // ── Count present, half_day, comp earned + late count ──
  let presentDays = 0;
  let halfDays = 0;
  let compLeavesEarned = 0;
  let lateCount = 0;

  for (const record of monthRecords) {
    if (isWeeklyOff(record.date, c)) {
      compLeavesEarned += compLeaveValue(record, c);
      continue;
    }
    switch (record.status) {
      case 'present':
        presentDays++;
        break;
      case 'half_day':
        halfDays++;
        break;
      case 'permission':
        presentDays++; // Permission day is counted as present for attendance
        break;
    }
    if (isLateCheckIn(record, c)) {
      lateCount++;
    }
  }

  // ── Leave balance (cumulative, all-time) — for display ──
  const balanceResult = computeLeaveBalance(attendanceRecords, leaveRequests, joiningDate, c);
  const { earnedLeaveBalance, compBalance, freePermDays } = balanceResult;
  const leaveBalance = balanceResult.totalBalance;

  // Effective balance for paid/excess calc: exclude current month's typed leave usage
  // to prevent double-counting (those days are already counted in approvedLeaveDays)
  const effectiveBalanceResult = computeLeaveBalance(attendanceRecords, leaveRequests, joiningDate, c, { year, month });
  const effectiveBalance = effectiveBalanceResult.totalBalance;

  // ── Leave consumed this month ──

  // 1. Half-day leave: each half_day status = 0.5 leave consumed
  const halfDayLeave = halfDays * 0.5;

  // 2. Permission leave: total non-rejected permission hours / workingHoursPerDay
  let totalPermissionHours = 0;
  for (const pr of monthPermissions) {
    if (pr.status === 'rejected') continue;
    totalPermissionHours += timeDiffHours(pr.fromTime, pr.toTime);
  }
  const permissionLeaveDays = c.workingHoursPerDay > 0
    ? parseFloat((totalPermissionHours / c.workingHoursPerDay).toFixed(4))
    : 0;

  // 3. Non-rejected leave request days this month (all types: regular + comp + earned)
  let approvedLeaveDays = 0;
  for (const lr of leaveRequests) {
    if (lr.status === 'rejected') continue;
    const start = new Date(Math.max(new Date(lr.startDate).getTime(), new Date(year, month, 1).getTime()));
    const end = new Date(Math.min(new Date(lr.endDate).getTime(), new Date(year, month + 1, 0).getTime()));
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === c.weeklyOffDay) continue;
      approvedLeaveDays++;
    }
  }

  const leaveConsumed = halfDayLeave + permissionLeaveDays + approvedLeaveDays;

  // ── Paid vs excess (use effectiveBalance to avoid double-counting typed leaves) ──
  const paidLeaves = Math.min(leaveConsumed, effectiveBalance);
  const excessLeaves = Math.max(0, leaveConsumed - effectiveBalance);

  // ── Absent days = unaccounted working days + excess leaves ──
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

  const accountedDays = presentDays + (halfDays * 0.5) + approvedLeaveDays;
  const trueAbsent = Math.max(0, workingDaysSoFar - accountedDays);
  const absentDays = trueAbsent + excessLeaves;

  // ── Earned salary: present + half×0.5 + paid leaves (within balance) ──
  const earnedDays = presentDays + (halfDays * 0.5) + paidLeaves;
  const earnedSalary = earnedDays * perDayRate;

  // ── Deductions ──
  const latesPerHalfDay = c.latesPerHalfDay > 0 ? c.latesPerHalfDay : 3;
  const latePenaltyDays = Math.floor(lateCount / latesPerHalfDay) * 0.5;
  const lateDeduction = latePenaltyDays * perDayRate;

  // No separate permission deduction — permissions consume from leave balance
  const totalDeduction = lateDeduction;

  // ── Incentive ──
  const incentivePercent = (cfg as any)?.incentivePercent ?? 0;
  const employeeSalesTotal = (cfg as any)?.employeeSalesTotal ?? 0;
  const incentiveAmount = incentivePercent > 0 && employeeSalesTotal > 0
    ? parseFloat((employeeSalesTotal * incentivePercent / 100).toFixed(2))
    : 0;

  const netSalary = Math.max(0, earnedSalary - totalDeduction + incentiveAmount);

  return {
    baseSalary,
    totalDaysInMonth: totalDays,
    weeklyOffs,
    workingDays,
    perDayRate,
    presentDays,
    halfDays,
    absentDays,
    compLeavesEarned,
    earnedLeaveBalance,
    compBalance,
    freePermDays,
    leaveBalance,
    halfDayLeave,
    permissionLeaveDays,
    approvedLeaveDays,
    leaveConsumed,
    paidLeaves,
    excessLeaves,
    lateCount,
    latesPerHalfDay,
    latePenaltyDays,
    incentivePercent,
    employeeSalesTotal,
    incentiveAmount,
    earnedDays,
    earnedSalary,
    lateDeduction,
    totalDeduction,
    netSalary,
  };
}
