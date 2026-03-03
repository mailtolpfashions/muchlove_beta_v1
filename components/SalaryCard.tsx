import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Banknote, TrendingDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { formatCurrency } from '@/utils/format';
import type { Attendance, LeaveRequest, PermissionRequest, EmployeeSalary } from '@/types';
import { calculateMonthlySalary } from '@/utils/salary';

interface SalaryCardProps {
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
  permissionRequests: PermissionRequest[];
  employeeSalaries: EmployeeSalary[];
  userId: string;
}

export default function SalaryCard({
  attendance,
  leaveRequests,
  permissionRequests,
  employeeSalaries,
  userId,
}: SalaryCardProps) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const currentSalary = useMemo(() => {
    const mySalaries = employeeSalaries
      .filter(s => s.employeeId === userId)
      .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
    // Find the most recent salary effective on or before today
    return mySalaries.find(s => new Date(s.effectiveFrom) <= now) ?? mySalaries[0] ?? null;
  }, [employeeSalaries, userId]);

  const breakdown = useMemo(() => {
    if (!currentSalary) return null;
    const myAttendance = attendance.filter(a => a.employeeId === userId);
    const myLeaves = leaveRequests.filter(lr => lr.employeeId === userId);
    const myPermissions = permissionRequests.filter(pr => pr.employeeId === userId);
    return calculateMonthlySalary(currentSalary.baseSalary, myAttendance, myLeaves, myPermissions, year, month);
  }, [currentSalary, attendance, leaveRequests, permissionRequests, userId, year, month]);

  if (!currentSalary) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Banknote size={18} color="#059669" />
          <Text style={styles.title}>Salary — {monthName}</Text>
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
      <View style={styles.header}>
        <Banknote size={18} color="#059669" />
        <Text style={styles.title}>Salary — {monthName}</Text>
      </View>

      {/* Net salary highlight */}
      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net Salary</Text>
        <Text style={styles.netValue}>{formatCurrency(breakdown.netSalary)}</Text>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdownSection}>
        <Row label="Base Salary" value={formatCurrency(breakdown.baseSalary)} />
        <Row label="Working Days" value={`${breakdown.workingDays} days`} />
        <Row label="Per Day / Per Hour" value={`${formatCurrency(breakdown.perDayRate)} / ${formatCurrency(breakdown.hourlyRate)}`} />
        <Divider />
        <Row label="Present" value={`${breakdown.presentDays} days`} color="#059669" />
        {breakdown.halfDays > 0 && <Row label="Half Days" value={`${breakdown.halfDays}`} color="#D97706" />}
        <Row label="Leaves Taken" value={`${breakdown.approvedLeaves} days`} color="#2563EB" />
        <Row label="Comp Earned / Used" value={`${breakdown.compLeavesEarned} / ${breakdown.compLeavesUsed}`} color="#7C3AED" />
        <Row label="Absent" value={`${breakdown.absentDays} days`} color="#DC2626" />
        <Divider />
        {breakdown.dayDeduction > 0 && (
          <Row label="Day Deduction" value={`-${formatCurrency(breakdown.dayDeduction)}`} color="#DC2626" isDeduction />
        )}
        {breakdown.totalPermissionHours > 0 && (
          <Row
            label={`Permission (${breakdown.totalPermissionHours.toFixed(1)}h, free: ${breakdown.freePermissionHours}h)`}
            value={breakdown.excessPermissionHours > 0 ? `-${formatCurrency(breakdown.permissionDeduction)}` : 'Free'}
            color={breakdown.excessPermissionHours > 0 ? '#DC2626' : '#059669'}
            isDeduction={breakdown.excessPermissionHours > 0}
          />
        )}
        {breakdown.totalShortHours > 0 && (
          <Row
            label={`Late/Early (${breakdown.totalShortHours.toFixed(1)}h)`}
            value={`-${formatCurrency(breakdown.shortHoursDeduction)}`}
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
      </View>
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
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
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
});
