import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CalendarCheck, LogIn, LogOut, Clock, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import type { Attendance, LeaveRequest, PermissionRequest } from '@/types';
import { isWeeklyOff, compLeaveValue, SHIFT_START_HOUR, SHIFT_START_MIN, GRACE_MINUTES, calculatePunchShortage } from '@/utils/salary';

interface AttendanceCardProps {
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
  permissionRequests: PermissionRequest[];
  userId: string;
  onCheckIn: () => void;
  onCheckOut: (recordId: string, checkInTime: string) => void;
  checkingIn: boolean;
  checkingOut: boolean;
}

export default function AttendanceCard({
  attendance,
  leaveRequests,
  permissionRequests,
  userId,
  onCheckIn,
  onCheckOut,
  checkingIn,
  checkingOut,
}: AttendanceCardProps) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const todayRecord = useMemo(() => {
    return attendance.find(a => a.employeeId === userId && a.date === todayStr);
  }, [attendance, userId, todayStr]);

  const monthStats = useMemo(() => {
    const month = today.getMonth();
    const year = today.getFullYear();
    const myRecords = attendance.filter(a => {
      if (a.employeeId !== userId) return false;
      const d = new Date(a.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let compEarned = 0;
    let totalLateMin = 0;
    let totalEarlyMin = 0;

    myRecords.forEach(r => {
      if (isWeeklyOff(r.date)) {
        compEarned += compLeaveValue(r);
        return;
      }
      switch (r.status) {
        case 'present': present++; break;
        case 'absent': absent++; break;
        case 'half_day': halfDay++; break;
        case 'permission': present++; break;
      }
      if (r.checkIn || r.checkOut) {
        const shortage = calculatePunchShortage(r);
        totalLateMin += shortage.lateMinutes;
        totalEarlyMin += shortage.earlyMinutes;
      }
    });

    const myLeaves = leaveRequests.filter(lr => {
      if (lr.employeeId !== userId || lr.status !== 'approved') return false;
      const start = new Date(lr.startDate);
      return start.getMonth() === month && start.getFullYear() === year;
    }).length;

    const myPermissions = permissionRequests.filter(pr => {
      if (pr.employeeId !== userId || pr.status !== 'approved') return false;
      const d = new Date(pr.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;

    // Calculate total permission hours used
    let permHours = 0;
    permissionRequests.filter(pr => {
      if (pr.employeeId !== userId || pr.status !== 'approved') return false;
      const d = new Date(pr.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).forEach(pr => {
      const from = pr.fromTime.split(':');
      const to = pr.toTime.split(':');
      const fromMin = parseInt(from[0]) * 60 + parseInt(from[1]);
      const toMin = parseInt(to[0]) * 60 + parseInt(to[1]);
      permHours += Math.max(0, (toMin - fromMin) / 60);
    });

    return { present, absent, halfDay, myLeaves, myPermissions, compEarned, permHours, totalLateMin, totalEarlyMin };
  }, [attendance, leaveRequests, permissionRequests, userId, today]);

  const hasCheckedIn = !!todayRecord?.checkIn;
  const hasCheckedOut = !!todayRecord?.checkOut;
  const isTuesday = today.getDay() === 2;
  const todayCompValue = todayRecord ? compLeaveValue(todayRecord) : 0;

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Check if late
  const isLate = useMemo(() => {
    if (!todayRecord?.checkIn) return false;
    const ci = new Date(todayRecord.checkIn);
    const ciMin = ci.getHours() * 60 + ci.getMinutes();
    return ciMin > SHIFT_START_HOUR * 60 + SHIFT_START_MIN + GRACE_MINUTES;
  }, [todayRecord]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <CalendarCheck size={18} color="#0D9488" />
        <Text style={styles.title}>My Attendance</Text>
        {isTuesday && (
          <View style={styles.holidayBadge}>
            <Text style={styles.holidayText}>Weekly Off</Text>
          </View>
        )}
      </View>

      {/* Today's status */}
      <View style={styles.todaySection}>
        {isTuesday && !hasCheckedIn && (
          <View style={styles.offDayBanner}>
            <Text style={styles.offDayText}>Today is your weekly off (Tuesday)</Text>
          </View>
        )}

        {!hasCheckedIn && (
          <TouchableOpacity
            style={[styles.checkBtn, isTuesday ? styles.checkInCompBtn : styles.checkInBtn]}
            onPress={onCheckIn}
            disabled={checkingIn}
            activeOpacity={0.7}
          >
            {checkingIn ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <LogIn size={18} color="#fff" />
                <Text style={styles.checkBtnText}>{isTuesday ? 'Check In (Earn Comp)' : 'Check In'}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {hasCheckedIn && !hasCheckedOut && (
          <View style={styles.checkedInRow}>
            <View style={styles.timeInfo}>
              <Text style={styles.timeLabel}>Checked in at</Text>
              <Text style={[styles.timeValue, isLate && { color: Colors.danger }]}>
                {formatTime(todayRecord!.checkIn!)}
                {isLate && ' (Late)'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.checkBtn, styles.checkOutBtn]}
              onPress={() => onCheckOut(todayRecord!.id, todayRecord!.checkIn!)}
              disabled={checkingOut}
              activeOpacity={0.7}
            >
              {checkingOut ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <LogOut size={18} color="#fff" />
                  <Text style={styles.checkBtnText}>Check Out</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {hasCheckedIn && hasCheckedOut && (
          <View style={styles.completedRow}>
            <CheckCircle size={16} color={Colors.success} />
            <Text style={styles.completedText}>
              {formatTime(todayRecord!.checkIn!)} — {formatTime(todayRecord!.checkOut!)}
            </Text>
          </View>
        )}

        {isTuesday && hasCheckedIn && todayCompValue === 1 && (
          <View style={styles.compBadge}>
            <Text style={styles.compText}>+1 Comp Leave earned for working today</Text>
          </View>
        )}
        {isTuesday && hasCheckedIn && todayCompValue === 0.5 && (
          <View style={[styles.compBadge, { backgroundColor: '#EDE9FE' }]}>
            <Text style={[styles.compText, { color: '#7C3AED' }]}>+0.5 Half-Day Comp earned</Text>
          </View>
        )}
      </View>

      {/* Monthly stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statPill, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.statNum, { color: '#059669' }]}>{monthStats.present}</Text>
          <Text style={[styles.statLabel, { color: '#059669' }]}>Present</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.statNum, { color: '#DC2626' }]}>{monthStats.absent}</Text>
          <Text style={[styles.statLabel, { color: '#DC2626' }]}>Absent</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.statNum, { color: '#2563EB' }]}>{monthStats.myLeaves}</Text>
          <Text style={[styles.statLabel, { color: '#2563EB' }]}>Leaves</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.statNum, { color: '#D97706' }]}>{monthStats.myPermissions}</Text>
          <Text style={[styles.statLabel, { color: '#D97706' }]}>Perm.</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#EDE9FE' }]}>
          <Text style={[styles.statNum, { color: '#7C3AED' }]}>{monthStats.compEarned}</Text>
          <Text style={[styles.statLabel, { color: '#7C3AED' }]}>Comp</Text>
        </View>
      </View>

      {/* Extra info row */}
      {(monthStats.totalLateMin > 0 || monthStats.totalEarlyMin > 0 || monthStats.permHours > 0) && (
        <View style={styles.extraRow}>
          {monthStats.totalLateMin > 0 && (
            <View style={styles.extraItem}>
              <Clock size={12} color={Colors.danger} />
              <Text style={styles.extraText}>Late: {(monthStats.totalLateMin / 60).toFixed(1)}h</Text>
            </View>
          )}
          {monthStats.totalEarlyMin > 0 && (
            <View style={styles.extraItem}>
              <Clock size={12} color={Colors.warning} />
              <Text style={styles.extraText}>Early: {(monthStats.totalEarlyMin / 60).toFixed(1)}h</Text>
            </View>
          )}
          {monthStats.permHours > 0 && (
            <View style={styles.extraItem}>
              <Clock size={12} color="#2563EB" />
              <Text style={styles.extraText}>Perm: {monthStats.permHours.toFixed(1)}h / 2h free</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
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
    flex: 1,
  },
  holidayBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  holidayText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: '#D97706',
  },
  todaySection: {
    marginBottom: Spacing.md,
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.lg,
  },
  checkInBtn: {
    backgroundColor: '#10B981',
  },
  checkInCompBtn: {
    backgroundColor: '#7C3AED',
  },
  checkOutBtn: {
    backgroundColor: Colors.danger,
  },
  checkBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.body,
  },
  checkedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInfo: {
    flex: 1,
  },
  timeLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  timeValue: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.success,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
  },
  completedText: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: '#059669',
  },
  offDayBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginBottom: 8,
  },
  offDayText: {
    fontSize: FontSize.body,
    fontWeight: '500',
    color: '#D97706',
  },
  compBadge: {
    backgroundColor: '#EDE9FE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginTop: 8,
  },
  compText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#7C3AED',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statNum: {
    fontSize: FontSize.body,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  extraRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  extraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  extraText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
