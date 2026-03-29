/**
 * Admin Salary Management — per-employee salary CRUD, monthly breakdown.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Edit2,
  X,
  Banknote,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { StatCard } from '@/components/web/StatCard';
import { useAlert } from '@/providers/AlertProvider';
import { calculateMonthlySalary, SalaryBreakdown } from '@/utils/salary';
import { formatCurrency, toLocalDateString } from '@/utils/format';
import type { EmployeeSalary } from '@/types';

export default function AdminSalaryManagement() {
  const {
    users,
    employeeSalaries,
    attendance,
    leaveRequests,
    permissionRequests,
    sales,
    addEmployeeSalary,
    updateEmployeeSalary,
    salonConfig,
  } = useData();
  const { showAlert } = useAlert();

  const [monthOffset, setMonthOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [incentivePercent, setIncentivePercent] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const employees = useMemo(
    () => users.filter((p: any) => p.role === 'employee'),
    [users],
  );

  const employeeSalaryMap = useMemo(() => {
    const map = new Map<string, EmployeeSalary[]>();
    employeeSalaries.forEach(es => {
      const list = map.get(es.employeeId) ?? [];
      list.push(es);
      map.set(es.employeeId, list);
    });
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

  const employeeList = useMemo(() => {
    return employees.map((emp: any) => {
      const salaryRecords = employeeSalaryMap.get(emp.id) ?? [];
      const currentSalary = salaryRecords[0] ?? null;
      const empSalesTotal = sales
        .filter((s: any) => {
          if (s.employeeId !== emp.id) return false;
          const d = new Date(s.createdAt);
          return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
        })
        .reduce((sum: number, s: any) => sum + s.total, 0);

      const breakdown: SalaryBreakdown | null = currentSalary
        ? calculateMonthlySalary(
            currentSalary.baseSalary,
            attendance.filter((a: any) => a.employeeId === emp.id),
            leaveRequests.filter((lr: any) => lr.employeeId === emp.id),
            permissionRequests.filter((pr: any) => pr.employeeId === emp.id),
            viewYear,
            viewMonth,
            emp.joiningDate,
            { ...salonConfig, incentivePercent: currentSalary.incentivePercent, employeeSalesTotal: empSalesTotal } as any,
          )
        : null;

      let isBeforeJoining = false;
      if (emp.joiningDate) {
        const jd = new Date(emp.joiningDate);
        isBeforeJoining = viewYear < jd.getFullYear() || (viewYear === jd.getFullYear() && viewMonth < jd.getMonth());
      }

      return {
        id: emp.id,
        name: emp.name,
        mobile: emp.mobile as string | undefined,
        joiningDate: emp.joiningDate as string | undefined,
        currentSalary,
        breakdown,
        isBeforeJoining,
      };
    });
  }, [employees, employeeSalaryMap, attendance, leaveRequests, permissionRequests, sales, viewMonth, viewYear, salonConfig]);

  // Stats
  const totalPayroll = employeeList.reduce((s, e) => s + (e.breakdown?.netSalary || 0), 0);
  const configuredCount = employeeList.filter(e => e.currentSalary).length;

  // Form handlers
  const openForm = (empId: string, existing?: EmployeeSalary) => {
    setSelectedEmployee(empId);
    if (existing) {
      setEditingId(existing.id);
      setSalaryAmount(existing.baseSalary.toString());
      setIncentivePercent(existing.incentivePercent > 0 ? existing.incentivePercent.toString() : '');
      setEffectiveFrom(existing.effectiveFrom);
    } else {
      setEditingId(null);
      setSalaryAmount('');
      setIncentivePercent('');
      setEffectiveFrom(toLocalDateString(new Date()));
    }
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !salaryAmount || !effectiveFrom) {
      showAlert('Error', 'Please fill all required fields');
      return;
    }
    const amount = parseFloat(salaryAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('Error', 'Enter a valid salary amount');
      return;
    }
    try {
      const empName = employees.find((e: any) => e.id === selectedEmployee)?.name ?? '';
      const payload = {
        employeeId: selectedEmployee,
        employeeName: empName,
        baseSalary: amount,
        incentivePercent: parseFloat(incentivePercent) || 0,
        effectiveFrom,
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
    }
  };

  const SalaryRow = ({ label, value, color, isDeduction }: { label: string; value: string; color?: string; isDeduction?: boolean }) => (
    <View style={s.bRow}>
      <Text style={[s.bLabel, color ? { color } : null]}>{label}</Text>
      <Text style={[s.bValue, color ? { color } : null, isDeduction && s.bDeduction]}>{value}</Text>
    </View>
  );

  return (
    <AnimatedPage>
      {/* Stats */}
      <View style={s.statsRow}>
        <StatCard icon={<Banknote size={22} color="#059669" />} label="Month Payroll" value={totalPayroll} prefix="₹" gradient={WebColors.gradientRevenue} />
        <StatCard icon={<Users size={22} color="#0EA5E9" />} label="Configured" value={configuredCount} gradient={WebColors.gradientStaff} />
      </View>

      {/* Month Navigation */}
      <View style={s.monthNav}>
        <Pressable onPress={() => setMonthOffset(o => Math.max(o - 1, -2))} disabled={monthOffset <= -2} style={[s.monthArrow, monthOffset <= -2 && { opacity: 0.3 }]}>
          <ChevronLeft size={18} color={Colors.text} />
        </Pressable>
        <Text style={s.monthLabel}>{viewMonthName}</Text>
        <Pressable onPress={() => setMonthOffset(o => Math.min(o + 1, 0))} disabled={monthOffset >= 0} style={[s.monthArrow, monthOffset >= 0 && { opacity: 0.3 }]}>
          <ChevronRight size={18} color={Colors.text} />
        </Pressable>
      </View>

      {/* Employee Cards */}
      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {employeeList.length === 0 && (
          <View style={s.emptyState}>
            <Users size={48} color={Colors.textTertiary} />
            <Text style={s.emptyText}>No employees found</Text>
          </View>
        )}
        {employeeList.map(emp => {
          const hasSalary = !!emp.currentSalary;
          const isExpanded = expandedId === emp.id;
          const b = emp.breakdown;

          return (
            <View key={emp.id} style={s.empCard}>
              {/* Header */}
              <Pressable style={s.empHeader} onPress={() => hasSalary && setExpandedId(prev => prev === emp.id ? null : emp.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.empName}>{emp.name}</Text>
                  {hasSalary ? (
                    <Text style={s.empSalary}>
                      Base: ₹{formatCurrency(emp.currentSalary!.baseSalary)}/month
                      {emp.currentSalary!.incentivePercent > 0 ? ` + ${emp.currentSalary!.incentivePercent}% incentive` : ''}
                    </Text>
                  ) : (
                    <Text style={s.empNoSalary}>Salary not configured</Text>
                  )}
                </View>
                <View style={s.empActions}>
                  <Pressable style={s.editBtn} onPress={() => openForm(emp.id, emp.currentSalary ?? undefined)}>
                    <Edit2 size={14} color={Colors.primary} />
                    <Text style={s.editText}>{hasSalary ? 'Edit' : 'Set'}</Text>
                  </Pressable>
                  {hasSalary && (isExpanded ? <ChevronUp size={16} color={Colors.textTertiary} /> : <ChevronDown size={16} color={Colors.textTertiary} />)}
                </View>
              </Pressable>

              {/* Preview (when collapsed) */}
              {hasSalary && !isExpanded && !emp.isBeforeJoining && b && (
                <View style={s.salaryPreview}>
                  <Text style={s.previewNet}>Net: ₹{formatCurrency(b.netSalary)}</Text>
                  {b.totalDeduction > 0 && <Text style={s.previewDeduct}>-₹{formatCurrency(b.totalDeduction)}</Text>}
                </View>
              )}
              {hasSalary && !isExpanded && emp.isBeforeJoining && (
                <Text style={s.noRecordText}>No record found</Text>
              )}

              {/* Expanded Breakdown */}
              {hasSalary && isExpanded && !emp.isBeforeJoining && b && (
                <View style={s.breakdownCard}>
                  <View style={s.breakdownHeader}>
                    <Banknote size={16} color="#059669" />
                    <Text style={s.breakdownTitle}>Salary — {viewMonthName}</Text>
                  </View>

                  <View style={s.netRow}>
                    <Text style={s.netLabel}>Net Payable</Text>
                    <Text style={s.netValue}>₹{formatCurrency(b.netSalary)}</Text>
                  </View>

                  <View style={s.breakdownBody}>
                    <SalaryRow label="Base Salary" value={`₹${formatCurrency(b.baseSalary)}`} />
                    <SalaryRow label="Working Days" value={`${b.workingDays} days`} />
                    <SalaryRow label="Per Day Rate" value={`₹${formatCurrency(b.perDayRate)}`} />
                    <View style={s.divider} />
                    <SalaryRow label="Present" value={`${parseFloat(b.presentDays.toFixed(1))} days`} color="#059669" />
                    {b.halfDays > 0 && <SalaryRow label="Half Days" value={`${b.halfDays} (×0.5)`} color="#D97706" />}
                    <SalaryRow label="Off" value={`${parseFloat(b.offDays.toFixed(1))} days`} color="#3730A3" />
                    <SalaryRow label="Leave" value={`${parseFloat(b.leaveDays.toFixed(1))} days`} color="#EA580C" />
                    <SalaryRow label="Earned Days" value={`${b.earnedDays} days`} color="#059669" />
                    <SalaryRow label="Earned Salary" value={`₹${formatCurrency(b.earnedSalary)}`} color="#059669" />
                    <View style={s.divider} />
                    <SalaryRow label="Absent" value={`${b.absentDays} days`} color="#DC2626" />
                    <SalaryRow label="Leave Balance" value={`${parseFloat(b.leaveBalance.toFixed(1))} (EL:${parseFloat(b.earnedLeaveBalance.toFixed(1))} C:${parseFloat(b.compBalance.toFixed(1))} P:${parseFloat(b.freePermDays.toFixed(1))})`} color="#059669" />
                    <SalaryRow label="Leave Used" value={`${parseFloat(b.leaveConsumed.toFixed(1))} days`} color="#EA580C" />
                    {b.excessLeaves > 0 && <SalaryRow label="Excess Leaves" value={`${parseFloat(b.excessLeaves.toFixed(1))} days`} color="#DC2626" />}
                    <SalaryRow label="Comp Earned" value={`${b.compLeavesEarned} days`} color="#7C3AED" />
                    {b.lateCount > 0 && b.latePenaltyDays > 0 && (
                      <SalaryRow
                        label={`Late Penalty (${b.lateCount} lates → ${b.latePenaltyDays}d)`}
                        value={`-₹${formatCurrency(b.lateDeduction)}`}
                        color="#DC2626"
                        isDeduction
                      />
                    )}
                    {b.totalDeduction > 0 && (
                      <>
                        <View style={s.divider} />
                        <View style={s.totalDeductRow}>
                          <TrendingDown size={14} color="#DC2626" />
                          <Text style={s.totalDeductLabel}>Total Deduction</Text>
                          <Text style={s.totalDeductValue}>-₹{formatCurrency(b.totalDeduction)}</Text>
                        </View>
                      </>
                    )}
                    {b.incentiveAmount > 0 && (
                      <>
                        <View style={s.divider} />
                        <SalaryRow
                          label={`Sales Incentive (${b.incentivePercent}% of ₹${formatCurrency(b.employeeSalesTotal)})`}
                          value={`+₹${formatCurrency(b.incentiveAmount)}`}
                          color="#059669"
                        />
                      </>
                    )}
                  </View>

                  <Text style={s.effectiveLabel}>
                    Effective from {new Date(emp.currentSalary!.effectiveFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              )}

              {hasSalary && isExpanded && emp.isBeforeJoining && (
                <Text style={s.noRecordText}>No record found</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Salary Form Modal */}
      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <Pressable style={s.overlay} onPress={() => setShowForm(false)}>
          <Pressable style={s.modal} onPress={e => e.stopPropagation()}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{editingId ? 'Update Salary' : 'Set Salary'}</Text>
                <Text style={s.modalSubtitle}>
                  {employees.find((e: any) => e.id === selectedEmployee)?.name ?? 'Employee'}
                </Text>
              </View>
              <Pressable onPress={() => setShowForm(false)}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>
            <ScrollView style={s.form} showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Base Salary (₹/month) *</Text>
              <View style={s.salaryInputRow}>
                <IndianRupee size={18} color={Colors.textSecondary} />
                <TextInput style={s.salaryInput} value={salaryAmount} onChangeText={setSalaryAmount} placeholder="e.g. 6000" placeholderTextColor={Colors.textTertiary} />
              </View>

              <Text style={s.label}>Incentive on Sales (%)</Text>
              <View style={s.salaryInputRow}>
                <TextInput style={s.salaryInput} value={incentivePercent} onChangeText={setIncentivePercent} placeholder="e.g. 5" placeholderTextColor={Colors.textTertiary} />
                <Text style={{ color: Colors.textTertiary, fontSize: WebTypo.body }}>%</Text>
              </View>

              <Text style={s.label}>Effective From (YYYY-MM-DD) *</Text>
              <TextInput style={s.input} value={effectiveFrom} onChangeText={setEffectiveFrom} placeholder="2025-01-01" placeholderTextColor={Colors.textTertiary} />
            </ScrollView>
            <Pressable style={s.submitBtn} onPress={handleSubmit}>
              <Text style={s.submitText}>{editingId ? 'Update Salary' : 'Save Salary'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AnimatedPage>
  );
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 24, flexWrap: 'wrap' },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 16 },
  monthArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: WebColors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 },
  monthLabel: { fontSize: WebTypo.h3, fontWeight: '700', color: Colors.text, minWidth: 180, textAlign: 'center' },

  list: { flex: 1 },
  listContent: { gap: 12, paddingBottom: 40 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyText: { fontSize: WebTypo.body, color: Colors.textSecondary },

  empCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 20, shadowColor: WebColors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  empHeader: { flexDirection: 'row', alignItems: 'center' },
  empName: { fontSize: WebTypo.body, fontWeight: '700', color: Colors.text },
  empSalary: { fontSize: WebTypo.tiny, color: Colors.textSecondary, marginTop: 2 },
  empNoSalary: { fontSize: WebTypo.tiny, color: '#F59E0B', fontWeight: '500', marginTop: 2 },
  empActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primaryLight },
  editText: { fontSize: WebTypo.tiny, color: Colors.primary, fontWeight: '600' },

  salaryPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  previewNet: { fontSize: WebTypo.body, fontWeight: '700', color: '#059669' },
  previewDeduct: { fontSize: WebTypo.tiny, fontWeight: '600', color: '#DC2626' },
  noRecordText: { fontSize: WebTypo.tiny, color: Colors.textTertiary, marginTop: 8, fontStyle: 'italic' },

  breakdownCard: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  breakdownTitle: { fontSize: WebTypo.body, fontWeight: '700', color: '#059669' },
  breakdownBody: { gap: 6 },

  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 10, padding: 14, marginBottom: 12 },
  netLabel: { fontSize: WebTypo.body, fontWeight: '600', color: '#065F46' },
  netValue: { fontSize: 22, fontWeight: '800', color: '#059669' },

  bRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  bLabel: { fontSize: WebTypo.tiny, color: Colors.textSecondary },
  bValue: { fontSize: WebTypo.tiny, fontWeight: '600', color: Colors.text },
  bDeduction: { fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 6 },

  totalDeductRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalDeductLabel: { flex: 1, fontSize: WebTypo.tiny, fontWeight: '600', color: '#DC2626' },
  totalDeductValue: { fontSize: WebTypo.tiny, fontWeight: '800', color: '#DC2626' },

  effectiveLabel: { fontSize: 11, color: Colors.textTertiary, marginTop: 10, fontStyle: 'italic' },

  /* Modal */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#FFF', borderRadius: 16, width: 440, maxHeight: '70%', padding: 28, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: WebTypo.h3, fontWeight: '700', color: Colors.text },
  modalSubtitle: { fontSize: WebTypo.tiny, color: Colors.textSecondary, marginTop: 2 },
  form: { maxHeight: 340 },
  label: { fontSize: WebTypo.tiny, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4, marginTop: 14 },
  input: { height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, fontSize: WebTypo.body, color: Colors.text, backgroundColor: '#FAFAFA', outlineStyle: 'none' as any },
  salaryInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, backgroundColor: '#FAFAFA' },
  salaryInput: { flex: 1, fontSize: WebTypo.body, color: Colors.text, outlineStyle: 'none' as any },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: WebTypo.body },
});
