import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Banknote, TrendingDown, Download, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import type { Attendance, LeaveRequest, PermissionRequest, EmployeeSalary, Sale } from '@/types';
import { calculateMonthlySalary } from '@/utils/salary';
import { shareSalarySlip } from '@/utils/salarySlip';
import { useData } from '@/providers/DataProvider';

interface SalaryCardProps {
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
  permissionRequests: PermissionRequest[];
  employeeSalaries: EmployeeSalary[];
  sales: Sale[];
  userId: string;
  joiningDate?: string;
  userName?: string;
  userMobile?: string;
}

export default function SalaryCard({
  attendance,
  leaveRequests,
  permissionRequests,
  employeeSalaries,
  sales,
  userId,
  joiningDate,
  userName,
  userMobile,
}: SalaryCardProps) {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current, -1 = last, -2 = two months ago
  const { salonConfig } = useData();

  const { month, year, monthName } = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return {
      month: d.getMonth(),
      year: d.getFullYear(),
      monthName: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  }, [monthOffset]);

  const currentSalary = useMemo(() => {
    const mySalaries = employeeSalaries
      .filter(s => s.employeeId === userId)
      .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
    const ref = new Date(year, month + 1, 0); // end of selected month
    return mySalaries.find(s => new Date(s.effectiveFrom) <= ref) ?? mySalaries[0] ?? null;
  }, [employeeSalaries, userId, month, year]);

  const breakdown = useMemo(() => {
    if (!currentSalary) return null;
    const myAttendance = attendance.filter(a => a.employeeId === userId);
    const myLeaves = leaveRequests.filter(lr => lr.employeeId === userId);
    const myPermissions = permissionRequests.filter(pr => pr.employeeId === userId);
    // Compute employee's monthly sales total
    const mySalesTotal = sales
      .filter(s => {
        if (s.employeeId !== userId) return false;
        const d = new Date(s.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, s) => sum + s.total, 0);
    return calculateMonthlySalary(
      currentSalary.baseSalary, myAttendance, myLeaves, myPermissions, year, month, joiningDate,
      { ...salonConfig, incentivePercent: currentSalary.incentivePercent, employeeSalesTotal: mySalesTotal } as any,
    );
  }, [currentSalary, attendance, leaveRequests, permissionRequests, sales, userId, year, month, salonConfig]);

  // Check if selected month is before joining
  const isBeforeJoining = useMemo(() => {
    if (!joiningDate) return false;
    const jd = new Date(joiningDate);
    const joinMonth = jd.getMonth();
    const joinYear = jd.getFullYear();
    // Selected month is before the joining month
    return year < joinYear || (year === joinYear && month < joinMonth);
  }, [joiningDate, month, year]);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!breakdown || !currentSalary) return;
    setDownloading(true);
    try {
      await shareSalarySlip({
        employeeName: userName || 'My',
        employeeMobile: userMobile,
        month,
        year,
        baseSalary: currentSalary.baseSalary,
        effectiveFrom: currentSalary.effectiveFrom,
        breakdown,
      });
    } catch { /* cancelled */ }
    setDownloading(false);
  };

  if (!currentSalary) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Banknote size={18} color="#059669" />
          <Text style={styles.title}>Salary</Text>
        </View>
        <View style={styles.notConfigured}>
          <Text style={styles.notConfiguredText}>Salary not configured. Contact admin.</Text>
        </View>
      </View>
    );
  }

  if (!breakdown) return null;

  return (
    <View style={styles.card}>
      {/* Header with month navigation */}
      <View style={styles.header}>
        <Banknote size={18} color="#059669" />
        <Text style={styles.title}>Salary</Text>
        <View style={{ flex: 1 }} />
        {!isBeforeJoining && (
          <TouchableOpacity
            onPress={handleDownload}
            disabled={downloading}
            style={styles.downloadBtn}
          >
            {downloading ? (
              <ActivityIndicator size={14} color="#059669" />
            ) : (
              <Download size={16} color="#059669" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Month selector */}
      <View style={styles.monthNav}>
        <TouchableOpacity
          onPress={() => setMonthOffset(o => Math.max(o - 1, -2))}
          disabled={monthOffset <= -2}
          style={[styles.monthArrow, monthOffset <= -2 && { opacity: 0.3 }]}
        >
          <ChevronLeft size={18} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthName}</Text>
        <TouchableOpacity
          onPress={() => setMonthOffset(o => Math.min(o + 1, 0))}
          disabled={monthOffset >= 0}
          style={[styles.monthArrow, monthOffset >= 0 && { opacity: 0.3 }]}
        >
          <ChevronRight size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {isBeforeJoining ? (
        <View style={styles.noRecord}>
          <Text style={styles.noRecordText}>No record found</Text>
        </View>
      ) : (
        <>
      {/* Net payable highlight */}
      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net Payable</Text>
        <Text style={styles.netValue}>{formatCurrency(breakdown.netSalary)}</Text>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdownSection}>
        <Row label="Base Salary" value={formatCurrency(breakdown.baseSalary)} />
        <Row label="Working Days" value={`${breakdown.workingDays} days`} />
        <Row label="Per Day Rate" value={formatCurrency(breakdown.perDayRate)} />
        <Divider />
        <Row label="Present" value={`${parseFloat(breakdown.presentDays.toFixed(1))} days`} color="#059669" />
        {breakdown.halfDays > 0 && <Row label="Half Days" value={`${breakdown.halfDays} (×0.5)`} color="#D97706" />}
        <Row label="Off" value={`${parseFloat(breakdown.offDays.toFixed(1))} days`} color="#3730A3" />
        <Row label="Leave" value={`${parseFloat(breakdown.leaveDays.toFixed(1))} days`} color="#EA580C" />
        <Row label="Earned Days" value={`${parseFloat(breakdown.earnedDays.toFixed(1))} days`} color="#059669" />
        <Row label="Earned Salary" value={formatCurrency(breakdown.earnedSalary)} color="#059669" />
        <Divider />
        <Row label="Absent" value={`${parseFloat(breakdown.absentDays.toFixed(1))} days`} color="#DC2626" />
        <Row label="Leave Balance" value={`${parseFloat(breakdown.leaveBalance.toFixed(1))} (EL:${parseFloat(breakdown.earnedLeaveBalance.toFixed(1))} C:${parseFloat(breakdown.compBalance.toFixed(1))} P:${parseFloat(breakdown.freePermDays.toFixed(1))})`} color="#059669" />
        <Row
          label="Leave Used"
          value={`${parseFloat(breakdown.leaveConsumed.toFixed(1))} days`}
          color="#EA580C"
        />
        {breakdown.leaveConsumed > 0 && (
          <View style={styles.leaveBreakdown}>
            {breakdown.approvedLeaveDays > 0 && (
              <Text style={styles.leaveBreakdownText}>• Leave Req: {breakdown.approvedLeaveDays}d</Text>
            )}
            {breakdown.halfDayLeave > 0 && (
              <Text style={styles.leaveBreakdownText}>• Half Day: {parseFloat(breakdown.halfDayLeave.toFixed(1))}d</Text>
            )}
            {breakdown.permissionLeaveDays > 0 && (
              <Text style={styles.leaveBreakdownText}>• Permission: {parseFloat(breakdown.permissionLeaveDays.toFixed(1))}d</Text>
            )}
          </View>
        )}
        {breakdown.excessLeaves > 0 && <Row label="Excess Leaves" value={`${parseFloat(breakdown.excessLeaves.toFixed(1))} days`} color="#DC2626" />}
        <Row label="Comp Earned" value={`${breakdown.compLeavesEarned} days`} color="#7C3AED" />
        {breakdown.lateCount > 0 && breakdown.latePenaltyDays > 0 && (
          <Row
            label={`Late Penalty (${breakdown.lateCount} lates → ${breakdown.latePenaltyDays}d)`}
            value={`-${formatCurrency(breakdown.lateDeduction)}`}
            color="#DC2626"
            isDeduction
          />
        )}
        {breakdown.totalDeduction > 0 && (
          <>
            <Divider />
            <View style={styles.totalDeductionRow}>
              <TrendingDown size={14} color="#DC2626" />
              <Text style={styles.totalDeductionLabel}>Total Deduction</Text>
              <Text style={styles.totalDeductionValue}>-{formatCurrency(breakdown.totalDeduction)}</Text>
            </View>
          </>
        )}
        {breakdown.incentiveAmount > 0 && (
          <>
            <Divider />
            <Row
              label={`Sales Incentive (${breakdown.incentivePercent}% of ${formatCurrency(breakdown.employeeSalesTotal)})`}
              value={`+${formatCurrency(breakdown.incentiveAmount)}`}
              color="#059669"
            />
          </>
        )}
      </View>
        </>
      )}
    </View>
  );
}

function Row({ label, value, color, isDeduction }: { label: string; value: string; color?: string; isDeduction?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color ? { color } : null, isDeduction ? styles.deductionValue : null]}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  downloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    gap: 12,
  },
  monthArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 140,
    textAlign: 'center',
  },
  notConfigured: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
  },
  notConfiguredText: {
    fontSize: FontSize.body,
    color: '#E65100',
    fontWeight: '500',
  },
  noRecord: {
    backgroundColor: Colors.inputBg,
    paddingVertical: 20,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  noRecordText: {
    fontSize: FontSize.body,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  netLabel: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: '#059669',
  },
  netValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: '#059669',
  },
  breakdownSection: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  rowValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  deductionValue: {
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  totalDeductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  totalDeductionLabel: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: '#DC2626',
  },
  totalDeductionValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#DC2626',
  },
  leaveBreakdown: {
    paddingLeft: 12,
    paddingBottom: 4,
    marginTop: -2,
  },
  leaveBreakdownText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
});
