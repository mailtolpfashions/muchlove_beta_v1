import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CalendarCheck, Users, AlertCircle, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import type { Attendance, LeaveRequest, PermissionRequest, User } from '@/types';

interface AttendanceOverviewProps {
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
  permissionRequests: PermissionRequest[];
  users: User[];
}

export default function AttendanceOverview({
  attendance,
  leaveRequests,
  permissionRequests,
  users,
}: AttendanceOverviewProps) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const month = today.getMonth();
  const year = today.getFullYear();

  const todayStats = useMemo(() => {
    const todayRecords = attendance.filter(a => a.date === todayStr && a.checkIn);
    const employees = users.filter(u => u.role === 'employee' && u.approved);
    return {
      checkedIn: todayRecords.length,
      totalEmployees: employees.length,
    };
  }, [attendance, users, todayStr]);

  const pendingCount = useMemo(() => {
    const pendingLeaves = leaveRequests.filter(lr => lr.status === 'pending').length;
    const pendingPermissions = permissionRequests.filter(pr => pr.status === 'pending').length;
    return pendingLeaves + pendingPermissions;
  }, [leaveRequests, permissionRequests]);

  const employeeAttendanceSummary = useMemo(() => {
    const employees = users.filter(u => u.role === 'employee' && u.approved);
    return employees.map(emp => {
      const empRecords = attendance.filter(a => {
        if (a.employeeId !== emp.id) return false;
        const d = new Date(a.date);
        return d.getMonth() === month && d.getFullYear() === year;
      });
      const present = empRecords.filter(r => r.status === 'present' || r.status === 'permission').length;
      const absent = empRecords.filter(r => r.status === 'absent').length;
      const todayRecord = empRecords.find(r => r.date === todayStr);
      return {
        id: emp.id,
        name: emp.name,
        present,
        absent,
        todayStatus: todayRecord?.checkIn ? (todayRecord.checkOut ? 'done' : 'in') : 'not_in',
      };
    }).sort((a, b) => b.present - a.present);
  }, [users, attendance, month, year, todayStr]);

  return (
    <>
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionLabel}>Attendance Overview</Text>

      {/* Today's check-in count */}
      <View style={styles.overviewRow}>
        <View style={[styles.iconCircle, { backgroundColor: '#D1FAE5' }]}>
          <CalendarCheck size={16} color="#059669" />
        </View>
        <Text style={styles.infoLabel}>Checked In Today</Text>
        <Text style={styles.infoValue}>
          {todayStats.checkedIn} / {todayStats.totalEmployees}
        </Text>
      </View>
      <View style={styles.divider} />

      {/* Pending requests */}
      <View style={styles.overviewRow}>
        <View style={[styles.iconCircle, { backgroundColor: pendingCount > 0 ? '#FEF3C7' : '#D1FAE5' }]}>
          {pendingCount > 0 ? (
            <AlertCircle size={16} color="#D97706" />
          ) : (
            <Clock size={16} color="#059669" />
          )}
        </View>
        <Text style={styles.infoLabel}>Pending Requests</Text>
        <Text style={[styles.infoValue, pendingCount > 0 && { color: '#D97706' }]}>
          {pendingCount}
        </Text>
      </View>

      {/* Per-employee summary */}
      {employeeAttendanceSummary.length > 0 && (
        <>
          <View style={styles.subDivider} />
          {employeeAttendanceSummary.map((emp) => (
            <View key={emp.id} style={styles.overviewRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#EDE9FE' }]}>
                <Users size={14} color="#7C3AED" />
              </View>
              <Text style={styles.infoLabel} numberOfLines={1}>
                {emp.name}
              </Text>
              <View style={styles.empStats}>
                <Text style={styles.empStat}>
                  <Text style={{ color: '#059669' }}>{emp.present}P</Text>
                  {' / '}
                  <Text style={{ color: '#DC2626' }}>{emp.absent}A</Text>
                </Text>
                <View
                  style={[
                    styles.statusDot,
                    emp.todayStatus === 'in'
                      ? { backgroundColor: '#10B981' }
                      : emp.todayStatus === 'done'
                      ? { backgroundColor: '#3B82F6' }
                      : { backgroundColor: '#D1D5DB' },
                  ]}
                />
              </View>
            </View>
          ))}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginLeft: 44,
  },
  subDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.xs,
  },
  empStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  empStat: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
