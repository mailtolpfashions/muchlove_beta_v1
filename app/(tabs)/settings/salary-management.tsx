import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, IndianRupee, Edit2, X, Banknote, TrendingDown, Download } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useAlert } from '@/providers/AlertProvider';
import BottomSheetModal from '@/components/BottomSheetModal';
import DatePickerModal from '@/components/DatePickerModal';
import type { EmployeeSalary } from '@/types';
import { calculateMonthlySalary } from '@/utils/salary';
import { toLocalDateString, formatCurrency } from '@/utils/format';
import { shareSalarySlip } from '@/utils/salarySlip';

export default function SalaryManagementScreen() {
  const { user } = useAuth();
  const { users, employeeSalaries, attendance, leaveRequests, permissionRequests, sales, addEmployeeSalary, updateEmployeeSalary, reload, salonConfig } = useData();
  const { showAlert } = useAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [incentivePercent, setIncentivePercent] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Employee picker
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const employees = useMemo(
    () => users.filter((p: any) => p.role === 'employee'),
    [users],
  );

  // Group salaries by employee - latest first
  const employeeSalaryMap = useMemo(() => {
    const map = new Map<string, EmployeeSalary[]>();
    employeeSalaries.forEach(es => {
      const list = map.get(es.employeeId) ?? [];
      list.push(es);
      map.set(es.employeeId, list);
    });
    // Sort each list by effectiveFrom desc
    map.forEach((list) => {
      list.sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
    });
    return map;
  }, [employeeSalaries]);

  const { viewMonth, viewYear, viewMonthName } = useMemo(() => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
    return {
      viewMonth: d.getMonth(),
      viewYear: d.getFullYear(),
      viewMonthName: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  }, [monthOffset]);

  // Employee list with current salary and this month's calculation
  const employeeList = useMemo(() => {
    const month = viewMonth;
    const year = viewYear;

    return employees.map((emp: any) => {
      const salaryRecords = employeeSalaryMap.get(emp.id) ?? [];
      const currentSalary = salaryRecords[0] ?? null;

      // Calculate this month's salary
      // Compute employee's monthly sales total
      const empSalesTotal = sales
        .filter((s: any) => {
          if (s.employeeId !== emp.id) return false;
          const d = new Date(s.createdAt);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((sum: number, s: any) => sum + s.total, 0);

      const breakdown = currentSalary
        ? calculateMonthlySalary(
            currentSalary.baseSalary,
            attendance.filter((a: any) => a.employeeId === emp.id),
            leaveRequests.filter((lr: any) => lr.employeeId === emp.id),
            permissionRequests.filter((pr: any) => pr.employeeId === emp.id),
            year,
            month,
            emp.joiningDate,
            { ...salonConfig, incentivePercent: currentSalary.incentivePercent, employeeSalesTotal: empSalesTotal } as any,
          )
        : null;

      return {
        id: emp.id,
        name: emp.name,
        mobile: emp.mobile as string | undefined,
        joiningDate: emp.joiningDate as string | undefined,
        currentSalary,
        breakdown,
      };
    });
  }, [employees, employeeSalaryMap, attendance, leaveRequests, permissionRequests, sales, viewMonth, viewYear]);

  const handleOpenForm = (empId: string, existing?: EmployeeSalary) => {
    setSelectedEmployee(empId);
    if (existing) {
      setEditingId(existing.id);
      setSalaryAmount(existing.baseSalary.toString());
      setIncentivePercent(existing.incentivePercent > 0 ? existing.incentivePercent.toString() : '');
      setEffectiveFrom(new Date(existing.effectiveFrom));
    } else {
      setEditingId(null);
      setSalaryAmount('');
      setIncentivePercent('');
      setEffectiveFrom(new Date());
    }
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !salaryAmount || !effectiveFrom) {
      showAlert('Error', 'Please fill all fields');
      return;
    }
    const amount = parseFloat(salaryAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('Error', 'Please enter a valid salary amount');
      return;
    }
    setSubmitting(true);
    try {
      const empName = employees.find((e: any) => e.id === selectedEmployee)?.name ?? '';
      const incPct = parseFloat(incentivePercent) || 0;
      const payload = {
        employeeId: selectedEmployee,
        employeeName: empName,
        baseSalary: amount,
        incentivePercent: incPct,
        effectiveFrom: toLocalDateString(effectiveFrom),
      };
      if (editingId) {
        await updateEmployeeSalary({ id: editingId, ...payload });
      } else {
        await addEmployeeSalary(payload);
      }
      setShowForm(false);
      showAlert('Success', editingId ? 'Salary updated' : 'Salary configured');
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = useCallback((empId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedEmployee(prev => prev === empId ? null : empId);
  }, []);

  const handleDownloadSlip = async (empId: string, empName: string) => {
    const emp = employeeList.find(e => e.id === empId);
    if (!emp?.breakdown || !emp.currentSalary) return;
    setDownloadingId(empId);
    try {
      await shareSalarySlip({
        employeeName: empName,
        employeeMobile: emp?.mobile,
        month: viewMonth,
        year: viewYear,
        baseSalary: emp.currentSalary.baseSalary,
        effectiveFrom: emp.currentSalary.effectiveFrom,
        breakdown: emp.breakdown,
      });
    } catch { /* cancelled */ }
    setDownloadingId(null);
  };

  const renderEmployee = ({ item }: { item: typeof employeeList[0] }) => {
    const hasSalary = !!item.currentSalary;
    const isExpanded = expandedEmployee === item.id;
    const b = item.breakdown;

    // Check if selected month is before employee joining
    let isBeforeJoining = false;
    if (item.joiningDate) {
      const jd = new Date(item.joiningDate);
      isBeforeJoining = viewYear < jd.getFullYear() || (viewYear === jd.getFullYear() && viewMonth < jd.getMonth());
    }
    return (
      <View style={styles.empCard}>
        <TouchableOpacity
          style={styles.empHeader}
          onPress={() => hasSalary && toggleExpand(item.id)}
          activeOpacity={hasSalary ? 0.7 : 1}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{item.name}</Text>
            {hasSalary ? (
              <Text style={styles.empSalary}>
                Base: {formatCurrency(item.currentSalary!.baseSalary)}/month{item.currentSalary!.incentivePercent > 0 ? ` + ${item.currentSalary!.incentivePercent}% incentive` : ''}
              </Text>
            ) : (
              <Text style={styles.empNoSalary}>Salary not configured</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={() => handleDownloadSlip(item.id, item.name)}
              disabled={!hasSalary || downloadingId === item.id}
            >
              {downloadingId === item.id ? (
                <ActivityIndicator size={12} color="#059669" />
              ) : (
                <Download size={14} color={hasSalary ? '#059669' : Colors.textTertiary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => handleOpenForm(item.id, item.currentSalary ?? undefined)}
            >
              <Edit2 size={14} color={Colors.primary} />
              <Text style={styles.editText}>{hasSalary ? 'Edit' : 'Set'}</Text>
            </TouchableOpacity>
            {hasSalary && (
              isExpanded
                ? <ChevronUp size={16} color={Colors.textTertiary} />
                : <ChevronDown size={16} color={Colors.textTertiary} />
            )}
          </View>
        </TouchableOpacity>

        {hasSalary && !isExpanded && (
          isBeforeJoining ? (
            <View style={styles.salaryPreview}>
              <Text style={styles.noRecordText}>No record found</Text>
            </View>
          ) : b ? (
            <View style={styles.salaryPreview}>
              <Text style={styles.previewNet}>Net: {formatCurrency(b.netSalary)}</Text>
              {b.totalDeduction > 0 && (
                <Text style={styles.previewDeduct}>-{formatCurrency(b.totalDeduction)}</Text>
              )}
            </View>
          ) : null
        )}

        {hasSalary && b && isExpanded && !isBeforeJoining && (
          <View style={salaryStyles.container}>
            <View style={salaryStyles.header}>
              <Banknote size={16} color="#059669" />
              <Text style={salaryStyles.title}>Salary — {viewMonthName}</Text>
            </View>

            <View style={salaryStyles.netRow}>
              <Text style={salaryStyles.netLabel}>Net Payable</Text>
              <Text style={salaryStyles.netValue}>{formatCurrency(b.netSalary)}</Text>
            </View>

            <View style={salaryStyles.breakdownSection}>
              <SalaryRow label="Base Salary" value={formatCurrency(b.baseSalary)} />
              <SalaryRow label="Working Days" value={`${b.workingDays} days`} />
              <SalaryRow label="Per Day Rate" value={formatCurrency(b.perDayRate)} />
              <SalaryDivider />
              <SalaryRow label="Present" value={`${b.presentDays} days`} color="#059669" />
              {b.halfDays > 0 && <SalaryRow label="Half Days" value={`${b.halfDays} (×0.5)`} color="#D97706" />}
              {b.paidLeaves > 0 && <SalaryRow label="Paid Leaves" value={`${parseFloat(b.paidLeaves.toFixed(1))} days`} color="#7C3AED" />}
              <SalaryRow label="Earned Days" value={`${b.earnedDays} days`} color="#059669" />
              <SalaryRow label="Earned Salary" value={formatCurrency(b.earnedSalary)} color="#059669" />
              <SalaryDivider />
              <SalaryRow label="Absent" value={`${b.absentDays} days`} color="#DC2626" />
              <SalaryRow label="Leave Balance" value={`${parseFloat(b.leaveBalance.toFixed(1))} (EL:${parseFloat(b.earnedLeaveBalance.toFixed(1))} C:${parseFloat(b.compBalance.toFixed(1))} P:${parseFloat(b.freePermDays.toFixed(1))})`} color="#059669" />
              <SalaryRow label="Leave Used" value={`${parseFloat(b.leaveConsumed.toFixed(1))} days`} color="#EA580C" />
              {b.leaveConsumed > 0 && (
                <View style={salaryStyles.leaveBreakdown}>
                  {b.approvedLeaveDays > 0 && <Text style={salaryStyles.leaveBreakdownText}>• Leave Req: {b.approvedLeaveDays}d</Text>}
                  {b.halfDayLeave > 0 && <Text style={salaryStyles.leaveBreakdownText}>• Half Day: {parseFloat(b.halfDayLeave.toFixed(1))}d</Text>}
                  {b.permissionLeaveDays > 0 && <Text style={salaryStyles.leaveBreakdownText}>• Permission: {parseFloat(b.permissionLeaveDays.toFixed(1))}d</Text>}
                </View>
              )}
              {b.excessLeaves > 0 && <SalaryRow label="Excess Leaves" value={`${parseFloat(b.excessLeaves.toFixed(1))} days`} color="#DC2626" />}
              <SalaryRow label="Comp Earned" value={`${b.compLeavesEarned} days`} color="#7C3AED" />
              {b.lateCount > 0 && b.latePenaltyDays > 0 && (
                <SalaryRow
                  label={`Late Penalty (${b.lateCount} lates → ${b.latePenaltyDays}d)`}
                  value={`-${formatCurrency(b.lateDeduction)}`}
                  color="#DC2626"
                  isDeduction
                />
              )}
              {b.totalDeduction > 0 && (
                <>
                  <SalaryDivider />
                  <View style={salaryStyles.totalDeductionRow}>
                    <TrendingDown size={14} color="#DC2626" />
                    <Text style={salaryStyles.totalDeductionLabel}>Total Deduction</Text>
                    <Text style={salaryStyles.totalDeductionValue}>-{formatCurrency(b.totalDeduction)}</Text>
                  </View>
                </>
              )}
              {b.incentiveAmount > 0 && (
                <>
                  <SalaryDivider />
                  <SalaryRow
                    label={`Sales Incentive (${b.incentivePercent}% of ${formatCurrency(b.employeeSalesTotal)})`}
                    value={`+${formatCurrency(b.incentiveAmount)}`}
                    color="#059669"
                  />
                </>
              )}
            </View>

            <Text style={salaryStyles.effectiveLabel}>
              Effective from {new Date(item.currentSalary!.effectiveFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
          </View>
        )}

        {hasSalary && isExpanded && isBeforeJoining && (
          <View style={styles.noRecordContainer}>
            <Text style={styles.noRecordText}>No record found</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={employeeList}
        keyExtractor={item => item.id}
        renderItem={renderEmployee}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setMonthOffset(o => Math.max(o - 1, -2))}
              disabled={monthOffset <= -2}
              style={[styles.monthArrow, monthOffset <= -2 && { opacity: 0.3 }]}
            >
              <ChevronLeft size={18} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{viewMonthName}</Text>
            <TouchableOpacity
              onPress={() => setMonthOffset(o => Math.min(o + 1, 0))}
              disabled={monthOffset >= 0}
              style={[styles.monthArrow, monthOffset >= 0 && { opacity: 0.3 }]}
            >
              <ChevronRight size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No employees found</Text>
          </View>
        }
      />

      {/* Salary Form */}
      <BottomSheetModal visible={showForm} onRequestClose={() => setShowForm(false)}>
        <View style={styles.formHeader}>
          <View>
            <Text style={styles.formTitle}>{editingId ? 'Update Salary' : 'Set Salary'}</Text>
            <Text style={styles.formSubtitle}>
              {employees.find((e: any) => e.id === selectedEmployee)?.name ?? 'Employee'}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowForm(false)}>
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Base Salary (₹/month) *</Text>
          <View style={styles.salaryInputRow}>
            <IndianRupee size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.salaryInput}
              value={salaryAmount}
              onChangeText={setSalaryAmount}
              placeholder="e.g. 6000"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.fieldLabel}>Incentive on Sales (%)</Text>
          <View style={styles.salaryInputRow}>
            <TextInput
              style={styles.salaryInput}
              value={incentivePercent}
              onChangeText={setIncentivePercent}
              placeholder="e.g. 5"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
            />
            <Text style={{ color: Colors.textTertiary, fontSize: FontSize.body }}>%</Text>
          </View>

          <Text style={styles.fieldLabel}>Effective From *</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
            <Text style={effectiveFrom ? styles.dateText : styles.datePlaceholder}>
              {effectiveFrom
                ? effectiveFrom.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Select date'}
            </Text>
            <ChevronDown size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>{editingId ? 'Update Salary' : 'Save Salary'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      <DatePickerModal
        visible={showDatePicker}
        value={effectiveFrom}
        title="Effective From"
        onSelect={(d) => { setEffectiveFrom(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.screen,
    paddingBottom: 100,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    gap: 12,
  },
  monthArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  monthLabel: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 140,
    textAlign: 'center',
  },
  empCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  empHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  salaryPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  previewNet: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#059669',
  },
  previewDeduct: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: '#DC2626',
  },
  empName: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.text,
  },
  empSalary: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  empNoSalary: {
    fontSize: FontSize.sm,
    color: '#D97706',
    marginTop: 2,
    fontStyle: 'italic',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '12',
  },
  editText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  noRecordContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
  noRecordText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  downloadBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: FontSize.body,
    color: Colors.textTertiary,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  formTitle: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: Spacing.md,
  },
  salaryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    gap: 8,
  },
  salaryInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateText: {
    fontSize: FontSize.body,
    color: Colors.text,
  },
  datePlaceholder: {
    fontSize: FontSize.body,
    color: Colors.textTertiary,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.body,
  },
});

// ── Salary Breakdown helpers ──────────────────────────────────

function SalaryRow({ label, value, color, isDeduction }: { label: string; value: string; color?: string; isDeduction?: boolean }) {
  return (
    <View style={salaryStyles.row}>
      <Text style={salaryStyles.rowLabel}>{label}</Text>
      <Text style={[salaryStyles.rowValue, color ? { color } : null, isDeduction ? { fontWeight: '700' } : null]}>{value}</Text>
    </View>
  );
}

function SalaryDivider() {
  return <View style={salaryStyles.divider} />;
}

const salaryStyles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  netLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#059669',
  },
  netValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#059669',
  },
  breakdownSection: {
    gap: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  rowValue: {
    fontSize: FontSize.xs,
    color: Colors.text,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginVertical: 3,
  },
  totalDeductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  totalDeductionLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#DC2626',
  },
  totalDeductionValue: {
    fontSize: FontSize.body,
    fontWeight: '800',
    color: '#DC2626',
  },
  effectiveLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
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
