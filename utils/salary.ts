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
  offDays: number;
  leaveDays: number;

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
  earlyOutHours: number;
  earlyOutDays: number;
  penaltyDays: number;
  balanceDays: number;
  deductibleDays: number;

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

interface MonthAttendanceSummary {
  presentDays: number;
  halfDays: number;
  absentDays: number;
  offDays: number;
  leaveDays: number;
  compLeavesEarned: number;
  lateCount: number;
  earlyOutHours: number;
  permissionLeaveDays: number;
  approvedLeaveDays: number;
}

function getMonthAttendanceSummary(
  attendanceRecords: Attendance[],
  leaveRequests: LeaveRequest[],
  permissionRequests: PermissionRequest[],
  year: number,
  month: number,
  joiningDate: string | undefined,
  cfg: SalaryConfig,
): MonthAttendanceSummary {
  const totalDays = daysInMonth(year, month);
  const today = new Date();

  let firstDay = 1;
  if (joiningDate) {
    const jd = new Date(joiningDate);
    if (jd.getFullYear() === year && jd.getMonth() === month) {
      firstDay = jd.getDate();
    } else if (jd.getFullYear() > year || (jd.getFullYear() === year && jd.getMonth() > month)) {
      firstDay = totalDays + 1;
    }
  }

  const lastCountableDay = Math.min(
    totalDays,
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : totalDays,
  );

  const monthRecords = attendanceRecords.filter(r => {
    const d = new Date(r.date);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() >= firstDay;
  });
  const recordMap = new Map<string, Attendance>();
  monthRecords.forEach(r => recordMap.set(r.date, r));

  const leaveDates = new Set<string>();
  for (const lr of leaveRequests) {
    if (lr.status === 'rejected') continue;
    const start = new Date(Math.max(new Date(lr.startDate).getTime(), new Date(year, month, firstDay).getTime()));
    const end = new Date(Math.min(new Date(lr.endDate).getTime(), new Date(year, month, lastCountableDay).getTime()));
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === cfg.weeklyOffDay) continue;
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      leaveDates.add(ds);
    }
  }

  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let offDays = 0;
  let leaveDays = 0;
  let compLeavesEarned = 0;
  let lateCount = 0;
  let earlyOutHours = 0;

  const shiftEndMin = cfg.shiftEndHour * 60 + cfg.shiftEndMin;

  for (let day = firstDay; day <= lastCountableDay; day++) {
    const d = new Date(year, month, day);
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    const isOff = d.getDay() === cfg.weeklyOffDay;
    const rec = recordMap.get(ds);
    const hasLeave = leaveDates.has(ds);

    if (isToday && !rec && !hasLeave) {
      continue;
    }

    if (isOff) {
      const cv = rec ? compLeaveValue(rec, cfg) : 0;
      if (cv > 0 && rec?.status === 'half_day') {
        presentDays += 0.5;
        offDays += 0.5;
      } else if (cv > 0) {
        presentDays += 1;
      } else {
        offDays += 1;
      }
      compLeavesEarned += cv;
      continue;
    }

    if (hasLeave && !rec) {
      leaveDays += 1;  // approved leave (counts toward leave balance offset)
      continue;
    }

    if (rec) {
      if (rec.status === 'present' || rec.status === 'permission') {
        presentDays += 1;
      } else if (rec.status === 'half_day') {
        presentDays += 0.5;
        halfDays += 1;
        leaveDays += 0.5;
      } else if (rec.status === 'leave') {
        leaveDays += 1;
      } else {
        absentDays += 1;
      }

      if (isLateCheckIn(rec, cfg)) {
        lateCount++;
      }

      if ((rec.status === 'present' || rec.status === 'permission') && rec.checkOut) {
        const co = new Date(rec.checkOut);
        const coMin = co.getHours() * 60 + co.getMinutes();
        if (coMin < shiftEndMin) {
          earlyOutHours += Math.max(0, (shiftEndMin - coMin) / 60);
        }
      }
      continue;
    }

    absentDays += 1;
  }

  let approvedLeaveDays = 0;
  for (const lr of leaveRequests) {
    if (lr.status === 'rejected') continue;
    const start = new Date(Math.max(new Date(lr.startDate).getTime(), new Date(year, month, firstDay).getTime()));
    const end = new Date(Math.min(new Date(lr.endDate).getTime(), new Date(year, month, lastCountableDay).getTime()));
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === cfg.weeklyOffDay) continue;
      approvedLeaveDays++;
    }
  }

  let permissionHours = 0;
  for (const pr of permissionRequests) {
    if (pr.status === 'rejected') continue;
    const d = new Date(pr.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    if (d.getDate() < firstDay || d.getDate() > lastCountableDay) continue;
    permissionHours += timeDiffHours(pr.fromTime, pr.toTime);
  }

  const permissionLeaveDays = cfg.workingHoursPerDay > 0
    ? Math.round((permissionHours / cfg.workingHoursPerDay) * 10) / 10
    : 0;

  return {
    presentDays,
    halfDays,
    absentDays,
    offDays,
    leaveDays,
    compLeavesEarned,
    lateCount,
    earlyOutHours,
    permissionLeaveDays,
    approvedLeaveDays,
  };
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

  const perDayRate = workingDays > 0 ? Math.round(baseSalary / workingDays) : 0;

  const summary = getMonthAttendanceSummary(
    attendanceRecords,
    leaveRequests,
    permissionRequests,
    year,
    month,
    joiningDate,
    c,
  );

  // ── Leave balance (cumulative, all-time) — for display ──
  const balanceResult = computeLeaveBalance(attendanceRecords, leaveRequests, joiningDate, c);
  const { earnedLeaveBalance, compBalance, freePermDays } = balanceResult;
  const leaveBalance = balanceResult.totalBalance;

  // Effective balance for paid/excess calc: exclude current month's typed leave usage
  // to prevent double-counting (those days are already counted in approvedLeaveDays)
  const effectiveBalanceResult = computeLeaveBalance(attendanceRecords, leaveRequests, joiningDate, c, { year, month });
  const effectiveBalance = effectiveBalanceResult.totalBalance;

  // ── Leave consumed this month ──

  // 1. Half-day informational leave (not salary deduction input)
  const halfDayLeave = summary.halfDays * 0.5;

  // 2. Permission leave days from canonical summary
  const permissionLeaveDays = summary.permissionLeaveDays;

  // 3. Approved leave request days from canonical summary
  const approvedLeaveDays = summary.approvedLeaveDays;

  // Informational leave consumed (for UI display only)
  const leaveConsumed = halfDayLeave + permissionLeaveDays + approvedLeaveDays;

  // ── Payroll penalties as per policy ──
  const latesPerHalfDay = c.latesPerHalfDay > 0 ? c.latesPerHalfDay : 3;
  const latePenaltyDays = Math.floor(summary.lateCount / latesPerHalfDay) * 0.5;
  const earlyOutDays = c.workingHoursPerDay > 0
    ? Math.round((summary.earlyOutHours / c.workingHoursPerDay) * 10) / 10
    : 0;

  // Balance days that can offset penalties: monthly allowance (earned leave) + comp balance
  const balanceDays = earnedLeaveBalance + compBalance;
  const penaltyDays = permissionLeaveDays + earlyOutDays + latePenaltyDays;
  const deductibleDays = Math.max(0, penaltyDays - balanceDays);

  // Keep legacy informational fields for UI compatibility
  const paidLeaves = Math.min(leaveConsumed, effectiveBalance);
  const excessLeaves = Math.max(0, leaveConsumed - effectiveBalance);

  // Salary is based on calendar present days only (half-day already contributes 0.5)
  // Deduct both penalties (offset by balance) and excess leaves (no balance to cover)
  const earnedDays = Math.max(0, summary.presentDays - deductibleDays - excessLeaves);
  const earnedSalary = Math.round(earnedDays * perDayRate);

  // ── Deductions ──
  const lateDeduction = Math.round(latePenaltyDays * perDayRate);
  const totalDeduction = Math.round(deductibleDays * perDayRate);

  // ── Incentive ──
  const incentivePercent = (cfg as any)?.incentivePercent ?? 0;
  const employeeSalesTotal = (cfg as any)?.employeeSalesTotal ?? 0;
  const incentiveAmount = incentivePercent > 0 && employeeSalesTotal > 0
    ? Math.round(employeeSalesTotal * incentivePercent / 100)
    : 0;

  const netSalary = Math.max(0, earnedSalary - totalDeduction + incentiveAmount);

  return {
    baseSalary,
    totalDaysInMonth: totalDays,
    weeklyOffs,
    workingDays,
    perDayRate,
    presentDays: summary.presentDays,
    halfDays: summary.halfDays,
    absentDays: summary.absentDays,
    offDays: summary.offDays,
    leaveDays: summary.leaveDays,
    compLeavesEarned: summary.compLeavesEarned,
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
    lateCount: summary.lateCount,
    latesPerHalfDay,
    latePenaltyDays,
    earlyOutHours: Math.round(summary.earlyOutHours * 10) / 10,
    earlyOutDays,
    penaltyDays,
    balanceDays,
    deductibleDays,
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
