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
  Platform,
} from 'react-native';
import { CalendarPlus, Clock, FileText, ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useAlert } from '@/providers/AlertProvider';
import BottomSheetModal from '@/components/BottomSheetModal';
import DatePickerModal from '@/components/DatePickerModal';
import type { LeaveRequest, PermissionRequest } from '@/types';
import { isWeeklyOff, compLeaveValue } from '@/utils/salary';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#D97706' },
  approved: { bg: '#D1FAE5', text: '#059669' },
  rejected: { bg: '#FEE2E2', text: '#DC2626' },
};

export default function AttendanceScreen() {
  const { user } = useAuth();
  const { attendance, leaveRequests, permissionRequests, addLeaveRequest, addPermissionRequest, reload } = useData();
  const { showAlert } = useAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showPermissionForm, setShowPermissionForm] = useState(false);
  const [showCompLeaveForm, setShowCompLeaveForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Leave form state
  const [leaveStartDate, setLeaveStartDate] = useState<Date | null>(null);
  const [leaveEndDate, setLeaveEndDate] = useState<Date | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Permission form state
  const [permDate, setPermDate] = useState<Date | null>(null);
  const [permFromTime, setPermFromTime] = useState('');
  const [permToTime, setPermToTime] = useState('');
  const [permReason, setPermReason] = useState('');
  const [showPermDatePicker, setShowPermDatePicker] = useState(false);

  // Comp leave form state
  const [compDate, setCompDate] = useState<Date | null>(null);
  const [compReason, setCompReason] = useState('');
  const [showCompDatePicker, setShowCompDatePicker] = useState(false);

  // Tab: 'attendance' | 'requests'
  const [tab, setTab] = useState<'attendance' | 'requests'>('attendance');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // My attendance records
  const myAttendance = useMemo(() => {
    if (!user) return [];
    return attendance
      .filter(a => a.employeeId === user.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendance, user]);

  // My requests (leaves + permissions combined)
  const myRequests = useMemo(() => {
    if (!user) return [];
    const leaves = leaveRequests
      .filter(lr => lr.employeeId === user.id)
      .map(lr => ({ ...lr, reqType: 'leave' as const }));
    const perms = permissionRequests
      .filter(pr => pr.employeeId === user.id)
      .map(pr => ({ ...pr, reqType: 'permission' as const }));
    return [...leaves, ...perms].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [leaveRequests, permissionRequests, user]);

  // Comp leave balance
  const compBalance = useMemo(() => {
    if (!user) return 0;
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    // Earned: sum of comp values (1 for full day, 0.5 for half day) on Tuesdays
    const earned = attendance
      .filter(a => {
        if (a.employeeId !== user.id) return false;
        const d = new Date(a.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, a) => sum + compLeaveValue(a), 0);
    // Used: approved comp leaves this month
    const used = leaveRequests.filter(lr => {
      if (lr.employeeId !== user.id || lr.type !== 'compensation' || lr.status !== 'approved') return false;
      const d = new Date(lr.startDate);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;
    return earned - used;
  }, [attendance, leaveRequests, user]);

  const resetLeaveForm = () => {
    setLeaveStartDate(null);
    setLeaveEndDate(null);
    setLeaveReason('');
  };

  const resetPermissionForm = () => {
    setPermDate(null);
    setPermFromTime('');
    setPermToTime('');
    setPermReason('');
  };

  const resetCompForm = () => {
    setCompDate(null);
    setCompReason('');
  };

  const handleSubmitLeave = async () => {
    if (!user || !leaveStartDate || !leaveEndDate) {
      showAlert('Error', 'Please select start and end dates');
      return;
    }
    if (leaveEndDate < leaveStartDate) {
      showAlert('Error', 'End date must be after start date');
      return;
    }
    setSubmitting(true);
    try {
      await addLeaveRequest({
        employeeId: user.id,
        employeeName: user.name,
        type: 'leave',
        startDate: leaveStartDate.toISOString().split('T')[0],
        endDate: leaveEndDate.toISOString().split('T')[0],
        reason: leaveReason.trim() || undefined,
      });
      setShowLeaveForm(false);
      resetLeaveForm();
      showAlert('Success', 'Leave request submitted');
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPermission = async () => {
    if (!user || !permDate || !permFromTime || !permToTime) {
      showAlert('Error', 'Please fill all fields');
      return;
    }
    // Validate time format HH:MM
    const timeRegex = /^\d{1,2}:\d{2}$/;
    if (!timeRegex.test(permFromTime) || !timeRegex.test(permToTime)) {
      showAlert('Error', 'Please enter time in HH:MM format (e.g., 14:30)');
      return;
    }
    setSubmitting(true);
    try {
      await addPermissionRequest({
        employeeId: user.id,
        employeeName: user.name,
        date: permDate.toISOString().split('T')[0],
        fromTime: permFromTime.padStart(5, '0'),
        toTime: permToTime.padStart(5, '0'),
        reason: permReason.trim() || undefined,
      });
      setShowPermissionForm(false);
      resetPermissionForm();
      showAlert('Success', 'Permission request submitted');
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitCompLeave = async () => {
    if (!user || !compDate) {
      showAlert('Error', 'Please select a date');
      return;
    }
    if (compBalance <= 0) {
      showAlert('Error', 'No compensation leave balance available');
      return;
    }
    setSubmitting(true);
    try {
      await addLeaveRequest({
        employeeId: user.id,
        employeeName: user.name,
        type: 'compensation',
        startDate: compDate.toISOString().split('T')[0],
        endDate: compDate.toISOString().split('T')[0],
        reason: compReason.trim() || 'Compensation leave',
      });
      setShowCompLeaveForm(false);
      resetCompForm();
      showAlert('Success', 'Compensation leave request submitted');
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const renderAttendanceItem = ({ item }: { item: typeof myAttendance[0] }) => {
    const isTuesday = isWeeklyOff(item.date);
    return (
      <View style={styles.recordCard}>
        <View style={styles.recordHeader}>
          <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'present' ? '#D1FAE5' : item.status === 'absent' ? '#FEE2E2' : item.status === 'half_day' ? '#FEF3C7' : '#DBEAFE' }]}>
            <Text style={[styles.statusText, { color: item.status === 'present' ? '#059669' : item.status === 'absent' ? '#DC2626' : item.status === 'half_day' ? '#D97706' : '#2563EB' }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          {isTuesday && (
            <View style={[styles.statusBadge, { backgroundColor: '#EDE9FE' }]}>
              <Text style={[styles.statusText, { color: '#7C3AED' }]}>COMP +1</Text>
            </View>
          )}
        </View>
        {(item.checkIn || item.checkOut) && (
          <Text style={styles.recordTime}>
            {item.checkIn ? formatTime(item.checkIn) : '--:--'}
            {' → '}
            {item.checkOut ? formatTime(item.checkOut) : '--:--'}
          </Text>
        )}
      </View>
    );
  };

  const renderRequestItem = ({ item }: { item: typeof myRequests[0] }) => {
    const colors = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
    const isLeave = item.reqType === 'leave';
    const leaveItem = item as LeaveRequest & { reqType: string };
    const permItem = item as PermissionRequest & { reqType: string };

    return (
      <View style={styles.recordCard}>
        <View style={styles.recordHeader}>
          <View style={[styles.typeBadge, { backgroundColor: isLeave ? '#DBEAFE' : '#FEF3C7' }]}>
            <Text style={[styles.typeText, { color: isLeave ? '#2563EB' : '#D97706' }]}>
              {isLeave ? (leaveItem.type === 'compensation' ? 'COMP LEAVE' : 'LEAVE') : 'PERMISSION'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.recordDate}>
          {isLeave
            ? `${formatDate(leaveItem.startDate)} — ${formatDate(leaveItem.endDate)}`
            : `${formatDate(permItem.date)} | ${permItem.fromTime} — ${permItem.toTime}`}
        </Text>
        {(isLeave ? leaveItem.reason : permItem.reason) && (
          <Text style={styles.recordReason} numberOfLines={2}>
            {isLeave ? leaveItem.reason : permItem.reason}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'attendance' && styles.tabBtnActive]}
          onPress={() => setTab('attendance')}
        >
          <Text style={[styles.tabText, tab === 'attendance' && styles.tabTextActive]}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>My Requests</Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => { resetLeaveForm(); setShowLeaveForm(true); }}>
          <CalendarPlus size={14} color="#2563EB" />
          <Text style={styles.actionText}>+ Leave</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => { resetPermissionForm(); setShowPermissionForm(true); }}>
          <Clock size={14} color="#D97706" />
          <Text style={styles.actionText}>+ Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, compBalance <= 0 && styles.actionBtnDisabled]}
          onPress={() => { resetCompForm(); setShowCompLeaveForm(true); }}
          disabled={compBalance <= 0}
        >
          <FileText size={14} color={compBalance > 0 ? '#7C3AED' : '#9CA3AF'} />
          <Text style={[styles.actionText, compBalance <= 0 && { color: '#9CA3AF' }]}>
            + Comp ({compBalance})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'attendance' ? (
        <FlatList
          data={myAttendance}
          keyExtractor={item => item.id}
          renderItem={renderAttendanceItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No attendance records yet</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={myRequests}
          keyExtractor={item => item.id}
          renderItem={renderRequestItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No requests yet</Text>
            </View>
          }
        />
      )}

      {/* Leave Request Form */}
      <BottomSheetModal visible={showLeaveForm} onRequestClose={() => setShowLeaveForm(false)}>
        <Text style={styles.formTitle}>Request Leave</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Start Date *</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
            <Text style={leaveStartDate ? styles.dateText : styles.datePlaceholder}>
              {leaveStartDate ? leaveStartDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select start date'}
            </Text>
            <ChevronDown size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>End Date *</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
            <Text style={leaveEndDate ? styles.dateText : styles.datePlaceholder}>
              {leaveEndDate ? leaveEndDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select end date'}
            </Text>
            <ChevronDown size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Reason</Text>
          <TextInput
            style={styles.textArea}
            value={leaveReason}
            onChangeText={setLeaveReason}
            placeholder="Enter reason (optional)"
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitLeave} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit Leave Request</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* Permission Request Form */}
      <BottomSheetModal visible={showPermissionForm} onRequestClose={() => setShowPermissionForm(false)}>
        <Text style={styles.formTitle}>Request Permission</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Date *</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPermDatePicker(true)}>
            <Text style={permDate ? styles.dateText : styles.datePlaceholder}>
              {permDate ? permDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'}
            </Text>
            <ChevronDown size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>From Time * (HH:MM, 24hr)</Text>
          <TextInput
            style={styles.input}
            value={permFromTime}
            onChangeText={setPermFromTime}
            placeholder="e.g. 14:00"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.fieldLabel}>To Time * (HH:MM, 24hr)</Text>
          <TextInput
            style={styles.input}
            value={permToTime}
            onChangeText={setPermToTime}
            placeholder="e.g. 16:00"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.fieldLabel}>Reason</Text>
          <TextInput
            style={styles.textArea}
            value={permReason}
            onChangeText={setPermReason}
            placeholder="Enter reason (optional)"
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitPermission} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit Permission Request</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* Comp Leave Form */}
      <BottomSheetModal visible={showCompLeaveForm} onRequestClose={() => setShowCompLeaveForm(false)}>
        <Text style={styles.formTitle}>Request Compensation Leave</Text>
        <Text style={styles.compInfo}>Balance: {compBalance} comp {compBalance === 1 ? 'day' : 'days'} available</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Date to take off *</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowCompDatePicker(true)}>
            <Text style={compDate ? styles.dateText : styles.datePlaceholder}>
              {compDate ? compDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'}
            </Text>
            <ChevronDown size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Reason</Text>
          <TextInput
            style={styles.textArea}
            value={compReason}
            onChangeText={setCompReason}
            placeholder="Enter reason (optional)"
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitCompLeave} disabled={submitting || compBalance <= 0}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit Comp Leave</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* Date Pickers */}
      <DatePickerModal
        visible={showStartPicker}
        value={leaveStartDate}
        title="Select Start Date"
        onSelect={(d) => { setLeaveStartDate(d); setShowStartPicker(false); }}
        onClose={() => setShowStartPicker(false)}
      />
      <DatePickerModal
        visible={showEndPicker}
        value={leaveEndDate}
        title="Select End Date"
        minDate={leaveStartDate ?? undefined}
        onSelect={(d) => { setLeaveEndDate(d); setShowEndPicker(false); }}
        onClose={() => setShowEndPicker(false)}
      />
      <DatePickerModal
        visible={showPermDatePicker}
        value={permDate}
        title="Select Date"
        onSelect={(d) => { setPermDate(d); setShowPermDatePicker(false); }}
        onClose={() => setShowPermDatePicker(false)}
      />
      <DatePickerModal
        visible={showCompDatePicker}
        value={compDate}
        title="Select Date"
        onSelect={(d) => { setCompDate(d); setShowCompDatePicker(false); }}
        onClose={() => setShowCompDatePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabRow: {
    flexDirection: 'row',
    padding: Spacing.screen,
    paddingBottom: 0,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.md,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  listContent: {
    padding: Spacing.screen,
    paddingTop: 0,
    paddingBottom: 100,
  },
  recordCard: {
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
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recordDate: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  recordTime: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  recordReason: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeText: {
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
    marginBottom: Spacing.lg,
  },
  compInfo: {
    fontSize: FontSize.sm,
    color: '#7C3AED',
    fontWeight: '600',
    marginBottom: Spacing.md,
    backgroundColor: '#EDE9FE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: Spacing.md,
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
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: FontSize.body,
    color: Colors.text,
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
    minHeight: 80,
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
