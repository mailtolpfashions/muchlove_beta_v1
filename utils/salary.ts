import type { Attendance, LeaveRequest, PermissionRequest } from '@/types';

// ── Constants ───────────────────────────────────────────────

/** Weekly off day — 2 = Tuesday (JS Date.getDay(): 0=Sun,1=Mon,2=Tue…) */
export const WEEKLY_OFF_DAY = 2; // Tuesday

/** Shift timings */
export const SHIFT_START_HOUR = 9;  // 9:00 AM
export const SHIFT_START_MIN = 0;
export const SHIFT_END_HOUR = 20;   // 8:00 PM
export const SHIFT_END_MIN = 0;

/** Working hours per day (11hr shift minus 2hr lunch) */
export const WORKING_HOURS_PER_DAY = 9;

/** Grace period for late punch-in (minutes) */
export const GRACE_MINUTES = 15;

/** Free permission hours per month */
export const FREE_PERMISSION_HOURS = 2;

// ── Helpers ─────────────────────────────────────────────────

/** Count how many times a specific weekday occurs in a given month/year */
function countWeekdayInMonth(year: number, month: number, weekday: number): number {
  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month, d).getDay() === weekday) count++;
  }
  return count;
}

/** Get total days in a month */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Check if a date string falls on the weekly off day (Tuesday) */
export function isWeeklyOff(dateStr: string): boolean {
  return new Date(dateStr).getDay() === WEEKLY_OFF_DAY;
}

/** Returns comp leave value for a weekly-off attendance record: 1 (full day), 0.5 (half day), or 0 */
export function compLeaveValue(record: Attendance): number {
  if (!isWeeklyOff(record.date) || !record.checkIn || !record.checkOut) return 0;
  // Use actual hours worked to determine comp value
  const ci = new Date(record.checkIn);
  const co = new Date(record.checkOut);
  const workedHours = (co.getTime() - ci.getTime()) / (1000 * 60 * 60);
  if (workedHours >= WORKING_HOURS_PER_DAY) return 1;
  if (workedHours >= WORKING_HOURS_PER_DAY / 2) return 0.5;
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

// ── Late / Early Calculation ────────────────────────────────

export interface PunchShortage {
  lateMinutes: number;
  earlyMinutes: number;
  totalShortHours: number;
}

/** Calculate how many minutes late (after grace) and minutes early for a single attendance record */
export function calculatePunchShortage(record: Attendance): PunchShortage {
  let lateMinutes = 0;
  let earlyMinutes = 0;

  if (record.checkIn) {
    const checkIn = new Date(record.checkIn);
    const shiftStartWithGrace = SHIFT_START_HOUR * 60 + SHIFT_START_MIN + GRACE_MINUTES;
    const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();
    if (checkInMinutes > shiftStartWithGrace) {
      // Late = total minutes from shift start (not from grace end)
      lateMinutes = checkInMinutes - (SHIFT_START_HOUR * 60 + SHIFT_START_MIN);
    }
  }

  if (record.checkOut) {
    const checkOut = new Date(record.checkOut);
    const shiftEndMinutes = SHIFT_END_HOUR * 60 + SHIFT_END_MIN;
    const checkOutMinutes = checkOut.getHours() * 60 + checkOut.getMinutes();
    if (checkOutMinutes < shiftEndMinutes) {
      earlyMinutes = shiftEndMinutes - checkOutMinutes;
    }
  }

  return {
    lateMinutes,
    earlyMinutes,
    totalShortHours: (lateMinutes + earlyMinutes) / 60,
  };
}

// ── Monthly Salary Calculation ──────────────────────────────

export interface SalaryBreakdown {
  baseSalary: number;
  totalDaysInMonth: number;
  weeklyOffs: number;
  workingDays: number;
  perDayRate: number;
  hourlyRate: number;
  presentDays: number;
  halfDays: number;
  approvedLeaves: number;
  approvedCompLeaves: number;
  approvedPermissions: number;
  absentDays: number;
  compLeavesEarned: number;
  compLeavesUsed: number;
  totalPermissionHours: number;
  freePermissionHours: number;
  excessPermissionHours: number;
  totalLateMinutes: number;
  totalEarlyMinutes: number;
  totalShortHours: number;
  dayDeduction: number;
  permissionDeduction: number;
  shortHoursDeduction: number;
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
): SalaryBreakdown {
  const totalDays = daysInMonth(year, month);
  const weeklyOffs = countWeekdayInMonth(year, month, WEEKLY_OFF_DAY);
  const workingDays = totalDays - weeklyOffs;

  const perDayRate = workingDays > 0 ? baseSalary / workingDays : 0;
  const hourlyRate = workingDays > 0 ? baseSalary / (workingDays * WORKING_HOURS_PER_DAY) : 0;

  // Filter records for this employee's month
  const monthRecords = attendanceRecords.filter(r => {
    const d = new Date(r.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const monthLeaves = leaveRequests.filter(lr => {
    const start = new Date(lr.startDate);
    const end = new Date(lr.endDate);
    // Overlaps with this month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    return start <= monthEnd && end >= monthStart;
  });

  const monthPermissions = permissionRequests.filter(pr => {
    const d = new Date(pr.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Count present, half_day, permission attendance
  let presentDays = 0;
  let halfDays = 0;
  let permissionAttendanceDays = 0;
  let compLeavesEarned = 0;
  let totalLateMinutes = 0;
  let totalEarlyMinutes = 0;

  for (const record of monthRecords) {
    // Check if this is a Tuesday (weekly off) — earns comp leave (full or half) based on hours worked
    if (isWeeklyOff(record.date)) {
      compLeavesEarned += compLeaveValue(record);
      continue; // Don't count Tuesday attendance in regular present count
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

    // Calculate punch shortage
    if (record.checkIn || record.checkOut) {
      const shortage = calculatePunchShortage(record);
      totalLateMinutes += shortage.lateMinutes;
      totalEarlyMinutes += shortage.earlyMinutes;
    }
  }

  // Count approved leaves (all types)
  let approvedLeaves = 0;
  let approvedCompLeaves = 0;
  for (const lr of monthLeaves) {
    if (lr.status !== 'approved') continue;
    const start = new Date(Math.max(new Date(lr.startDate).getTime(), new Date(year, month, 1).getTime()));
    const end = new Date(Math.min(new Date(lr.endDate).getTime(), new Date(year, month + 1, 0).getTime()));
    let days = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== WEEKLY_OFF_DAY) days++; // Don't count weekly offs within leave range
    }
    if (lr.type === 'compensation') {
      approvedCompLeaves += days;
    } else {
      approvedLeaves += days;
    }
  }

  // Comp leaves used = approved compensation leave days
  const compLeavesUsed = approvedCompLeaves;

  // Count approved permission hours
  let totalPermissionHours = 0;
  const approvedPermissions = monthPermissions.filter(p => p.status === 'approved').length;
  for (const pr of monthPermissions) {
    if (pr.status !== 'approved') continue;
    totalPermissionHours += timeDiffHours(pr.fromTime, pr.toTime);
  }

  const freePermissionHours = FREE_PERMISSION_HOURS;
  const excessPermissionHours = Math.max(0, totalPermissionHours - freePermissionHours);

  // Calculate absent days
  // Total accounted for: present + half (0.5 each) + approved leaves + comp leaves used
  // Today or future dates in the month shouldn't be counted as absent
  const today = new Date();
  const lastCountableDay = Math.min(
    totalDays,
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : totalDays,
  );

  // Count actual working days up to lastCountableDay
  let workingDaysSoFar = 0;
  for (let d = 1; d <= lastCountableDay; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() !== WEEKLY_OFF_DAY) workingDaysSoFar++;
  }

  const accountedDays = presentDays + (halfDays * 0.5) + approvedLeaves + compLeavesUsed;
  const absentDays = Math.max(0, workingDaysSoFar - accountedDays);

  // Deductions
  // 1. Day deduction: absent days + leave days + half days (0.5) - comp leaves used
  const deductibleDays = absentDays + approvedLeaves + (halfDays * 0.5) - compLeavesUsed;
  const dayDeduction = Math.max(0, deductibleDays) * perDayRate;

  // 2. Permission deduction: excess hours beyond free allowance
  const permissionDeduction = excessPermissionHours * hourlyRate;

  // 3. Short hours deduction: late punch-in + early punch-out
  const totalShortHours = (totalLateMinutes + totalEarlyMinutes) / 60;
  const shortHoursDeduction = totalShortHours * hourlyRate;

  const totalDeduction = dayDeduction + permissionDeduction + shortHoursDeduction;
  const netSalary = Math.max(0, baseSalary - totalDeduction);

  return {
    baseSalary,
    totalDaysInMonth: totalDays,
    weeklyOffs,
    workingDays,
    perDayRate,
    hourlyRate,
    presentDays,
    halfDays,
    approvedLeaves,
    approvedCompLeaves,
    approvedPermissions,
    absentDays,
    compLeavesEarned,
    compLeavesUsed,
    totalPermissionHours,
    freePermissionHours,
    excessPermissionHours,
    totalLateMinutes,
    totalEarlyMinutes,
    totalShortHours,
    dayDeduction,
    permissionDeduction,
    shortHoursDeduction,
    totalDeduction,
    netSalary,
  };
}
