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
import { ChevronDown, UserCheck, UserX, Clock, UserMinus } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useAlert } from '@/providers/AlertProvider';
import BottomSheetModal from '@/components/BottomSheetModal';
import DatePickerModal from '@/components/DatePickerModal';
import type { Attendance, AttendanceStatus } from '@/types';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: any; color: string }[] = [
  { value: 'present', label: 'Present', icon: UserCheck, color: '#059669' },
  { value: 'absent', label: 'Absent', icon: UserX, color: '#DC2626' },
  { value: 'half_day', label: 'Half Day', icon: Clock, color: '#D97706' },
  { value: 'permission', label: 'Permission', icon: UserMinus, color: '#2563EB' },
];

export default function AttendanceManagementScreen() {
  const { user } = useAuth();
  const { attendance, users, addAttendance, updateAttendance, reload } = useData();
  const { showAlert } = useAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('present');
  const [notes, setNotes] = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const dateStr = selectedDate.toISOString().split('T')[0];

  // Get employees (non-admin)
  const employees = useMemo(
    () => users.filter((p: any) => p.role === 'employee'),
    [users],
  );

  // Attendance for selected date
  const dateAttendance = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendance
      .filter(a => a.date === dateStr)
      .forEach(a => map.set(a.employeeId, a));
    return map;
  }, [attendance, dateStr]);

  // Employee list with attendance status
  const employeeList = useMemo(() => {
    return employees.map((emp: any) => {
      const att = dateAttendance.get(emp.id);
      return {
        id: emp.id,
        name: emp.name,
        attendanceId: att?.id ?? null,
        status: att?.status ?? null,
        checkIn: att?.checkIn ?? null,
        checkOut: att?.checkOut ?? null,
        notes: att?.notes ?? null,
      };
    });
  }, [employees, dateAttendance]);

  const handleOpenForm = (empId: string, empName: string, currentStatus: AttendanceStatus | null) => {
    setSelectedEmployee(empId);
    setSelectedEmployeeName(empName);
    setSelectedStatus(currentStatus ?? 'present');
    setNotes('');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !user) return;
    setSubmitting(true);
    try {
      const existing = dateAttendance.get(selectedEmployee);
      if (existing) {
        await updateAttendance({
          id: existing.id,
          status: selectedStatus,
          notes: notes.trim() || undefined,
          markedBy: user.id,
        });
      } else {
        await addAttendance({
          employeeId: selectedEmployee,
          employeeName: selectedEmployeeName,
          date: dateStr,
          status: selectedStatus,
          notes: notes.trim() || undefined,
          markedBy: user.id,
        });
      }
      setShowForm(false);
      showAlert('Success', 'Attendance updated');
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status: string | null) => {
    switch (status) {
      case 'present': return { bg: '#D1FAE5', text: '#059669' };
      case 'absent': return { bg: '#FEE2E2', text: '#DC2626' };
      case 'half_day': return { bg: '#FEF3C7', text: '#D97706' };
      case 'permission': return { bg: '#DBEAFE', text: '#2563EB' };
      default: return { bg: Colors.border, text: Colors.textTertiary };
    }
  };

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const renderEmployee = ({ item }: { item: typeof employeeList[0] }) => {
    const st = getStatusStyle(item.status);
    return (
      <TouchableOpacity
        style={styles.empCard}
        onPress={() => handleOpenForm(item.id, item.name, item.status)}
        activeOpacity={0.7}
      >
        <View style={styles.empRow}>
          <View style={styles.empInfo}>
            <Text style={styles.empName}>{item.name}</Text>
            {item.checkIn && (
              <Text style={styles.empTime}>
                {formatTime(item.checkIn)}{item.checkOut ? ` → ${formatTime(item.checkOut)}` : ' (checked in)'}
              </Text>
            )}
            {item.notes && <Text style={styles.empNotes} numberOfLines={1}>{item.notes}</Text>}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>
              {item.status ? item.status.replace('_', ' ').toUpperCase() : 'NOT MARKED'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Summary counts
  const presentCount = employeeList.filter((e: any) => e.status === 'present').length;
  const absentCount = employeeList.filter((e: any) => e.status === 'absent').length;
  const notMarked = employeeList.filter((e: any) => !e.status).length;

  return (
    <View style={styles.container}>
      {/* Date selector */}
      <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.dateSelectorText}>
          {selectedDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
        <ChevronDown size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryPill, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.summaryNum, { color: '#059669' }]}>{presentCount}</Text>
          <Text style={[styles.summaryLabel, { color: '#059669' }]}>Present</Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.summaryNum, { color: '#DC2626' }]}>{absentCount}</Text>
          <Text style={[styles.summaryLabel, { color: '#DC2626' }]}>Absent</Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: Colors.border }]}>
          <Text style={[styles.summaryNum, { color: Colors.textSecondary }]}>{notMarked}</Text>
          <Text style={[styles.summaryLabel, { color: Colors.textSecondary }]}>Unmarked</Text>
        </View>
      </View>

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

      {/* Mark/Override Form */}
      <BottomSheetModal visible={showForm} onRequestClose={() => setShowForm(false)}>
        <Text style={styles.formTitle}>Mark Attendance</Text>
        <Text style={styles.formSubtitle}>
          {employees.find((e: any) => e.id === selectedEmployee)?.name ?? 'Employee'} — {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </Text>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.fieldLabel}>Status</Text>
        <View style={styles.statusOptions}>
          {STATUS_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isSelected = selectedStatus === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.statusOption, isSelected && { backgroundColor: opt.color + '18', borderColor: opt.color }]}
                onPress={() => setSelectedStatus(opt.value)}
              >
                <Icon size={16} color={isSelected ? opt.color : Colors.textTertiary} />
                <Text style={[styles.statusOptionText, isSelected && { color: opt.color, fontWeight: '700' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={styles.textArea}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes"
          placeholderTextColor={Colors.textTertiary}
          multiline
          numberOfLines={2}
        />

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Save Attendance</Text>}
        </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      <DatePickerModal
        visible={showDatePicker}
        value={selectedDate}
        title="Select Date"
        onSelect={(d) => { if (d) setSelectedDate(d); setShowDatePicker(false); }}
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
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: Spacing.screen,
    marginTop: Spacing.screen,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateSelectorText: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.md,
    gap: 8,
  },
  summaryPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  summaryNum: {
    fontSize: FontSize.heading,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: Spacing.screen,
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
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  empInfo: {
    flex: 1,
  },
  empName: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.text,
  },
  empTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  empNotes: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
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
    marginBottom: 8,
    marginTop: Spacing.md,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
  },
  statusOptionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  textArea: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: FontSize.body,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
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
