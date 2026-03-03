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
} from 'react-native';
import { ChevronDown, IndianRupee, Edit2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useAlert } from '@/providers/AlertProvider';
import BottomSheetModal from '@/components/BottomSheetModal';
import DatePickerModal from '@/components/DatePickerModal';
import type { EmployeeSalary } from '@/types';
import { calculateMonthlySalary } from '@/utils/salary';

export default function SalaryManagementScreen() {
  const { user } = useAuth();
  const { users, employeeSalaries, attendance, leaveRequests, permissionRequests, addEmployeeSalary, updateEmployeeSalary, reload } = useData();
  const { showAlert } = useAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Employee picker
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);

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

  // Employee list with current salary and this month's calculation
  const employeeList = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return employees.map((emp: any) => {
      const salaryRecords = employeeSalaryMap.get(emp.id) ?? [];
      const currentSalary = salaryRecords[0] ?? null;

      // Calculate this month's salary
      const breakdown = currentSalary
        ? calculateMonthlySalary(
            currentSalary.baseSalary,
            attendance.filter((a: any) => a.employeeId === emp.id),
            leaveRequests.filter((lr: any) => lr.employeeId === emp.id),
            permissionRequests.filter((pr: any) => pr.employeeId === emp.id),
            year,
            month,
          )
        : null;

      return {
        id: emp.id,
        name: emp.name,
        currentSalary,
        netSalary: breakdown?.netSalary ?? null,
        totalDeduction: breakdown?.totalDeduction ?? null,
      };
    });
  }, [employees, employeeSalaryMap, attendance, leaveRequests, permissionRequests]);

  const handleOpenForm = (empId: string, existing?: EmployeeSalary) => {
    setSelectedEmployee(empId);
    if (existing) {
      setEditingId(existing.id);
      setSalaryAmount(existing.baseSalary.toString());
      setEffectiveFrom(new Date(existing.effectiveFrom));
    } else {
      setEditingId(null);
      setSalaryAmount('');
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
      const payload = {
        employeeId: selectedEmployee,
        employeeName: empName,
        baseSalary: amount,
        effectiveFrom: effectiveFrom.toISOString().split('T')[0],
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

  const formatCurrency = (amount: number) => {
    return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const renderEmployee = ({ item }: { item: typeof employeeList[0] }) => {
    const hasSalary = !!item.currentSalary;
    return (
      <View style={styles.empCard}>
        <View style={styles.empHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{item.name}</Text>
            {hasSalary ? (
              <Text style={styles.empSalary}>
                Base: {formatCurrency(item.currentSalary!.baseSalary)}/month
              </Text>
            ) : (
              <Text style={styles.empNoSalary}>Salary not configured</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleOpenForm(item.id, item.currentSalary ?? undefined)}
          >
            <Edit2 size={14} color={Colors.primary} />
            <Text style={styles.editText}>{hasSalary ? 'Edit' : 'Set'}</Text>
          </TouchableOpacity>
        </View>

        {hasSalary && item.netSalary !== null && (
          <View style={styles.salaryBreakdown}>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>This Month Net</Text>
              <Text style={styles.salaryValue}>{formatCurrency(item.netSalary!)}</Text>
            </View>
            {item.totalDeduction! > 0 && (
              <View style={styles.salaryRow}>
                <Text style={styles.deductLabel}>Deductions</Text>
                <Text style={styles.deductValue}>-{formatCurrency(item.totalDeduction!)}</Text>
              </View>
            )}
            <View style={styles.salaryRow}>
              <Text style={styles.effectiveLabel}>
                Effective from {new Date(item.currentSalary!.effectiveFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No employees found</Text>
          </View>
        }
      />

      {/* Salary Form */}
      <BottomSheetModal visible={showForm} onRequestClose={() => setShowForm(false)}>
        <Text style={styles.formTitle}>{editingId ? 'Update Salary' : 'Set Salary'}</Text>
        <Text style={styles.formSubtitle}>
          {employees.find((e: any) => e.id === selectedEmployee)?.name ?? 'Employee'}
        </Text>

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
  salaryBreakdown: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  salaryLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  salaryValue: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: '#059669',
  },
  deductLabel: {
    fontSize: FontSize.xs,
    color: '#DC2626',
  },
  deductValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#DC2626',
  },
  effectiveLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: FontSize.body,
    color: Colors.textTertiary,
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
    marginBottom: Spacing.lg,
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
