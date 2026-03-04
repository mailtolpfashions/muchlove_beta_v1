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
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, UserCheck, UserX, Clock, UserMinus, CalendarOff, X, Check, Trash2, Gift } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useAlert } from '@/providers/AlertProvider';
import BottomSheetModal from '@/components/BottomSheetModal';
import type { Attendance, AttendanceStatus, LeaveRequest, PermissionRequest, RequestStatus } from '@/types';
import { toLocalDateString } from '@/utils/format';
import { isWeeklyOff, compLeaveValue } from '@/utils/salary';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: any; color: string }[] = [
  { value: 'present', label: 'Present', icon: UserCheck, color: '#059669' },
  { value: 'absent', label: 'Absent', icon: UserX, color: '#DC2626' },
  { value: 'half_day', label: 'Half Day', icon: Clock, color: '#D97706' },
  { value: 'permission', label: 'Permission', icon: UserMinus, color: '#2563EB' },
  { value: 'leave', label: 'Leave', icon: CalendarOff, color: '#EA580C' },
];

const REQUEST_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#D97706' },
  approved: { bg: '#D1FAE5', text: '#059669' },
  rejected: { bg: '#FEE2E2', text: '#DC2626' },
};

type CombinedRequest = (
  | (LeaveRequest & { reqType: 'leave' })
  | (PermissionRequest & { reqType: 'permission' })
) & { employeeName: string };

type DayStatus = 'present' | 'absent' | 'off' | 'leave' | 'half_day' | 'future';

const CAL_STATUS_COLORS: Record<DayStatus, { bg: string; text: string }> = {
  present: { bg: '#D1FAE5', text: '#059669' },
  absent: { bg: '#FEE2E2', text: '#DC2626' },
  off: { bg: '#E0E7FF', text: '#4338CA' },
  leave: { bg: '#FFF7ED', text: '#EA580C' },
  half_day: { bg: '#FEF3C7', text: '#D97706' },
  future: { bg: '#F3F4F6', text: '#D1D5DB' },
};

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CAL_LEGEND_ITEMS: { label: string; status: DayStatus }[] = [
  { label: 'Present', status: 'present' },
  { label: 'Absent', status: 'absent' },
  { label: 'Off', status: 'off' },
  { label: 'Leave', status: 'leave' },
  { label: 'Half', status: 'half_day' },
];

export default function AttendanceManagementScreen() {
  const { user } = useAuth();
  const { attendance, users, addAttendance, updateAttendance, deleteAttendance, leaveRequests, permissionRequests, updateLeaveRequest, updatePermissionRequest, addLeaveRequest, reload, salonConfig } = useData();
  const { showAlert } = useAlert();

  // Top-level tab
  const [mainTab, setMainTab] = useState<'attendance' | 'requests'>('attendance');
  const [expandedEmpIds, setExpandedEmpIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedEmpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('present');
  const [notes, setNotes] = useState('');
  const [permFromTime, setPermFromTime] = useState('');
  const [permToTime, setPermToTime] = useState('');
  const [halfDayPeriod, setHalfDayPeriod] = useState<'first_half' | 'second_half'>('first_half');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Request tab state
  const [requestTab, setRequestTab] = useState<'all' | 'pending' | 'processed'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const dateStr = toLocalDateString(selectedDate);
  const now = new Date();
  const isToday = selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();

  const employees = useMemo(
    () => users.filter((p: any) => p.role === 'employee'),
    [users],
  );

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((p: any) => map.set(p.id, p.name));
    return map;
  }, [users]);

  // ── Attendance tab data ──
  const dateAttendance = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendance
      .filter(a => a.date === dateStr)
      .forEach(a => map.set(a.employeeId, a));
    return map;
  }, [attendance, dateStr]);

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

  // ── Monthly counts per employee (Present / Absent / Off / Leave) ──
  const monthlyStats = useMemo(() => {
    const now = selectedDate;
    const month = now.getMonth();
    const year = now.getFullYear();
    const today = new Date();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const lastDay = (today.getFullYear() === year && today.getMonth() === month) ? today.getDate() : totalDays;

    const map = new Map<string, { present: number; absent: number; off: number; leave: number; compOff: number }>();

    for (const emp of employees) {
      let present = 0, absent = 0, off = 0, leave = 0, compOff = 0;

      // Determine the first day to count for this employee (from joining date)
      const empJoinDate = (emp as any).joiningDate ? new Date((emp as any).joiningDate) : null;
      const monthStart = new Date(year, month, 1);
      const firstDay = empJoinDate && empJoinDate > monthStart ? empJoinDate.getDate() : 1;
      // If the employee joined after this month, skip entirely
      if (empJoinDate && (empJoinDate.getFullYear() > year || (empJoinDate.getFullYear() === year && empJoinDate.getMonth() > month))) {
        map.set(emp.id, { present: 0, absent: 0, off: 0, leave: 0, compOff: 0 });
        continue;
      }

      const empRecords = attendance.filter(a => {
        if (a.employeeId !== emp.id) return false;
        const d = new Date(a.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      const recordMap = new Map<string, Attendance>();
      empRecords.forEach(r => recordMap.set(r.date, r));

      // Count approved leave days in this month for this employee
      const empLeaves = leaveRequests.filter(lr =>
        lr.employeeId === emp.id && lr.status === 'approved'
      );
      const leaveDates = new Set<string>();
      for (const lr of empLeaves) {
        const start = new Date(Math.max(new Date(lr.startDate).getTime(), new Date(year, month, 1).getTime()));
        const end = new Date(Math.min(new Date(lr.endDate).getTime(), new Date(year, month + 1, 0).getTime()));
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          leaveDates.add(ds);
        }
      }

      for (let day = firstDay; day <= lastDay; day++) {
        const d = new Date(year, month, day);
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isOff = d.getDay() === salonConfig.weeklyOffDay;
        const rec = recordMap.get(ds);
        const hasLeave = leaveDates.has(ds);

        if (isOff) {
          const cv = rec ? compLeaveValue(rec, salonConfig) : 0;
          if (cv > 0 && rec?.status === 'half_day') {
            present += 0.5; off += 0.5; compOff += cv; // Half day on off-day
          } else if (cv > 0) {
            present++; compOff += cv; // Worked on off-day (comp: 0.5 or 1)
          } else {
            off++;
          }
        } else if (hasLeave && !rec) {
          leave++;
        } else if (rec) {
          if (rec.status === 'present' || rec.status === 'permission') {
            present++;
          } else if (rec.status === 'half_day') {
            present += 0.5; absent += 0.5;
          } else if (rec.status === 'absent') {
            absent++;
          } else if (rec.status === 'leave') {
            leave++;
          }
        } else {
          // No record on a working day — count as absent only for past days
          absent++;
        }
      }

      map.set(emp.id, { present, absent, off, leave, compOff });
    }
    return map;
  }, [employees, attendance, leaveRequests, selectedDate]);

  // ── Monthly calendar data per employee (day → status color) ──
  const monthlyCalendarData = useMemo(() => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const today = new Date();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const map = new Map<string, Map<number, DayStatus>>();

    for (const emp of employees) {
      const dayMap = new Map<number, DayStatus>();

      // Determine the first day to count for this employee (from joining date)
      const empJoinDate = (emp as any).joiningDate ? new Date((emp as any).joiningDate) : null;

      const empRecords = attendance.filter(a => {
        if (a.employeeId !== emp.id) return false;
        const d = new Date(a.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      const recordMap = new Map<string, Attendance>();
      empRecords.forEach(r => recordMap.set(r.date, r));

      const empLeaves = leaveRequests.filter(lr =>
        lr.employeeId === emp.id && lr.status === 'approved'
      );
      const leaveDates = new Set<string>();
      for (const lr of empLeaves) {
        const start = new Date(Math.max(new Date(lr.startDate).getTime(), new Date(year, month, 1).getTime()));
        const end = new Date(Math.min(new Date(lr.endDate).getTime(), new Date(year, month + 1, 0).getTime()));
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          leaveDates.add(ds);
        }
      }

      for (let day = 1; day <= totalDays; day++) {
        const d = new Date(year, month, day);
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isFuture = d > today;
        // Days before employee's joining date are shown as future (greyed out)
        const isBeforeJoining = empJoinDate && d < new Date(empJoinDate.getFullYear(), empJoinDate.getMonth(), empJoinDate.getDate());
        const isOff = d.getDay() === salonConfig.weeklyOffDay;
        const rec = recordMap.get(ds);
        const hasLeave = leaveDates.has(ds);

        if (isFuture || isBeforeJoining) {
          dayMap.set(day, 'future');
        } else if (isOff) {
          const cv = rec ? compLeaveValue(rec, salonConfig) : 0;
          if (cv > 0 && rec?.status === 'half_day') {
            dayMap.set(day, 'half_day');
          } else if (cv > 0) {
            dayMap.set(day, 'present');
          } else {
            dayMap.set(day, 'off');
          }
        } else if (hasLeave && !rec) {
          dayMap.set(day, 'leave');
        } else if (rec) {
          if (rec.status === 'half_day') {
            dayMap.set(day, 'half_day');
          } else if (rec.status === 'present' || rec.status === 'permission') {
            dayMap.set(day, 'present');
          } else if (rec.status === 'leave') {
            dayMap.set(day, 'leave');
          } else {
            dayMap.set(day, 'absent');
          }
        } else {
          dayMap.set(day, 'absent');
        }
      }
      map.set(emp.id, dayMap);
    }
    return map;
  }, [employees, attendance, leaveRequests, selectedDate]);

  // ── Requests tab data ──
  const allRequests: CombinedRequest[] = useMemo(() => {
    const leaves: CombinedRequest[] = leaveRequests.map(lr => ({
      ...lr,
      reqType: 'leave' as const,
      employeeName: profileMap.get(lr.employeeId) ?? 'Unknown',
    }));
    const perms: CombinedRequest[] = permissionRequests.map(pr => ({
      ...pr,
      reqType: 'permission' as const,
      employeeName: profileMap.get(pr.employeeId) ?? 'Unknown',
    }));
    return [...leaves, ...perms].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [leaveRequests, permissionRequests, profileMap]);

  const filteredRequests = useMemo(() => {
    if (requestTab === 'pending') return allRequests.filter(r => r.status === 'pending');
    if (requestTab === 'processed') return allRequests.filter(r => r.status !== 'pending');
    return allRequests;
  }, [allRequests, requestTab]);

  const pendingCount = allRequests.filter(r => r.status === 'pending').length;

  const handleOpenForm = (empId: string, empName: string, currentStatus: AttendanceStatus | null) => {
    setSelectedEmployee(empId);
    setSelectedEmployeeName(empName);

    // Pre-fill from existing record if editing
    const existing = dateAttendance.get(empId);
    if (existing) {
      setEditingId(existing.id);
      setSelectedStatus(existing.status);
      setNotes(existing.notes ?? '');
      // Parse check-in/check-out times
      if (existing.checkIn) {
        const ci = new Date(existing.checkIn);
        setCheckInTime(`${String(ci.getHours()).padStart(2, '0')}:${String(ci.getMinutes()).padStart(2, '0')}`);
      } else {
        setCheckInTime('');
      }
      if (existing.checkOut) {
        const co = new Date(existing.checkOut);
        setCheckOutTime(`${String(co.getHours()).padStart(2, '0')}:${String(co.getMinutes()).padStart(2, '0')}`);
      } else {
        setCheckOutTime('');
      }
      // Parse half day period from notes
      if (existing.status === 'half_day' && existing.notes) {
        setHalfDayPeriod(existing.notes.includes('Second Half') ? 'second_half' : 'first_half');
      } else {
        setHalfDayPeriod('first_half');
      }
      // Parse permission times from notes
      if (existing.status === 'permission' && existing.notes) {
        const match = existing.notes.match(/Permission:\s*(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
        if (match) {
          setPermFromTime(match[1]);
          setPermToTime(match[2]);
        } else {
          setPermFromTime('');
          setPermToTime('');
        }
      } else {
        setPermFromTime('');
        setPermToTime('');
      }
    } else {
      setEditingId(null);
      setSelectedStatus(currentStatus ?? 'present');
      setNotes('');
      setCheckInTime('');
      setCheckOutTime('');
      setPermFromTime('');
      setPermToTime('');
      setHalfDayPeriod('first_half');
    }
    setShowForm(true);
  };

  // Quick-mark attendance from the employee row
  const handleQuickMark = async (empId: string, empName: string, status: AttendanceStatus) => {
    if (!user) return;
    try {
      const existing = dateAttendance.get(empId);
      if (existing) {
        await updateAttendance({ id: existing.id, status, markedBy: user.id });
      } else {
        await addAttendance({ employeeId: empId, employeeName: empName, date: dateStr, status, markedBy: user.id });
      }
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to update');
    }
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !user) return;
    // Validate permission times
    if (selectedStatus === 'permission') {
      if (!permFromTime || !permToTime) {
        showAlert('Error', 'Please enter from and to time for permission');
        return;
      }
      const timeRegex = /^\d{1,2}:\d{2}$/;
      if (!timeRegex.test(permFromTime) || !timeRegex.test(permToTime)) {
        showAlert('Error', 'Please enter time in HH:MM format (e.g., 14:30)');
        return;
      }
    }
    setSubmitting(true);
    try {
      // Build notes with extra info
      let finalNotes = notes.trim();
      if (selectedStatus === 'half_day') {
        const periodLabel = halfDayPeriod === 'first_half' ? 'First Half' : 'Second Half';
        finalNotes = finalNotes ? `${periodLabel} | ${finalNotes}` : periodLabel;
      } else if (selectedStatus === 'permission') {
        const timeRange = `Permission: ${permFromTime.padStart(5, '0')}–${permToTime.padStart(5, '0')}`;
        finalNotes = finalNotes ? `${timeRange} | ${finalNotes}` : timeRange;
      }

      // Build check-in/check-out ISO strings from HH:MM input
      let checkInISO: string | undefined;
      let checkOutISO: string | undefined;
      const timeRegex24 = /^\d{1,2}:\d{2}$/;
      if (checkInTime && timeRegex24.test(checkInTime)) {
        const [h, m] = checkInTime.split(':').map(Number);
        const d = new Date(selectedDate);
        d.setHours(h, m, 0, 0);
        checkInISO = d.toISOString();
      }
      if (checkOutTime && timeRegex24.test(checkOutTime)) {
        const [h, m] = checkOutTime.split(':').map(Number);
        const d = new Date(selectedDate);
        d.setHours(h, m, 0, 0);
        checkOutISO = d.toISOString();
      }

      if (editingId) {
        await updateAttendance({
          id: editingId,
          status: selectedStatus,
          notes: finalNotes || undefined,
          markedBy: user.id,
          checkIn: checkInISO,
          checkOut: checkOutISO,
        });
      } else {
        await addAttendance({
          employeeId: selectedEmployee,
          employeeName: selectedEmployeeName,
          date: dateStr,
          status: selectedStatus,
          notes: finalNotes || undefined,
          markedBy: user.id,
          checkIn: checkInISO,
          checkOut: checkOutISO,
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ── Request actions ──
  const handleRequestAction = async (req: CombinedRequest, action: 'approved' | 'rejected') => {
    if (!user) return;
    setProcessingId(req.id);
    try {
      const update = {
        status: action as RequestStatus,
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString(),
      };
      if (req.reqType === 'leave') {
        await updateLeaveRequest({ id: req.id, ...update });
      } else {
        await updatePermissionRequest({ id: req.id, ...update });
      }
      showAlert('Success', `Request ${action}`);
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to update');
    } finally {
      setProcessingId(null);
    }
  };

  const renderEmployee = ({ item }: { item: typeof employeeList[0] }) => {
    const weeklyOff = isWeeklyOff(dateStr, salonConfig);
    const att = dateAttendance.get(item.id);
    const compValue = att ? compLeaveValue(att, salonConfig) : 0;
    const onLeave = employeesOnLeave.has(item.id);

    // Determine primary badge — one of: Present, Absent, Off, Leave
    let badgeLabel: string;
    let badgeBg: string;
    let badgeTextColor: string;
    // Secondary detail badge (comp, half day, permission, etc.)
    let detailLabel: string | null = null;
    let detailBg: string | null = null;
    let detailTextColor: string | null = null;

    if (onLeave && !item.status) {
      // Approved leave, no attendance marked
      badgeLabel = 'LEAVE';
      badgeBg = '#DBEAFE';
      badgeTextColor = '#2563EB';
    } else if (weeklyOff) {
      if (item.status && compValue > 0) {
        // Worked on weekly off — show Present + comp detail
        badgeLabel = 'PRESENT';
        badgeBg = '#D1FAE5';
        badgeTextColor = '#059669';
        detailLabel = compValue >= 1 ? 'COMP +1' : 'COMP +0.5';
        detailBg = '#EDE9FE';
        detailTextColor = '#7C3AED';
      } else {
        // Weekly off, didn't work enough
        badgeLabel = 'OFF';
        badgeBg = '#E0E7FF';
        badgeTextColor = '#4338CA';
      }
    } else if (item.status === 'present' || item.status === 'permission') {
      badgeLabel = 'PRESENT';
      badgeBg = '#D1FAE5';
      badgeTextColor = '#059669';
      if (item.status === 'permission') {
        detailLabel = 'PERMISSION';
        detailBg = '#DBEAFE';
        detailTextColor = '#2563EB';
      }
    } else if (item.status === 'half_day') {
      badgeLabel = 'PRESENT';
      badgeBg = '#D1FAE5';
      badgeTextColor = '#059669';
      detailLabel = 'HALF DAY';
      detailBg = '#FEF3C7';
      detailTextColor = '#D97706';
    } else if (item.status === 'absent') {
      badgeLabel = 'ABSENT';
      badgeBg = '#FEE2E2';
      badgeTextColor = '#DC2626';
    } else {
      // No status marked
      if (onLeave) {
        badgeLabel = 'LEAVE';
        badgeBg = '#DBEAFE';
        badgeTextColor = '#2563EB';
      } else {
        badgeLabel = 'ABSENT';
        badgeBg = '#FEE2E2';
        badgeTextColor = '#DC2626';
      }
    }

    // Determine which of the 4 options is active
    let activeStatus: 'present' | 'absent' | 'off' | 'leave';
    if (onLeave && !item.status) {
      activeStatus = 'leave';
    } else if (weeklyOff && (!item.status || (item.status && compValue === 0))) {
      activeStatus = 'off';
    } else if (item.status === 'present' || item.status === 'half_day' || item.status === 'permission') {
      activeStatus = 'present';
    } else if (item.status === 'absent') {
      activeStatus = 'absent';
    } else if (weeklyOff && compValue > 0) {
      activeStatus = 'present';
    } else {
      activeStatus = onLeave ? 'leave' : 'absent';
    }

    const STATUS_PILLS: { key: 'present' | 'absent' | 'off' | 'leave'; label: string; bg: string; color: string; activeBg: string }[] = [
      { key: 'present', label: 'Present', bg: '#F0FDF4', color: '#059669', activeBg: '#D1FAE5' },
      { key: 'absent', label: 'Absent', bg: '#FEF2F2', color: '#DC2626', activeBg: '#FEE2E2' },
      { key: 'off', label: 'Off', bg: '#EEF2FF', color: '#4338CA', activeBg: '#E0E7FF' },
      { key: 'leave', label: 'Leave', bg: '#FFF7ED', color: '#EA580C', activeBg: '#FFEDD5' },
    ];

    const empStats = monthlyStats.get(item.id) ?? { present: 0, absent: 0, off: 0, leave: 0, compOff: 0 };

    const isExpanded = expandedEmpIds.has(item.id);

    return (
      <View style={styles.empCard}>
        <TouchableOpacity
          style={styles.empNameRow}
          onPress={() => toggleExpand(item.id)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{item.name}</Text>
            {item.checkIn && (
              <Text style={styles.empTime}>
                {formatTime(item.checkIn)}{item.checkOut ? `  →  ${formatTime(item.checkOut)}` : '  (checked in)'}
              </Text>
            )}
          </View>
          {isExpanded ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
        </TouchableOpacity>
        {isExpanded && <>
          <View style={styles.quickPillRow}>
          {STATUS_PILLS.map(pill => {
            const isActive = activeStatus === pill.key;
            const isOff = pill.key === 'off';
            const isLeaveKey = pill.key === 'leave';
            const count = empStats[pill.key];
            return (
              <TouchableOpacity
                key={pill.key}
                style={[
                  styles.quickPill,
                  { backgroundColor: isActive ? pill.activeBg : pill.bg, borderColor: isActive ? pill.color : 'transparent', borderWidth: isActive ? 1.5 : 0 },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (isOff || isLeaveKey) {
                    handleOpenForm(item.id, item.name, item.status);
                    return;
                  }
                  if (pill.key === 'present') handleQuickMark(item.id, item.name, 'present');
                  else if (pill.key === 'absent') handleQuickMark(item.id, item.name, 'absent');
                }}
              >
                <Text style={[styles.quickPillCount, { color: pill.color }]}>
                  {count}
                </Text>
                <Text style={[styles.quickPillText, { color: pill.color, fontWeight: isActive ? '800' : '600' }]}>
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={[styles.quickPill, { backgroundColor: '#FDF2F8', borderWidth: 0 }]}>
            <Text style={[styles.quickPillCount, { color: '#9D174D' }]}>{empStats.compOff}</Text>
            <Text style={[styles.quickPillText, { color: '#9D174D' }]}>Comp</Text>
          </View>
          </View>

          {/* Calendar grid */}
          {(() => {
            const month = selectedDate.getMonth();
            const year = selectedDate.getFullYear();
            const totalDays = new Date(year, month + 1, 0).getDate();
            const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
            const empCalendar = monthlyCalendarData.get(item.id);
            const monthLabel = selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

            // Build cells: empty slots + day cells
            const cells: (number | null)[] = [];
            for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
            for (let d = 1; d <= totalDays; d++) cells.push(d);
            // Fill remaining cells to complete last row
            while (cells.length % 7 !== 0) cells.push(null);

            return (
              <View style={styles.calendarContainer}>
                <Text style={styles.calendarMonth}>{monthLabel}</Text>
                {/* Day headers */}
                <View style={styles.calendarRow}>
                  {DAY_LABELS.map((label, i) => (
                    <View key={i} style={styles.calendarHeaderCell}>
                      <Text style={styles.calendarHeaderText}>{label}</Text>
                    </View>
                  ))}
                </View>
                {/* Day grid */}
                {Array.from({ length: cells.length / 7 }, (_, weekIdx) => (
                  <View key={weekIdx} style={styles.calendarRow}>
                    {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, i) => {
                      if (day === null) {
                        return <View key={i} style={styles.calendarCell} />;
                      }
                      const status = empCalendar?.get(day) ?? 'future';
                      const colors = CAL_STATUS_COLORS[status];
                      const todayNow = new Date();
                      const isTodayCell = todayNow.getFullYear() === year && todayNow.getMonth() === month && todayNow.getDate() === day;
                      const isSelected = selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[styles.calendarCell, { backgroundColor: colors.bg }, isTodayCell && styles.calendarToday, isSelected && styles.calendarSelected]}
                          activeOpacity={0.6}
                          onPress={() => {
                            const d = new Date(year, month, day);
                            setSelectedDate(d);
                          }}
                        >
                          <Text style={[styles.calendarDayText, { color: colors.text }]}>{day}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
                {/* Legend */}
                <View style={styles.calendarLegend}>
                  {CAL_LEGEND_ITEMS.map(l => (
                    <View key={l.status} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: CAL_STATUS_COLORS[l.status].bg, borderColor: CAL_STATUS_COLORS[l.status].text }]} />
                      <Text style={styles.legendText}>{l.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Edit button */}
                <TouchableOpacity
                  style={styles.calendarEditBtn}
                  onPress={() => handleOpenForm(item.id, item.name, item.status)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.calendarEditText}>Edit Attendance — {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </>}
      </View>
    );
  };

  const renderRequest = ({ item }: { item: CombinedRequest }) => {
    const colors = REQUEST_STATUS_COLORS[item.status] ?? REQUEST_STATUS_COLORS.pending;
    const isLeave = item.reqType === 'leave';
    const leaveItem = item as LeaveRequest & { reqType: string; employeeName: string };
    const permItem = item as PermissionRequest & { reqType: string; employeeName: string };
    const isPending = item.status === 'pending';
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reqEmpName}>{item.employeeName}</Text>
            <Text style={styles.reqDate}>Requested {formatDate(item.createdAt)}</Text>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: isLeave ? '#FFEDD5' : '#FEF3C7' }]}>
            <Text style={[styles.typeText, { color: isLeave ? '#EA580C' : '#D97706' }]}>
              {isLeave ? (leaveItem.type === 'compensation' ? 'COMP LEAVE' : 'LEAVE') : 'PERMISSION'}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          {isLeave ? (
            <Text style={styles.detailText}>
              {formatDate(leaveItem.startDate)} → {formatDate(leaveItem.endDate)}
            </Text>
          ) : (
            <Text style={styles.detailText}>
              {formatDate(permItem.date)} | {permItem.fromTime} → {permItem.toTime}
            </Text>
          )}
        </View>

        {(isLeave ? leaveItem.reason : permItem.reason) ? (
          <Text style={styles.reason} numberOfLines={2}>
            {isLeave ? leaveItem.reason : permItem.reason}
          </Text>
        ) : null}

        {isPending ? (
          <View style={styles.reqActionRow}>
            <TouchableOpacity
              style={[styles.reqActionBtn, styles.rejectBtn]}
              onPress={() => handleRequestAction(item, 'rejected')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <X size={16} color="#DC2626" />
                  <Text style={[styles.reqActionText, { color: '#DC2626' }]}>Reject</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reqActionBtn, styles.approveBtn]}
              onPress={() => handleRequestAction(item, 'approved')}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Check size={16} color="#fff" />
                  <Text style={[styles.reqActionText, { color: '#fff' }]}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.statusRow, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusLabel, { color: colors.text }]}>
              {item.status.toUpperCase()}
            </Text>
            {(item as any).reviewedAt && (
              <Text style={[styles.reviewedAt, { color: colors.text }]}>
                on {formatDate((item as any).reviewedAt)}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  // Employees on approved leave for selected date
  const employeesOnLeave = useMemo(() => {
    const set = new Set<string>();
    for (const lr of leaveRequests) {
      if (lr.status !== 'approved') continue;
      const start = new Date(lr.startDate);
      const end = new Date(lr.endDate);
      const sel = new Date(dateStr);
      if (sel >= start && sel <= end) {
        set.add(lr.employeeId);
      }
    }
    return set;
  }, [leaveRequests, dateStr]);

  // Summary counts — monthly totals across all employees (consistent with per-employee pills)
  const weeklyOffDate = isWeeklyOff(dateStr, salonConfig);
  const summaryTotals = useMemo(() => {
    let present = 0, absent = 0, off = 0, leave = 0, compOff = 0;
    for (const emp of employeeList) {
      const s = monthlyStats.get(emp.id);
      if (s) {
        present += s.present;
        absent += s.absent;
        off += s.off;
        leave += s.leave;
        compOff += s.compOff;
      }
    }
    return { present, absent, off, leave, compOff };
  }, [employeeList, monthlyStats]);
  const presentCount = summaryTotals.present;
  const absentCount = summaryTotals.absent;
  const offCount = summaryTotals.off;
  const leaveCount = summaryTotals.leave;
  const compOffCount = summaryTotals.compOff;

  return (
    <View style={styles.container}>
      {/* Main tabs: Attendance / Requests */}
      <View style={styles.mainTabRow}>
        <TouchableOpacity
          style={[styles.mainTabBtn, mainTab === 'attendance' && styles.mainTabBtnActive]}
          onPress={() => setMainTab('attendance')}
        >
          <Text style={[styles.mainTabText, mainTab === 'attendance' && styles.mainTabTextActive]}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTabBtn, mainTab === 'requests' && styles.mainTabBtnActive]}
          onPress={() => setMainTab('requests')}
        >
          <Text style={[styles.mainTabText, mainTab === 'requests' && styles.mainTabTextActive]}>
            Requests{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {mainTab === 'attendance' ? (
        <>
          {/* Month selector */}
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => setSelectedDate(prev => {
                const d = new Date(prev);
                d.setMonth(d.getMonth() - 1, 1);
                return d;
              })}
            >
              <ChevronLeft size={22} color={Colors.primary} />
            </TouchableOpacity>
            <View style={[styles.dateSelector, isToday && styles.dateSelectorToday]}>
              <Text style={[styles.dateSelectorText, isToday && styles.dateSelectorTextToday]}>
                {selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => setSelectedDate(prev => {
                const d = new Date(prev);
                d.setMonth(d.getMonth() + 1, 1);
                return d;
              })}
            >
              <ChevronRight size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryPill, { backgroundColor: '#A7F3D0' }]}>
              <Text style={[styles.summaryNum, { color: '#047857' }]}>{presentCount}</Text>
              <Text style={[styles.summaryLabel, { color: '#047857' }]}>Present</Text>
            </View>
            <View style={[styles.summaryPill, { backgroundColor: '#FECACA' }]}>
              <Text style={[styles.summaryNum, { color: '#B91C1C' }]}>{absentCount}</Text>
              <Text style={[styles.summaryLabel, { color: '#B91C1C' }]}>Absent</Text>
            </View>
            <View style={[styles.summaryPill, { backgroundColor: '#C7D2FE' }]}>
              <Text style={[styles.summaryNum, { color: '#3730A3' }]}>{offCount}</Text>
              <Text style={[styles.summaryLabel, { color: '#3730A3' }]}>Off</Text>
            </View>
            <View style={[styles.summaryPill, { backgroundColor: '#FED7AA' }]}>
              <Text style={[styles.summaryNum, { color: '#C2410C' }]}>{leaveCount}</Text>
              <Text style={[styles.summaryLabel, { color: '#C2410C' }]}>Leave</Text>
            </View>
            <View style={[styles.summaryPill, { backgroundColor: '#FBCFE8' }]}>
              <Text style={[styles.summaryNum, { color: '#9D174D' }]}>{compOffCount}</Text>
              <Text style={[styles.summaryLabel, { color: '#9D174D' }]}>Comp</Text>
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
        </>
      ) : (
        <>
          {/* Request filter tabs */}
          <View style={styles.requestTabRow}>
            {(['all', 'pending', 'processed'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.requestTabBtn, requestTab === t && styles.requestTabBtnActive]}
                onPress={() => setRequestTab(t)}
              >
                <Text style={[styles.requestTabText, requestTab === t && styles.requestTabTextActive]}>
                  {t === 'all' ? 'All' : t === 'pending' ? `Pending (${pendingCount})` : 'Processed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={filteredRequests}
            keyExtractor={item => item.id}
            renderItem={renderRequest}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {requestTab === 'pending' ? 'No pending requests' : 'No requests found'}
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* Mark/Override Form */}
      <BottomSheetModal visible={showForm} onRequestClose={() => setShowForm(false)}>
        <View style={styles.formHeader}>
          <View>
            <Text style={styles.formTitle}>{editingId ? 'Edit Attendance' : 'Mark Attendance'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.formSubtitle}>
                {employees.find((e: any) => e.id === selectedEmployee)?.name ?? 'Employee'} — {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </Text>
              {(() => {
                const existing = selectedEmployee ? dateAttendance.get(selectedEmployee) : null;
                if (!existing) return <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600' }}>No record</Text>;
                const statusMap: Record<string, { label: string; bg: string; color: string }> = {
                  present: { label: 'Present', bg: '#D1FAE5', color: '#059669' },
                  absent: { label: 'Absent', bg: '#FEE2E2', color: '#DC2626' },
                  half_day: { label: 'Half Day', bg: '#FEF3C7', color: '#D97706' },
                  permission: { label: 'Permission', bg: '#DBEAFE', color: '#2563EB' },
                  leave: { label: 'Leave', bg: '#FFEDD5', color: '#EA580C' },
                };
                const s = statusMap[existing.status] ?? { label: existing.status, bg: '#F3F4F6', color: '#6B7280' };
                return (
                  <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: s.color }}>{s.label}</Text>
                  </View>
                );
              })()}
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowForm(false)}>
            <X size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

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

        {/* Comp Off Leave */}
        {(() => {
          const now = new Date();
          const month = now.getMonth();
          const year = now.getFullYear();
          const empId = selectedEmployee;
          if (!empId) return null;
          const earned = attendance
            .filter(a => a.employeeId === empId && new Date(a.date).getMonth() === month && new Date(a.date).getFullYear() === year)
            .reduce((sum, a) => sum + compLeaveValue(a, salonConfig), 0);
          const used = leaveRequests.filter(lr =>
            lr.employeeId === empId && lr.type === 'compensation' && lr.status === 'approved' &&
            new Date(lr.startDate).getMonth() === month && new Date(lr.startDate).getFullYear() === year
          ).length;
          const balance = earned - used;
          const hasBalance = balance > 0;
          return (
            <TouchableOpacity
              style={[styles.statusOption, { marginTop: 8, opacity: hasBalance ? 1 : 0.4 }, hasBalance && { backgroundColor: '#7C3AED18', borderColor: '#7C3AED' }]}
              disabled={!hasBalance}
              onPress={async () => {
                if (!user || !empId) return;
                const empName = employees.find((e: any) => e.id === empId)?.name ?? '';
                const dateStr = toLocalDateString(selectedDate);
                setSubmitting(true);
                try {
                  await addLeaveRequest({ employeeId: empId, employeeName: empName, type: 'compensation', startDate: dateStr, endDate: dateStr, reason: 'Comp off leave (by admin)' });
                  setShowForm(false);
                  showAlert('Success', 'Comp off leave applied');
                } catch (err: any) {
                  showAlert('Error', err?.message || 'Failed to apply comp off');
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <Gift size={16} color={hasBalance ? '#7C3AED' : Colors.textTertiary} />
              <Text style={[styles.statusOptionText, hasBalance && { color: '#7C3AED', fontWeight: '700' }]}>
                Comp Off Leave ({balance})
              </Text>
            </TouchableOpacity>
          );
        })()}

        {/* Half Day: First/Second Half selector */}
        {selectedStatus === 'half_day' && (
          <>
            <Text style={styles.fieldLabel}>Period</Text>
            <View style={styles.statusOptions}>
              {([{ value: 'first_half', label: 'First Half (Morning)' }, { value: 'second_half', label: 'Second Half (Afternoon)' }] as const).map(opt => {
                const isSelected = halfDayPeriod === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.statusOption, isSelected && { backgroundColor: '#D9770618', borderColor: '#D97706' }]}
                    onPress={() => setHalfDayPeriod(opt.value)}
                  >
                    <Clock size={16} color={isSelected ? '#D97706' : Colors.textTertiary} />
                    <Text style={[styles.statusOptionText, isSelected && { color: '#D97706', fontWeight: '700' }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Permission: From/To time */}
        {selectedStatus === 'permission' && (
          <>
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
          </>
        )}

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

        {/* Check-in / Check-out time fields — only for present */}
        {selectedStatus === 'present' && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Check-in (HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={checkInTime}
              onChangeText={setCheckInTime}
              placeholder="e.g. 09:00"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Check-out (HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={checkOutTime}
              onChangeText={setCheckOutTime}
              placeholder="e.g. 18:00"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>{editingId ? 'Update Attendance' : 'Save Attendance'}</Text>}
        </TouchableOpacity>

        {editingId && (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: '#FEE2E2', marginTop: 10 }]}
            onPress={async () => {
              if (!editingId) return;
              setDeleting(true);
              try {
                await deleteAttendance(editingId);
                setShowForm(false);
                showAlert('Deleted', 'Attendance record removed');
              } catch (err: any) {
                showAlert('Error', err?.message || 'Failed to delete');
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
          >
            {deleting ? <ActivityIndicator color="#DC2626" size="small" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Trash2 size={16} color="#DC2626" />
                <Text style={[styles.submitText, { color: '#DC2626' }]}>Delete Attendance</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        </ScrollView>
      </BottomSheetModal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Main tabs (Attendance / Requests)
  mainTabRow: {
    flexDirection: 'row',
    padding: Spacing.screen,
    paddingBottom: 0,
    gap: 8,
  },
  mainTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mainTabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  mainTabText: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  mainTabTextActive: {
    color: '#fff',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.screen,
    marginTop: Spacing.sm,
    gap: 8,
  },
  dateArrow: {
    width: 40,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateSelectorToday: {
    backgroundColor: '#FFF0F3',
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  dateSelectorText: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.text,
  },
  dateSelectorTextToday: {
    color: Colors.primary,
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
  empNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
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
  },
  empNotes: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  quickPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  quickPillCount: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  quickPillText: {
    fontSize: FontSize.xs,
  },
  calendarContainer: {
    marginTop: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: BorderRadius.md,
    padding: 10,
  },
  calendarMonth: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  calendarHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  calendarCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
    margin: 1.5,
    borderRadius: 6,
  },
  calendarToday: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  calendarSelected: {
    borderWidth: 2,
    borderColor: '#1E40AF',
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 11,
    fontWeight: '700',
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  calendarEditBtn: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  calendarEditText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
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
  // Request tab styles
  requestTabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    gap: 8,
  },
  requestTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestTabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  requestTabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  requestTabTextActive: {
    color: '#fff',
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reqEmpName: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.text,
  },
  reqDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  typeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  detailRow: {
    marginBottom: 4,
  },
  detailText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  reason: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  reqActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.md,
  },
  reqActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
  },
  approveBtn: {
    backgroundColor: '#059669',
  },
  reqActionText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  statusLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  reviewedAt: {
    fontSize: FontSize.xs,
    fontWeight: '500',
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
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
