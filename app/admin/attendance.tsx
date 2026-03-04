/**
 * Admin attendance management — calendar grid per employee with leave balances.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  UserRound,
  Check,
  X,
} from 'lucide-react-native';
import { useData } from '@/providers/DataProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, AttendanceCellColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { toLocalDateString } from '@/utils/format';
import { isWeeklyOff, computeLeaveBalance } from '@/utils/salary';
import type { Attendance, AttendanceStatus } from '@/types';

// ── Constants ────────────────────────────────────────────────

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
  { value: 'permission', label: 'Permission' },
];

// ── Component ────────────────────────────────────────────────

export default function AdminAttendance() {
  const { user } = useAuth();
  const {
    users,
    attendance,
    leaveRequests,
    permissionRequests,
    employeeSalaries,
    salonConfig,
    addAttendance,
    updateAttendance,
    deleteAttendance,
  } = useData();

  // State
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [editModal, setEditModal] = useState<{
    date: string;
    existing?: Attendance;
  } | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Employees
  const employees = useMemo(
    () => users.filter(u => u.approved && u.role === 'employee').sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  // Auto-select first employee
  React.useEffect(() => {
    if (!selectedEmpId && employees.length > 0) {
      setSelectedEmpId(employees[0].id);
    }
  }, [employees, selectedEmpId]);

  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  // Attendance records for selected employee + month
  const empAttendance = useMemo(() => {
    if (!selectedEmpId) return [];
    return attendance.filter(a => {
      const d = new Date(a.date);
      return a.employeeId === selectedEmpId && d.getMonth() === month && d.getFullYear() === year;
    });
  }, [attendance, selectedEmpId, month, year]);

  // Map: dateStr → attendance record
  const attendanceMap = useMemo(() => {
    const map: Record<string, Attendance> = {};
    empAttendance.forEach(a => { map[a.date] = a; });
    return map;
  }, [empAttendance]);

  // Leave balance for selected employee
  const leaveBalance = useMemo(() => {
    if (!selectedEmpId) return { earnedLeaveBalance: 0, compBalance: 0, totalBalance: 0 };
    const empLeaves = leaveRequests.filter(r => r.employeeId === selectedEmpId);
    const empAttAll = attendance.filter(a => a.employeeId === selectedEmpId);
    const joiningDate = selectedEmp?.joiningDate;

    return computeLeaveBalance(empAttAll, empLeaves, joiningDate, salonConfig);
  }, [selectedEmpId, leaveRequests, attendance, salonConfig, selectedEmp]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    return days;
  }, [year, month]);

  // Summary stats
  const summary = useMemo(() => {
    let present = 0, absent = 0, halfDay = 0, leaves = 0, weeklyOff = 0;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const day = new Date(dateStr);
      if (day > today) continue;

      if (isWeeklyOff(dateStr, salonConfig)) { weeklyOff++; continue; }

      const record = attendanceMap[dateStr];
      if (record) {
        if (record.status === 'present' || record.status === 'permission') present++;
        else if (record.status === 'half_day') halfDay++;
        else if (record.status === 'leave') leaves++;
        else absent++;
      } else {
        absent++;
      }
    }

    return { present, absent, halfDay, leaves, weeklyOff };
  }, [attendanceMap, year, month, salonConfig]);

  // Month navigation
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const monthLabel = new Date(year, month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Open edit modal
  const openEdit = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = attendanceMap[dateStr];
    setEditStatus(existing?.status || 'present');
    setEditCheckIn(existing?.checkIn || '');
    setEditCheckOut(existing?.checkOut || '');
    setEditNotes(existing?.notes || '');
    setEditModal({ date: dateStr, existing });
  };

  // Save attendance
  const handleSave = async () => {
    if (!editModal || !selectedEmpId || !selectedEmp || !user) return;
    setSaving(true);
    try {
      const data: any = {
        employeeId: selectedEmpId,
        employeeName: selectedEmp.name,
        date: editModal.date,
        checkIn: editCheckIn || null,
        checkOut: editCheckOut || null,
        status: editStatus,
        notes: editNotes || null,
        markedBy: user.id,
      };

      if (editModal.existing) {
        await updateAttendance({ ...editModal.existing, ...data });
      } else {
        await addAttendance(data);
      }
      setEditModal(null);
    } catch {
      // handled by data provider
    } finally {
      setSaving(false);
    }
  };

  // Delete attendance
  const handleDelete = async () => {
    if (!editModal?.existing) return;
    setSaving(true);
    try {
      await deleteAttendance(editModal.existing.id);
      setEditModal(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatedPage>
      <View style={styles.topBar}>
        {/* Employee picker */}
        <View style={styles.empPicker}>
          <UserRound size={18} color={Colors.primary} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.empPills}>
            {employees.map(emp => (
              <Pressable
                key={emp.id}
                style={[styles.empPill, selectedEmpId === emp.id && styles.empPillActive]}
                onPress={() => setSelectedEmpId(emp.id)}
              >
                <Text style={[styles.empPillText, selectedEmpId === emp.id && styles.empPillTextActive]}>
                  {emp.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Month nav */}
        <View style={styles.monthNav}>
          <Pressable style={styles.monthBtn} onPress={prevMonth}>
            <ChevronLeft size={18} color={Colors.text} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable style={styles.monthBtn} onPress={nextMonth}>
            <ChevronRight size={18} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.mainRow}>
        {/* Calendar grid */}
        <View style={styles.calendarCard}>
          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {WEEK_DAYS.map(d => (
              <View key={d} style={styles.weekCell}>
                <Text style={styles.weekLabel}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Day cells */}
          <View style={styles.daysGrid}>
            {calendarDays.map((day, i) => {
              if (day === null) {
                return <View key={`e${i}`} style={styles.dayCell} />;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const record = attendanceMap[dateStr];
              const isFuture = new Date(dateStr) > new Date();
              const isWO = isWeeklyOff(dateStr, salonConfig);
              const isToday = dateStr === toLocalDateString(new Date());

              let cellKey = 'unmarked';
              if (isWO) cellKey = 'weekly_off';
              else if (record) cellKey = record.status;
              else if (!isFuture) cellKey = 'absent';

              const cellColor = AttendanceCellColors[cellKey] || AttendanceCellColors.unmarked;

              return (
                <Pressable
                  key={day}
                  style={[
                    styles.dayCell,
                    { backgroundColor: isFuture ? '#FAFAFA' : cellColor.bg },
                    isToday && styles.dayCellToday,
                  ]}
                  onPress={isFuture ? undefined : () => openEdit(day)}
                  disabled={isFuture}
                >
                  <Text style={[styles.dayNum, isFuture && styles.dayNumFuture]}>{day}</Text>
                  {!isFuture && (
                    <Text style={[styles.dayStatus, { color: cellColor.text }]}>{cellColor.label}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {Object.entries(AttendanceCellColors).filter(([k]) => k !== 'unmarked').map(([key, val]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: val.bg, borderColor: val.text }]} />
                <Text style={styles.legendText}>{val.label} — {key.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Right panel: Summary + Leave balance */}
        <View style={styles.sidePanel}>
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.sideSectionTitle}>Monthly Summary</Text>
            <View style={styles.summaryGrid}>
              {[
                { label: 'Present', value: summary.present, color: Colors.success },
                { label: 'Absent', value: summary.absent, color: Colors.danger },
                { label: 'Half Day', value: summary.halfDay, color: Colors.warning },
                { label: 'Leaves', value: summary.leaves, color: '#7C3AED' },
                { label: 'Weekly Off', value: summary.weeklyOff, color: Colors.textTertiary },
              ].map(s => (
                <View key={s.label} style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.summaryLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Leave balance */}
          <View style={styles.summaryCard}>
            <Text style={styles.sideSectionTitle}>Leave Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Earned Leave</Text>
              <Text style={styles.balanceValue}>{leaveBalance.earnedLeaveBalance}</Text>
            </View>
            <View style={styles.balanceBar}>
              <View
                style={[
                  styles.balanceFill,
                  {
                    width: `${Math.min(100, leaveBalance.earnedLeaveBalance > 0 ? 60 : 0)}%` as any,
                    backgroundColor: Colors.success,
                  },
                ]}
              />
            </View>
            <View style={[styles.balanceRow, { marginTop: 14 }]}>
              <Text style={styles.balanceLabel}>Comp Off</Text>
              <Text style={styles.balanceValue}>{leaveBalance.compBalance}</Text>
            </View>
            <View style={styles.balanceBar}>
              <View
                style={[
                  styles.balanceFill,
                  {
                    width: `${Math.min(100, leaveBalance.compBalance > 0 ? 60 : 0)}%` as any,
                    backgroundColor: '#8B5CF6',
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Edit Modal */}
      {editModal && (
        <Modal transparent animationType="fade" visible>
          <Pressable style={styles.modalOverlay} onPress={() => setEditModal(null)}>
            <Pressable style={styles.modalCard} onPress={e => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editModal.existing ? 'Edit' : 'Mark'} Attendance — {editModal.date}
                </Text>
                <Pressable onPress={() => setEditModal(null)}>
                  <X size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>

              {/* Status pills */}
              <Text style={styles.modalLabel}>Status</Text>
              <View style={styles.statusPills}>
                {STATUS_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.value}
                    style={[styles.statusPill, editStatus === opt.value && styles.statusPillActive]}
                    onPress={() => setEditStatus(opt.value)}
                  >
                    <Text style={[styles.statusPillText, editStatus === opt.value && styles.statusPillTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Times */}
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={styles.modalLabel}>Check In</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCheckIn}
                    onChangeText={setEditCheckIn}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
                <View style={styles.timeField}>
                  <Text style={styles.modalLabel}>Check Out</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCheckOut}
                    onChangeText={setEditCheckOut}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </View>

              {/* Notes */}
              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput
                style={[styles.modalInput, styles.notesInput]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Optional notes..."
                placeholderTextColor={Colors.textTertiary}
                multiline
              />

              {/* Actions */}
              <View style={styles.modalActions}>
                {editModal.existing && (
                  <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
                )}
                <View style={{ flex: 1 }} />
                <Pressable style={styles.cancelBtn} onPress={() => setEditModal(null)} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <Check size={16} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </AnimatedPage>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
    flexWrap: 'wrap',
  },
  empPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 300,
  },
  empPills: {
    gap: 6,
    paddingRight: 8,
  },
  empPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  empPillActive: {
    backgroundColor: Colors.primary,
  },
  empPillText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  empPillTextActive: {
    color: '#FFFFFF',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  monthLabel: {
    fontSize: WebTypo.body,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 140,
    textAlign: 'center',
  },
  mainRow: {
    flexDirection: 'row',
    gap: 20,
    flexWrap: 'wrap',
  },
  // Calendar
  calendarCard: {
    flex: 2,
    minWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F8F0F3',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekLabel: {
    fontSize: WebTypo.tiny,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 2,
    // @ts-ignore
    cursor: 'pointer',
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dayNum: {
    fontSize: WebTypo.body,
    fontWeight: '600',
    color: Colors.text,
  },
  dayNumFuture: {
    color: Colors.textTertiary,
  },
  dayStatus: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
  },
  legendText: {
    fontSize: WebTypo.tiny,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  // Side panel
  sidePanel: {
    flex: 1,
    minWidth: 260,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F8F0F3',
  },
  sideSectionTitle: {
    fontSize: WebTypo.h3,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryItem: {
    alignItems: 'center',
    minWidth: 70,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
  },
  summaryValue: {
    fontSize: WebTypo.h2,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: WebTypo.tiny,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  balanceLabel: {
    fontSize: WebTypo.small,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  balanceValue: {
    fontSize: WebTypo.body,
    fontWeight: '700',
    color: Colors.text,
  },
  balanceBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  balanceFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    width: '90%',
    maxWidth: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: WebTypo.h3,
    fontWeight: '700',
    color: Colors.text,
  },
  modalLabel: {
    fontSize: WebTypo.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  statusPills: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  statusPillActive: {
    backgroundColor: Colors.primary,
  },
  statusPillText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusPillTextActive: {
    color: '#FFFFFF',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  modalInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: WebTypo.body,
    color: Colors.text,
    backgroundColor: Colors.inputBg,
  },
  notesInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
  },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.dangerLight,
  },
  deleteBtnText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: Colors.danger,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: WebTypo.small,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  saveBtnText: {
    fontSize: WebTypo.small,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
