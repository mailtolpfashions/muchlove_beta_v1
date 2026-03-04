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
  Switch,
} from 'react-native';
import { ChevronLeft, ChevronRight, CalendarPlus, Clock, FileText, Award, ChevronDown, X, AlertCircle, ClipboardEdit } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useAlert } from '@/providers/AlertProvider';
import BottomSheetModal from '@/components/BottomSheetModal';
import { useFocusEffect } from 'expo-router';
import DatePickerModal from '@/components/DatePickerModal';
import type { LeaveRequest, PermissionRequest, Attendance } from '@/types';
import { isWeeklyOff, compLeaveValue, computeCompBalance, computeEarnedLeaveBalance, computeLeaveBalance } from '@/utils/salary';
import { toLocalDateString } from '@/utils/format';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#D97706' },
  approved: { bg: '#D1FAE5', text: '#059669' },
  rejected: { bg: '#FEE2E2', text: '#DC2626' },
};

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

export default function AttendanceScreen() {
  const { user } = useAuth();
  const { attendance, leaveRequests, permissionRequests, addLeaveRequest, addPermissionRequest, updateLeaveRequest, reload, salonConfig } = useData();
  const { showAlert } = useAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelledIds, setCancelledIds] = useState<string[]>([]);

  const [tab, setTab] = useState<'attendance' | 'requests'>('attendance');

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showPermissionForm, setShowPermissionForm] = useState(false);
  const [showCompLeaveForm, setShowCompLeaveForm] = useState(false);
  const [showEarnedLeaveForm, setShowEarnedLeaveForm] = useState(false);
  const [showDateActions, setShowDateActions] = useState(false);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);

  const [leaveStartDate, setLeaveStartDate] = useState<Date | null>(null);
  const [leaveEndDate, setLeaveEndDate] = useState<Date | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'first_half' | 'second_half'>('first_half');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [permDate, setPermDate] = useState<Date | null>(null);
  const [permFromTime, setPermFromTime] = useState('');
  const [permToTime, setPermToTime] = useState('');
  const [permReason, setPermReason] = useState('');
  const [showPermDatePicker, setShowPermDatePicker] = useState(false);

  const [compDate, setCompDate] = useState<Date | null>(null);
  const [compReason, setCompReason] = useState('');
  const [showCompDatePicker, setShowCompDatePicker] = useState(false);

  const [earnedDate, setEarnedDate] = useState<Date | null>(null);
  const [earnedReason, setEarnedReason] = useState('');
  const [showEarnedDatePicker, setShowEarnedDatePicker] = useState(false);

  const [correctionReason, setCorrectionReason] = useState('');

  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear();

  // Month navigation bounds: joining date → current month + 6
  const joiningDate = user?.joiningDate ? new Date(user.joiningDate) : null;
  const joiningMonth = joiningDate ? joiningDate.getMonth() : now.getMonth();
  const joiningYear = joiningDate ? joiningDate.getFullYear() : now.getFullYear();

  const canGoPrev = viewYear > joiningYear ||
    (viewYear === joiningYear && viewMonth > joiningMonth);
  const sixMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 6, 1);
  const canGoNext = viewYear < sixMonthsAhead.getFullYear() ||
    (viewYear === sixMonthsAhead.getFullYear() && viewMonth < sixMonthsAhead.getMonth());

  const goPrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const goNextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // Auto-refresh when screen gains focus
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  /* ── My data ── */
  const myAttendance = useMemo(() => {
    if (!user) return [];
    return attendance.filter(a => a.employeeId === user.id);
  }, [attendance, user]);

  const myLeaveRequests = useMemo(() => {
    if (!user) return [];
    return leaveRequests
      .filter(lr => lr.employeeId === user.id)
      .map(lr => cancelledIds.includes(lr.id) ? { ...lr, status: 'rejected' as const } : lr);
  }, [leaveRequests, user, cancelledIds]);

  const myPermissionRequests = useMemo(() => {
    if (!user) return [];
    return permissionRequests.filter(pr => pr.employeeId === user.id);
  }, [permissionRequests, user]);

  /* ── Monthly stats ── */
  const monthlyStats = useMemo(() => {
    if (!user) return { present: 0, absent: 0, off: 0, leaveConsumed: 0, leaveBalance: 0, paidLeaves: 0, compOff: 0 };
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const lastDay = (today.getFullYear() === viewYear && today.getMonth() === viewMonth) ? today.getDate() : totalDays;

    const jd = user.joiningDate ? new Date(user.joiningDate) : null;
    const monthStart = new Date(viewYear, viewMonth, 1);
    const firstDay = jd && jd > monthStart ? jd.getDate() : 1;
    if (jd && (jd.getFullYear() > viewYear || (jd.getFullYear() === viewYear && jd.getMonth() > viewMonth))) {
      return { present: 0, absent: 0, off: 0, leaveConsumed: 0, leaveBalance: 0, paidLeaves: 0, compOff: 0 };
    }

    const recordMap = new Map<string, Attendance>();
    myAttendance.forEach(a => {
      const d = new Date(a.date);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) recordMap.set(a.date, a);
    });

    const leaveDates = new Set<string>();
    for (const lr of myLeaveRequests) {
      if (lr.status === 'rejected') continue;
      const start = new Date(Math.max(new Date(lr.startDate).getTime(), monthStart.getTime()));
      const end = new Date(Math.min(new Date(lr.endDate).getTime(), new Date(viewYear, viewMonth + 1, 0).getTime()));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        leaveDates.add(yy + '-' + mm + '-' + dd);
      }
    }

    let present = 0, absent = 0, off = 0, leaveConsumed = 0, compOff = 0;
    for (let day = firstDay; day <= lastDay; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const ds = viewYear + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const isOff = d.getDay() === salonConfig.weeklyOffDay;
      const rec = recordMap.get(ds);
      const hasLeave = leaveDates.has(ds);

      if (isOff) {
        const cv = rec ? compLeaveValue(rec, salonConfig) : 0;
        if (cv > 0 && rec?.status === 'half_day') { present += 0.5; off += 0.5; compOff += cv; }
        else if (cv > 0) { present++; compOff += cv; }
        else off++;
      } else if (hasLeave && !rec) {
        leaveConsumed++;
      } else if (rec) {
        if (rec.status === 'present') present++;
        else if (rec.status === 'permission') { present++; } // permission hours tracked separately
        else if (rec.status === 'half_day') { present += 0.5; leaveConsumed += 0.5; }
        else if (rec.status === 'absent') absent++;
        else if (rec.status === 'leave') leaveConsumed++;
      } else {
        absent++;
      }
    }

    // Add permission hours as leave days consumed
    let permHours = 0;
    myPermissionRequests.filter(pr => {
      if (pr.status === 'rejected') return false;
      const d = new Date(pr.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }).forEach(pr => {
      const from = pr.fromTime.split(':');
      const to = pr.toTime.split(':');
      const fromMin = parseInt(from[0]) * 60 + parseInt(from[1]);
      const toMin = parseInt(to[0]) * 60 + parseInt(to[1]);
      permHours += Math.max(0, (toMin - fromMin) / 60);
    });
    if (salonConfig.workingHoursPerDay > 0) {
      leaveConsumed += permHours / salonConfig.workingHoursPerDay;
    }

    // Compute leave balance (actual — for display)
    const balResult = computeLeaveBalance(myAttendance, myLeaveRequests, user.joiningDate, salonConfig);
    const leaveBalance = balResult.totalBalance;

    // Effective balance for paid/excess (exclude current month to avoid double-counting typed leaves)
    const effectiveBalResult = computeLeaveBalance(myAttendance, myLeaveRequests, user.joiningDate, salonConfig, { year: viewYear, month: viewMonth });
    const effectiveBalance = effectiveBalResult.totalBalance;

    const paidLeaves = Math.min(leaveConsumed, effectiveBalance);
    const excessLeaves = Math.max(0, leaveConsumed - effectiveBalance);
    absent += excessLeaves;

    return { present, absent, off, leaveConsumed, leaveBalance, paidLeaves, compOff };
  }, [myAttendance, myLeaveRequests, myPermissionRequests, viewMonth, viewYear, user, salonConfig]);

  /* ── Calendar day data ── */
  const calendarData = useMemo(() => {
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const jd = user?.joiningDate ? new Date(user.joiningDate) : null;

    const recordMap = new Map<string, Attendance>();
    myAttendance.forEach(a => {
      const d = new Date(a.date);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) recordMap.set(a.date, a);
    });

    const leaveDates = new Set<string>();
    for (const lr of myLeaveRequests) {
      if (lr.status === 'rejected') continue;
      const start = new Date(Math.max(new Date(lr.startDate).getTime(), new Date(viewYear, viewMonth, 1).getTime()));
      const end = new Date(Math.min(new Date(lr.endDate).getTime(), new Date(viewYear, viewMonth + 1, 0).getTime()));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        leaveDates.add(yy + '-' + mm + '-' + dd);
      }
    }

    const dayMap = new Map<number, { status: DayStatus; attendance: Attendance | null; dateStr: string }>();
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const ds = viewYear + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const isFuture = d > today;
      const isBeforeJoining = jd ? d < new Date(jd.getFullYear(), jd.getMonth(), jd.getDate()) : false;
      const isOff = d.getDay() === salonConfig.weeklyOffDay;
      const rec = recordMap.get(ds) || null;
      const hasLeave = leaveDates.has(ds);

      let status: DayStatus;
      if (isFuture || isBeforeJoining) {
        // Future days with an approved/pending leave should show as 'leave'
        status = hasLeave ? 'leave' : 'future';
      } else if (isOff) {
        const cv = rec ? compLeaveValue(rec, salonConfig) : 0;
        status = cv > 0 ? (rec?.status === 'half_day' ? 'half_day' : 'present') : 'off';
      } else if (hasLeave && !rec) {
        status = 'leave';
      } else if (rec) {
        if (rec.status === 'half_day') status = 'half_day';
        else if (rec.status === 'present' || rec.status === 'permission') status = 'present';
        else if (rec.status === 'leave') status = 'leave';
        else status = 'absent';
      } else {
        status = 'absent';
      }
      dayMap.set(day, { status, attendance: rec, dateStr: ds });
    }
    return dayMap;
  }, [myAttendance, myLeaveRequests, viewMonth, viewYear, user, salonConfig]);

  /* ── Balances ── */
  const compBalance = useMemo(() => {
    if (!user) return 0;
    return computeCompBalance(
      myAttendance,
      myLeaveRequests,
      salonConfig,
    );
  }, [myAttendance, myLeaveRequests, user, salonConfig]);

  const earnedLeaveBalance = useMemo(() => {
    if (!user) return 0;
    return computeEarnedLeaveBalance(
      myLeaveRequests,
      user.joiningDate,
      salonConfig,
    );
  }, [myLeaveRequests, user, salonConfig]);

  /* ── Month records for list ── */
  const monthRecords = useMemo(() => {
    return myAttendance
      .filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [myAttendance, viewMonth, viewYear]);

  /* ── Combined requests ── */
  const myRequests = useMemo(() => {
    if (!user) return [];
    const leaves = myLeaveRequests
      .map(lr => ({ ...lr, reqType: 'leave' as const }));
    const perms = permissionRequests
      .filter(pr => pr.employeeId === user.id)
      .map(pr => ({ ...pr, reqType: 'permission' as const }));
    return [...leaves, ...perms].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [myLeaveRequests, permissionRequests, user]);

  /* ── Resets ── */
  const resetLeaveForm = () => { setLeaveStartDate(null); setLeaveEndDate(null); setLeaveReason(''); setIsHalfDay(false); setHalfDayPeriod('first_half'); };
  const resetPermissionForm = () => { setPermDate(null); setPermFromTime(''); setPermToTime(''); setPermReason(''); };
  const resetCompForm = () => { setCompDate(null); setCompReason(''); };
  const resetEarnedForm = () => { setEarnedDate(null); setEarnedReason(''); };

  /* ── Calendar date tap (first tap selects, second tap on same date opens actions) ── */
  const handleCalendarDatePress = (day: number) => {
    const data = calendarData.get(day);
    if (!data) return;
    if (selectedDay === day) {
      // Second tap on same date → open actions
      setShowDateActions(true);
    } else {
      // First tap → just select/highlight
      setSelectedDay(day);
    }
  };

  const selectedDate = selectedDay ? new Date(viewYear, viewMonth, selectedDay) : null;
  const selectedDayData = selectedDay ? calendarData.get(selectedDay) : null;

  const openLeaveFromCalendar = () => { if (!selectedDate) return; resetLeaveForm(); setLeaveStartDate(selectedDate); setLeaveEndDate(selectedDate); setShowDateActions(false); setShowLeaveForm(true); };
  const openPermissionFromCalendar = () => { if (!selectedDate) return; resetPermissionForm(); setPermDate(selectedDate); setShowDateActions(false); setShowPermissionForm(true); };
  const openCompFromCalendar = () => { if (!selectedDate) return; resetCompForm(); setCompDate(selectedDate); setShowDateActions(false); setShowCompLeaveForm(true); };
  const openEarnedFromCalendar = () => { if (!selectedDate) return; resetEarnedForm(); setEarnedDate(selectedDate); setShowDateActions(false); setShowEarnedLeaveForm(true); };
  const openCorrectionFromCalendar = () => { setCorrectionReason(''); setShowDateActions(false); setShowCorrectionForm(true); };

  /* ── Submit handlers ── */
  const handleSubmitLeave = async () => {
    if (!user || !leaveStartDate) { showAlert('Error', 'Please select a date'); return; }
    const effectiveEndDate = isHalfDay ? leaveStartDate : leaveEndDate;
    if (!effectiveEndDate) { showAlert('Error', 'Please select start and end dates'); return; }
    if (effectiveEndDate < leaveStartDate) { showAlert('Error', 'End date must be after start date'); return; }
    setSubmitting(true);
    try {
      let reason = leaveReason.trim();
      if (isHalfDay) {
        const periodLabel = halfDayPeriod === 'first_half' ? 'First Half' : 'Second Half';
        reason = reason ? 'Half Day (' + periodLabel + ') | ' + reason : 'Half Day (' + periodLabel + ')';
      }
      await addLeaveRequest({ employeeId: user.id, employeeName: user.name, type: 'leave', startDate: toLocalDateString(leaveStartDate), endDate: toLocalDateString(effectiveEndDate), reason: reason || undefined });
      setShowLeaveForm(false); resetLeaveForm();
      showAlert('Success', 'Leave request submitted');
    } catch (err: any) { showAlert('Error', err?.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const handleSubmitPermission = async () => {
    if (!user || !permDate || !permFromTime || !permToTime) { showAlert('Error', 'Please fill all fields'); return; }
    const timeRegex = /^\d{1,2}:\d{2}$/;
    if (!timeRegex.test(permFromTime) || !timeRegex.test(permToTime)) { showAlert('Error', 'Please enter time in HH:MM format (e.g., 14:30)'); return; }
    setSubmitting(true);
    try {
      await addPermissionRequest({ employeeId: user.id, employeeName: user.name, date: toLocalDateString(permDate), fromTime: permFromTime.padStart(5, '0'), toTime: permToTime.padStart(5, '0'), reason: permReason.trim() || undefined });
      setShowPermissionForm(false); resetPermissionForm();
      showAlert('Success', 'Permission request submitted');
    } catch (err: any) { showAlert('Error', err?.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const handleSubmitCompLeave = async () => {
    if (!user || !compDate) { showAlert('Error', 'Please select a date'); return; }
    if (compBalance <= 0) { showAlert('Error', 'No compensation leave balance available'); return; }
    setSubmitting(true);
    try {
      await addLeaveRequest({ employeeId: user.id, employeeName: user.name, type: 'compensation', startDate: toLocalDateString(compDate), endDate: toLocalDateString(compDate), reason: compReason.trim() || 'Compensation leave' });
      setShowCompLeaveForm(false); resetCompForm();
      showAlert('Success', 'Compensation leave request submitted');
    } catch (err: any) { showAlert('Error', err?.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const handleSubmitEarnedLeave = async () => {
    if (!user || !earnedDate) { showAlert('Error', 'Please select a date'); return; }
    if (earnedLeaveBalance <= 0) { showAlert('Error', 'No earned leave balance available'); return; }
    setSubmitting(true);
    try {
      await addLeaveRequest({ employeeId: user.id, employeeName: user.name, type: 'earned', startDate: toLocalDateString(earnedDate), endDate: toLocalDateString(earnedDate), reason: earnedReason.trim() || 'Earned leave' });
      setShowEarnedLeaveForm(false); resetEarnedForm();
      showAlert('Success', 'Earned leave request submitted');
    } catch (err: any) { showAlert('Error', err?.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const handleSubmitCorrection = async () => {
    if (!user || !selectedDate) return;
    if (!correctionReason.trim()) { showAlert('Error', 'Please describe the correction needed'); return; }
    setSubmitting(true);
    try {
      await addLeaveRequest({ employeeId: user.id, employeeName: user.name, type: 'leave', startDate: toLocalDateString(selectedDate), endDate: toLocalDateString(selectedDate), reason: '[CORRECTION] ' + correctionReason.trim() });
      setShowCorrectionForm(false); setCorrectionReason('');
      showAlert('Success', 'Attendance correction request submitted');
    } catch (err: any) { showAlert('Error', err?.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  /** Employee cancels an approved/pending leave or correction request */
  const handleCancelLeave = async (leaveId: string, isCorrection?: boolean) => {
    setCancellingId(leaveId);
    try {
      await updateLeaveRequest({ id: leaveId, status: 'rejected', reviewedBy: user!.id });
      setCancelledIds(prev => [...prev, leaveId]);
      await reload();
      showAlert('Success', isCorrection ? 'Correction request cancelled.' : 'Leave cancelled. Balance restored.');
    } catch (err: any) { showAlert('Error', err?.message || 'Failed to cancel'); }
    finally { setCancellingId(null); }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  /* ── Calendar grid builder ── */
  const calendarGrid = useMemo(() => {
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth, viewYear]);

  /* ── Render request item ── */
  const renderRequestItem = ({ item }: { item: (typeof myRequests)[0] }) => {
    const statusColors = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
    const isLeave = item.reqType === 'leave';
    const leaveItem = item as LeaveRequest & { reqType: string };
    const permItem = item as PermissionRequest & { reqType: string };

    // Allow cancel for approved/pending leaves if the leave end date hasn't passed yet
    const canCancel = isLeave
      && !cancelledIds.includes(item.id)
      && (item.status === 'approved' || item.status === 'pending')
      && new Date(leaveItem.endDate + 'T23:59:59') >= new Date(toLocalDateString(new Date()) + 'T00:00:00');

    const isCorrection = isLeave && !!leaveItem.reason?.startsWith('[CORRECTION]');

    const displayStatus = cancelledIds.includes(item.id) ? 'rejected' : item.status;
    const displayStatusColors = STATUS_COLORS[displayStatus] || STATUS_COLORS.pending;

    return (
      <View style={styles.recordCard}>
        <View style={styles.recordHeader}>
          <View style={[styles.typeBadge, { backgroundColor: isCorrection ? '#FEE2E2' : isLeave ? (leaveItem.type === 'earned' ? '#D1FAE5' : leaveItem.type === 'compensation' ? '#EDE9FE' : '#FFEDD5') : '#FEF3C7' }]}>
            <Text style={[styles.typeText, { color: isCorrection ? '#DC2626' : isLeave ? (leaveItem.type === 'earned' ? '#059669' : leaveItem.type === 'compensation' ? '#7C3AED' : '#EA580C') : '#D97706' }]}>
              {isCorrection ? 'CORRECTION' : isLeave ? (leaveItem.type === 'compensation' ? 'COMP LEAVE' : leaveItem.type === 'earned' ? 'EARNED LEAVE' : 'LEAVE') : 'PERMISSION'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: displayStatusColors.bg }]}>
            <Text style={[styles.statusText, { color: displayStatusColors.text }]}>{displayStatus.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.recordDate}>
          {isLeave
            ? formatDate(leaveItem.startDate) + ' \u2014 ' + formatDate(leaveItem.endDate)
            : formatDate(permItem.date) + ' | ' + permItem.fromTime + ' \u2014 ' + permItem.toTime}
        </Text>
        {(isLeave ? leaveItem.reason : permItem.reason) ? (
          <Text style={styles.recordReason} numberOfLines={2}>{isLeave ? leaveItem.reason : permItem.reason}</Text>
        ) : null}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => handleCancelLeave(item.id, isCorrection)}
            disabled={cancellingId === item.id}
          >
            {cancellingId === item.id
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <Text style={styles.cancelBtnText}>{isCorrection ? 'Cancel Request' : 'Cancel Leave'}</Text>}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'attendance' && styles.tabBtnActive]} onPress={() => setTab('attendance')}>
          <Text style={[styles.tabText, tab === 'attendance' && styles.tabTextActive]}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]} onPress={() => setTab('requests')}>
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>Requests</Text>
        </TouchableOpacity>
      </View>

      {tab === 'attendance' ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Month navigator */}
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateArrow} onPress={goPrevMonth} disabled={!canGoPrev}>
              <ChevronLeft size={22} color={canGoPrev ? Colors.primary : '#D1D5DB'} />
            </TouchableOpacity>
            <View style={[styles.dateSelector, isCurrentMonth && styles.dateSelectorToday]}>
              <Text style={[styles.dateSelectorText, isCurrentMonth && styles.dateSelectorTextToday]}>{monthLabel}</Text>
            </View>
            <TouchableOpacity style={styles.dateArrow} onPress={goNextMonth} disabled={!canGoNext}>
              <ChevronRight size={22} color={canGoNext ? Colors.primary : '#D1D5DB'} />
            </TouchableOpacity>
          </View>

          {/* Summary pills */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryPill, { backgroundColor: '#A7F3D0' }]}>
              <Text style={[styles.summaryNum, { color: '#047857' }]}>{monthlyStats.present}</Text>
              <Text style={[styles.summaryLabel, { color: '#047857' }]}>Present</Text>
            </View>
            <View style={[styles.summaryPill, { backgroundColor: '#FECACA' }]}>
              <Text style={[styles.summaryNum, { color: '#B91C1C' }]}>{monthlyStats.absent}</Text>
              <Text style={[styles.summaryLabel, { color: '#B91C1C' }]}>Absent</Text>
            </View>
            <View style={[styles.summaryPill, { backgroundColor: '#C7D2FE' }]}>
              <Text style={[styles.summaryNum, { color: '#3730A3' }]}>{monthlyStats.off}</Text>
              <Text style={[styles.summaryLabel, { color: '#3730A3' }]}>Off</Text>
            </View>
            <View style={[styles.summaryPill, { backgroundColor: '#FED7AA' }]}>
              <Text style={[styles.summaryNum, { color: '#C2410C' }]}>{parseFloat(monthlyStats.leaveBalance.toFixed(1))}</Text>
              <Text style={[styles.summaryLabel, { color: '#C2410C' }]}>Leave</Text>
            </View>
          </View>

          {/* Calendar grid */}
          <View style={styles.calendarContainer}>
            <Text style={styles.calendarMonth}>{monthLabel}</Text>
            <View style={styles.calendarRow}>
              {DAY_LABELS.map((label, i) => (
                <View key={i} style={styles.calendarHeaderCell}>
                  <Text style={[styles.calendarHeaderText, i === 0 && { color: '#DC2626' }]}>{label}</Text>
                </View>
              ))}
            </View>
            {Array.from({ length: calendarGrid.length / 7 }, (_, weekIdx) => (
              <View key={weekIdx} style={styles.calendarRow}>
                {calendarGrid.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, i) => {
                  if (day === null) return <View key={i} style={styles.calendarCell} />;
                  const data = calendarData.get(day);
                  const status = data?.status ?? 'future';
                  const cellColors = CAL_STATUS_COLORS[status];
                  const isTodayCell = now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
                  const isSelected = selectedDay === day;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.calendarCell, { backgroundColor: cellColors.bg }, isTodayCell && styles.calendarToday, isSelected && styles.calendarSelected]}
                      activeOpacity={0.6}
                      onPress={() => handleCalendarDatePress(day)}
                    >
                      <Text style={[styles.calendarDayText, { color: cellColors.text }]}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={styles.calendarLegend}>
              {CAL_LEGEND_ITEMS.map(l => (
                <View key={l.status} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: CAL_STATUS_COLORS[l.status].bg, borderColor: CAL_STATUS_COLORS[l.status].text }]} />
                  <Text style={styles.legendText}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {selectedDay !== null && (
            <Text style={styles.tapHint}>Tap again to apply leave or request correction</Text>
          )}

          {/* Records list */}
          <View style={styles.recordsSection}>
            <Text style={styles.sectionTitle}>{monthLabel} — Records</Text>
            {monthRecords.length === 0 ? (
              <View style={styles.emptyState}><Text style={styles.emptyText}>No records this month</Text></View>
            ) : (
              monthRecords.map(item => {
                const cv = compLeaveValue(item, salonConfig);
                const wo = isWeeklyOff(item.date, salonConfig);
                let badgeLabel: string, badgeBg: string, badgeTextColor: string;
                if (wo) {
                  if (cv >= 1) { badgeLabel = 'COMP +1'; badgeBg = '#EDE9FE'; badgeTextColor = '#7C3AED'; }
                  else if (cv >= 0.5) { badgeLabel = 'COMP +0.5'; badgeBg = '#EDE9FE'; badgeTextColor = '#7C3AED'; }
                  else { badgeLabel = 'WEEK OFF'; badgeBg = '#E0E7FF'; badgeTextColor = '#4338CA'; }
                } else {
                  badgeLabel = item.status.replace('_', ' ').toUpperCase();
                  badgeBg = item.status === 'present' ? '#D1FAE5' : item.status === 'absent' ? '#FEE2E2' : item.status === 'half_day' ? '#FEF3C7' : '#FFEDD5';
                  badgeTextColor = item.status === 'present' ? '#059669' : item.status === 'absent' ? '#DC2626' : item.status === 'half_day' ? '#D97706' : '#EA580C';
                }
                return (
                  <View key={item.id} style={styles.recordCard}>
                    <View style={styles.recordHeader}>
                      <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.statusText, { color: badgeTextColor }]}>{badgeLabel}</Text>
                      </View>
                    </View>
                    {(item.checkIn || item.checkOut) && (
                      <Text style={styles.recordTime}>
                        {item.checkIn ? formatTime(item.checkIn) : '--:--'}{' \u2192 '}{item.checkOut ? formatTime(item.checkOut) : '--:--'}
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={myRequests}
          extraData={cancelledIds}
          keyExtractor={item => item.id}
          renderItem={renderRequestItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>No requests yet</Text></View>}
        />
      )}

      {/* Date Actions Sheet */}
      <BottomSheetModal visible={showDateActions} onRequestClose={() => setShowDateActions(false)}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>
            {selectedDate ? selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }) : 'Select Action'}
          </Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDateActions(false)}>
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {selectedDayData && (
          <View style={styles.dateStatusRow}>
            <Text style={styles.dateStatusLabel}>Status:</Text>
            <Text style={[styles.dateStatusValue, { color: CAL_STATUS_COLORS[selectedDayData.status]?.text || Colors.text }]}>
              {selectedDayData.status === 'off' ? 'WEEKLY OFF'
                : selectedDayData.status === 'future' ? 'UPCOMING'
                : selectedDayData.attendance ? selectedDayData.attendance.status.replace('_', ' ').toUpperCase()
                : selectedDayData.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        )}
        {selectedDayData?.attendance?.checkIn && (
          <View style={styles.dateStatusRow}>
            <Text style={styles.dateStatusLabel}>Time:</Text>
            <Text style={styles.dateStatusValue}>
              {selectedDayData.attendance.checkIn ? formatTime(selectedDayData.attendance.checkIn) : '--:--'}
              {' \u2192 '}
              {selectedDayData.attendance.checkOut ? formatTime(selectedDayData.attendance.checkOut) : '--:--'}
            </Text>
          </View>
        )}
        <View style={styles.dateActionsGrid}>
          <TouchableOpacity style={styles.dateActionBtn} onPress={openLeaveFromCalendar}>
            <View style={[styles.dateActionIcon, { backgroundColor: '#FFEDD5' }]}>
              <CalendarPlus size={20} color="#EA580C" />
            </View>
            <Text style={styles.dateActionLabel}>Apply Leave</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateActionBtn} onPress={openPermissionFromCalendar}>
            <View style={[styles.dateActionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Clock size={20} color="#D97706" />
            </View>
            <Text style={styles.dateActionLabel}>Permission</Text>
          </TouchableOpacity>
          {compBalance > 0 && (
            <TouchableOpacity style={styles.dateActionBtn} onPress={openCompFromCalendar}>
              <View style={[styles.dateActionIcon, { backgroundColor: '#EDE9FE' }]}>
                <FileText size={20} color="#7C3AED" />
              </View>
              <Text style={styles.dateActionLabel}>Comp ({compBalance})</Text>
            </TouchableOpacity>
          )}
          {salonConfig.monthlyLeaveAllowance > 0 && earnedLeaveBalance > 0 && (
            <TouchableOpacity style={styles.dateActionBtn} onPress={openEarnedFromCalendar}>
              <View style={[styles.dateActionIcon, { backgroundColor: '#D1FAE5' }]}>
                <Award size={20} color="#059669" />
              </View>
              <Text style={styles.dateActionLabel}>EL ({earnedLeaveBalance})</Text>
            </TouchableOpacity>
          )}
          {(selectedDayData?.attendance || selectedDayData?.status === 'absent') && (
            <TouchableOpacity style={styles.dateActionBtn} onPress={openCorrectionFromCalendar}>
              <View style={[styles.dateActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <ClipboardEdit size={20} color="#DC2626" />
              </View>
              <Text style={styles.dateActionLabel}>Correction</Text>
            </TouchableOpacity>
          )}
        </View>
      </BottomSheetModal>

      {/* Correction Form */}
      <BottomSheetModal visible={showCorrectionForm} onRequestClose={() => setShowCorrectionForm(false)}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Request Correction</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowCorrectionForm(false)}>
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {selectedDate && (
          <View style={styles.correctionDateRow}>
            <AlertCircle size={16} color="#D97706" />
            <Text style={styles.correctionDateText}>
              {selectedDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              {selectedDayData?.attendance ? ' \u2014 ' + selectedDayData.attendance.status.replace('_', ' ').toUpperCase() : ''}
            </Text>
          </View>
        )}
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>What needs to be corrected? *</Text>
          <TextInput style={styles.textArea} value={correctionReason} onChangeText={setCorrectionReason}
            placeholder="e.g. I was present but marked absent, check-in time was 9:15 AM not 10:00 AM"
            placeholderTextColor={Colors.textTertiary} multiline numberOfLines={4} />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitCorrection} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit Correction Request</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* Leave Form */}
      <BottomSheetModal visible={showLeaveForm} onRequestClose={() => setShowLeaveForm(false)}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Request Leave</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLeaveForm(false)}><X size={18} color={Colors.textSecondary} /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.halfDayToggleRow}>
            <Text style={styles.halfDayToggleLabel}>Half Day Leave?</Text>
            <Switch
              value={isHalfDay}
              onValueChange={(val) => { setIsHalfDay(val); if (val && leaveStartDate) setLeaveEndDate(leaveStartDate); }}
              trackColor={{ false: '#E5E7EB', true: Colors.primary + '40' }}
              thumbColor={isHalfDay ? Colors.primary : '#fff'}
            />
          </View>
          {isHalfDay && (
            <>
              <Text style={styles.fieldLabel}>Period</Text>
              <View style={styles.halfDayOptions}>
                {([{ value: 'first_half' as const, label: 'First Half (Morning)' }, { value: 'second_half' as const, label: 'Second Half (Afternoon)' }]).map(opt => (
                  <TouchableOpacity key={opt.value} style={[styles.halfDayOption, halfDayPeriod === opt.value && styles.halfDayOptionActive]} onPress={() => setHalfDayPeriod(opt.value)}>
                    <Text style={[styles.halfDayOptionText, halfDayPeriod === opt.value && styles.halfDayOptionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <Text style={styles.fieldLabel}>{isHalfDay ? 'Date *' : 'Start Date *'}</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
            <Text style={leaveStartDate ? styles.dateText : styles.datePlaceholder}>{leaveStartDate ? leaveStartDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'}</Text>
            <ChevronDown size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
          {!isHalfDay && (
            <>
              <Text style={styles.fieldLabel}>End Date *</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                <Text style={leaveEndDate ? styles.dateText : styles.datePlaceholder}>{leaveEndDate ? leaveEndDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select end date'}</Text>
                <ChevronDown size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </>
          )}
          <Text style={styles.fieldLabel}>Reason</Text>
          <TextInput style={styles.textArea} value={leaveReason} onChangeText={setLeaveReason} placeholder="Enter reason (optional)" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitLeave} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit Leave Request</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* Permission Form */}
      <BottomSheetModal visible={showPermissionForm} onRequestClose={() => setShowPermissionForm(false)}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Request Permission</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowPermissionForm(false)}><X size={18} color={Colors.textSecondary} /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Date *</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPermDatePicker(true)}>
            <Text style={permDate ? styles.dateText : styles.datePlaceholder}>{permDate ? permDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'}</Text>
            <ChevronDown size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
          <Text style={styles.fieldLabel}>From Time * (HH:MM, 24hr)</Text>
          <TextInput style={styles.input} value={permFromTime} onChangeText={setPermFromTime} placeholder="e.g. 14:00" placeholderTextColor={Colors.textTertiary} keyboardType="numbers-and-punctuation" />
          <Text style={styles.fieldLabel}>To Time * (HH:MM, 24hr)</Text>
          <TextInput style={styles.input} value={permToTime} onChangeText={setPermToTime} placeholder="e.g. 16:00" placeholderTextColor={Colors.textTertiary} keyboardType="numbers-and-punctuation" />
          <Text style={styles.fieldLabel}>Reason</Text>
          <TextInput style={styles.textArea} value={permReason} onChangeText={setPermReason} placeholder="Enter reason (optional)" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitPermission} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit Permission Request</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* Comp Leave Form */}
      <BottomSheetModal visible={showCompLeaveForm} onRequestClose={() => setShowCompLeaveForm(false)}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Request Comp Leave</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowCompLeaveForm(false)}><X size={18} color={Colors.textSecondary} /></TouchableOpacity>
        </View>
        <Text style={styles.compInfo}>Balance: {compBalance} comp {compBalance === 1 ? 'day' : 'days'} available</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Date to take off *</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowCompDatePicker(true)}>
            <Text style={compDate ? styles.dateText : styles.datePlaceholder}>{compDate ? compDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'}</Text>
            <ChevronDown size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
          <Text style={styles.fieldLabel}>Reason</Text>
          <TextInput style={styles.textArea} value={compReason} onChangeText={setCompReason} placeholder="Enter reason (optional)" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitCompLeave} disabled={submitting || compBalance <= 0}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit Comp Leave</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* Earned Leave Form */}
      <BottomSheetModal visible={showEarnedLeaveForm} onRequestClose={() => setShowEarnedLeaveForm(false)}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Request Earned Leave</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowEarnedLeaveForm(false)}><X size={18} color={Colors.textSecondary} /></TouchableOpacity>
        </View>
        <Text style={[styles.compInfo, { backgroundColor: '#D1FAE5', color: '#059669' }]}>Balance: {earnedLeaveBalance} earned {earnedLeaveBalance === 1 ? 'day' : 'days'} available</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Date to take off *</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEarnedDatePicker(true)}>
            <Text style={earnedDate ? styles.dateText : styles.datePlaceholder}>{earnedDate ? earnedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'}</Text>
            <ChevronDown size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
          <Text style={styles.fieldLabel}>Reason</Text>
          <TextInput style={styles.textArea} value={earnedReason} onChangeText={setEarnedReason} placeholder="Enter reason (optional)" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitEarnedLeave} disabled={submitting || earnedLeaveBalance <= 0}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit Earned Leave</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* Date Pickers */}
      <DatePickerModal visible={showStartPicker} value={leaveStartDate} title="Select Start Date" onSelect={(d) => { setLeaveStartDate(d); setShowStartPicker(false); }} onClose={() => setShowStartPicker(false)} />
      <DatePickerModal visible={showEndPicker} value={leaveEndDate} title="Select End Date" minDate={leaveStartDate ?? undefined} onSelect={(d) => { setLeaveEndDate(d); setShowEndPicker(false); }} onClose={() => setShowEndPicker(false)} />
      <DatePickerModal visible={showPermDatePicker} value={permDate} title="Select Date" onSelect={(d) => { setPermDate(d); setShowPermDatePicker(false); }} onClose={() => setShowPermDatePicker(false)} />
      <DatePickerModal visible={showCompDatePicker} value={compDate} title="Select Date" onSelect={(d) => { setCompDate(d); setShowCompDatePicker(false); }} onClose={() => setShowCompDatePicker(false)} />
      <DatePickerModal visible={showEarnedDatePicker} value={earnedDate} title="Select Date" onSelect={(d) => { setEarnedDate(d); setShowEarnedDatePicker(false); }} onClose={() => setShowEarnedDatePicker(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabRow: { flexDirection: 'row', padding: Spacing.screen, paddingBottom: 0, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: BorderRadius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.screen, marginTop: Spacing.sm, gap: 8 },
  dateArrow: { width: 40, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
  dateSelector: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
  dateSelectorToday: { backgroundColor: '#FFF0F3', borderColor: Colors.primary, borderWidth: 1.5 },
  dateSelectorText: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text },
  dateSelectorTextToday: { color: Colors.primary },
  summaryRow: { flexDirection: 'row', paddingHorizontal: Spacing.screen, paddingVertical: Spacing.md, gap: 8 },
  summaryPill: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BorderRadius.md },
  summaryNum: { fontSize: FontSize.heading, fontWeight: '800' },
  summaryLabel: { fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },
  calendarContainer: { marginHorizontal: Spacing.screen, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 10, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  calendarMonth: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  calendarRow: { flexDirection: 'row', justifyContent: 'space-between' },
  calendarHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  calendarHeaderText: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary },
  calendarCell: { flex: 1, alignItems: 'center', justifyContent: 'center', aspectRatio: 1, margin: 1.5, borderRadius: 6 },
  calendarToday: { borderWidth: 2, borderColor: Colors.primary },
  calendarSelected: { borderWidth: 2, borderColor: '#1E40AF', borderRadius: 8 },
  calendarDayText: { fontSize: 11, fontWeight: '700' },
  calendarLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  legendText: { fontSize: 9, color: Colors.textSecondary, fontWeight: '600' },
  tapHint: { textAlign: 'center', fontSize: 12, color: Colors.primary, fontWeight: '500', marginTop: 6, marginBottom: 2 },
  actionRow: { flexDirection: 'row', paddingHorizontal: Spacing.screen, paddingVertical: Spacing.sm, gap: 8, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  actionBtnDisabled: { opacity: 0.5 },
  actionText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.text },
  recordsSection: { paddingHorizontal: Spacing.screen, marginTop: Spacing.sm },
  sectionTitle: { fontSize: FontSize.body, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  listContent: { padding: Spacing.screen, paddingTop: 12, paddingBottom: 100 },
  recordCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  recordDate: { fontSize: FontSize.body, fontWeight: '600', color: Colors.text, flex: 1 },
  recordTime: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  recordReason: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
  cancelBtn: { marginTop: 8, alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  cancelBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#DC2626' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeText: { fontSize: FontSize.xs, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: FontSize.body, color: Colors.textTertiary },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  formTitle: { fontSize: FontSize.heading, fontWeight: '700', color: Colors.text, flex: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  compInfo: { fontSize: FontSize.sm, color: '#7C3AED', fontWeight: '600', marginBottom: Spacing.md, backgroundColor: '#EDE9FE', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.md },
  dateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: BorderRadius.md, paddingVertical: 12, paddingHorizontal: 14 },
  dateText: { fontSize: FontSize.body, color: Colors.text },
  datePlaceholder: { fontSize: FontSize.body, color: Colors.textTertiary },
  input: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: BorderRadius.md, paddingVertical: 12, paddingHorizontal: 14, fontSize: FontSize.body, color: Colors.text },
  textArea: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: BorderRadius.md, paddingVertical: 12, paddingHorizontal: 14, fontSize: FontSize.body, color: Colors.text, minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: BorderRadius.lg, alignItems: 'center', marginTop: Spacing.xl },
  submitText: { color: '#fff', fontWeight: '700', fontSize: FontSize.body },
  halfDayToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 4 },
  halfDayToggleLabel: { fontSize: FontSize.body, fontWeight: '600', color: Colors.text },
  halfDayOptions: { flexDirection: 'row', gap: 8 },
  halfDayOption: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: BorderRadius.md, backgroundColor: Colors.inputBg, borderWidth: 1.5, borderColor: Colors.inputBorder },
  halfDayOptionActive: { backgroundColor: '#D9770618', borderColor: '#D97706' },
  halfDayOptionText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  halfDayOptionTextActive: { color: '#D97706', fontWeight: '700' },
  dateStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, paddingHorizontal: 4 },
  dateStatusLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, width: 50 },
  dateStatusValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, flex: 1 },
  dateActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: Spacing.lg, justifyContent: 'flex-start' },
  dateActionBtn: { alignItems: 'center', width: 72, gap: 6 },
  dateActionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateActionLabel: { fontSize: 11, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  correctionDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: Spacing.md },
  correctionDateText: { fontSize: FontSize.sm, fontWeight: '600', color: '#92400E' },
});
