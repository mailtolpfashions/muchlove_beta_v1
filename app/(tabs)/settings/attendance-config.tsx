import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Clock,
  Timer,
  CalendarOff,
  Hourglass,
  Coffee,
  CalendarPlus,
  AlertTriangle,
  Save,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';
import { useData } from '@/providers/DataProvider';
import { useAlert } from '@/providers/AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WEEKDAYS = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

export default function AttendanceConfigScreen() {
  const { salonConfig, updateSalonConfig, reload } = useData();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const [weeklyOffDay, setWeeklyOffDay] = useState(salonConfig.weeklyOffDay);
  const [shiftStartHour, setShiftStartHour] = useState(String(salonConfig.shiftStartHour));
  const [shiftStartMin, setShiftStartMin] = useState(String(salonConfig.shiftStartMin));
  const [shiftEndHour, setShiftEndHour] = useState(String(salonConfig.shiftEndHour));
  const [shiftEndMin, setShiftEndMin] = useState(String(salonConfig.shiftEndMin));
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(String(salonConfig.workingHoursPerDay));
  const [graceMinutes, setGraceMinutes] = useState(String(salonConfig.graceMinutes));
  const [freePermissionHours, setFreePermissionHours] = useState(String(salonConfig.freePermissionHours));
  const [monthlyLeaveAllowance, setMonthlyLeaveAllowance] = useState(String(salonConfig.monthlyLeaveAllowance));
  const [latesPerHalfDay, setLatesPerHalfDay] = useState(String(salonConfig.latesPerHalfDay));
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sync local state when salonConfig updates (e.g. after reload)
  useEffect(() => {
    setWeeklyOffDay(salonConfig.weeklyOffDay);
    setShiftStartHour(String(salonConfig.shiftStartHour));
    setShiftStartMin(String(salonConfig.shiftStartMin));
    setShiftEndHour(String(salonConfig.shiftEndHour));
    setShiftEndMin(String(salonConfig.shiftEndMin));
    setWorkingHoursPerDay(String(salonConfig.workingHoursPerDay));
    setGraceMinutes(String(salonConfig.graceMinutes));
    setFreePermissionHours(String(salonConfig.freePermissionHours));
    setMonthlyLeaveAllowance(String(salonConfig.monthlyLeaveAllowance));
    setLatesPerHalfDay(String(salonConfig.latesPerHalfDay));
  }, [salonConfig]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const validate = (): boolean => {
    const startH = parseInt(shiftStartHour, 10);
    const startM = parseInt(shiftStartMin, 10);
    const endH = parseInt(shiftEndHour, 10);
    const endM = parseInt(shiftEndMin, 10);
    const workHrs = parseFloat(workingHoursPerDay);
    const grace = parseInt(graceMinutes, 10);
    const freePerm = parseFloat(freePermissionHours);
    const leaveAllow = parseFloat(monthlyLeaveAllowance);
    const latesHD = parseInt(latesPerHalfDay, 10);

    if (isNaN(startH) || startH < 0 || startH > 23) {
      showAlert('Invalid', 'Shift start hour must be 0–23');
      return false;
    }
    if (isNaN(startM) || startM < 0 || startM > 59) {
      showAlert('Invalid', 'Shift start minutes must be 0–59');
      return false;
    }
    if (isNaN(endH) || endH < 0 || endH > 23) {
      showAlert('Invalid', 'Shift end hour must be 0–23');
      return false;
    }
    if (isNaN(endM) || endM < 0 || endM > 59) {
      showAlert('Invalid', 'Shift end minutes must be 0–59');
      return false;
    }
    if (endH * 60 + endM <= startH * 60 + startM) {
      showAlert('Invalid', 'Shift end must be after shift start');
      return false;
    }
    if (isNaN(workHrs) || workHrs <= 0 || workHrs > 24) {
      showAlert('Invalid', 'Working hours must be between 1–24');
      return false;
    }
    if (isNaN(grace) || grace < 0 || grace > 120) {
      showAlert('Invalid', 'Grace minutes must be 0–120');
      return false;
    }
    if (isNaN(freePerm) || freePerm < 0 || freePerm > 100) {
      showAlert('Invalid', 'Free permission hours must be 0–100');
      return false;
    }
    if (isNaN(leaveAllow) || leaveAllow < 0 || leaveAllow > 5) {
      showAlert('Invalid', 'Monthly leave allowance must be 0–5');
      return false;
    }
    if (isNaN(latesHD) || latesHD < 1 || latesHD > 10) {
      showAlert('Invalid', 'Lates per half-day must be 1–10');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await updateSalonConfig({
        weeklyOffDay,
        shiftStartHour: parseInt(shiftStartHour, 10),
        shiftStartMin: parseInt(shiftStartMin, 10),
        shiftEndHour: parseInt(shiftEndHour, 10),
        shiftEndMin: parseInt(shiftEndMin, 10),
        workingHoursPerDay: parseFloat(workingHoursPerDay),
        graceMinutes: parseInt(graceMinutes, 10),
        freePermissionHours: parseFloat(freePermissionHours),
        monthlyLeaveAllowance: parseFloat(monthlyLeaveAllowance),
        latesPerHalfDay: parseInt(latesPerHalfDay, 10),
      });
      showAlert('Saved', 'Configuration updated successfully');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const pad2 = (v: string) => v.padStart(2, '0');

  const shiftDisplay = `${pad2(shiftStartHour)}:${pad2(shiftStartMin)} – ${pad2(shiftEndHour)}:${pad2(shiftEndMin)}`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Weekly Off Day */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBubble, { backgroundColor: '#FCE4EC' }]}>
            <CalendarOff size={20} color="#E91E63" />
          </View>
          <Text style={styles.cardTitle}>Weekly Off Day</Text>
        </View>
        <Text style={styles.cardSubtitle}>Select the recurring day off for all employees</Text>
        <View style={styles.chipRow}>
          {WEEKDAYS.map(day => (
            <TouchableOpacity
              key={day.value}
              style={[styles.chip, weeklyOffDay === day.value && styles.chipActive]}
              onPress={() => setWeeklyOffDay(day.value)}
            >
              <Text style={[styles.chipText, weeklyOffDay === day.value && styles.chipTextActive]}>
                {day.label.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Shift Timing */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBubble, { backgroundColor: '#E3F2FD' }]}>
            <Clock size={20} color="#1976D2" />
          </View>
          <Text style={styles.cardTitle}>Shift Timing</Text>
        </View>
        <Text style={styles.cardSubtitle}>Current: {shiftDisplay}</Text>

        <View style={styles.timeRow}>
          <View style={styles.timeGroup}>
            <Text style={styles.timeLabel}>Start Hour</Text>
            <TextInput
              style={styles.timeInput}
              keyboardType="number-pad"
              maxLength={2}
              value={shiftStartHour}
              onChangeText={setShiftStartHour}
              placeholder="9"
            />
          </View>
          <Text style={styles.timeSep}>:</Text>
          <View style={styles.timeGroup}>
            <Text style={styles.timeLabel}>Start Min</Text>
            <TextInput
              style={styles.timeInput}
              keyboardType="number-pad"
              maxLength={2}
              value={shiftStartMin}
              onChangeText={setShiftStartMin}
              placeholder="00"
            />
          </View>
          <Text style={styles.timeDash}>–</Text>
          <View style={styles.timeGroup}>
            <Text style={styles.timeLabel}>End Hour</Text>
            <TextInput
              style={styles.timeInput}
              keyboardType="number-pad"
              maxLength={2}
              value={shiftEndHour}
              onChangeText={setShiftEndHour}
              placeholder="20"
            />
          </View>
          <Text style={styles.timeSep}>:</Text>
          <View style={styles.timeGroup}>
            <Text style={styles.timeLabel}>End Min</Text>
            <TextInput
              style={styles.timeInput}
              keyboardType="number-pad"
              maxLength={2}
              value={shiftEndMin}
              onChangeText={setShiftEndMin}
              placeholder="00"
            />
          </View>
        </View>
      </View>

      {/* Working Hours */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBubble, { backgroundColor: '#E8F5E9' }]}>
            <Coffee size={20} color="#388E3C" />
          </View>
          <Text style={styles.cardTitle}>Net Working Hours / Day</Text>
        </View>
        <Text style={styles.cardSubtitle}>Shift duration minus breaks (e.g. 11hr shift − 2hr lunch = 9)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={workingHoursPerDay}
          onChangeText={setWorkingHoursPerDay}
          placeholder="9"
        />
      </View>

      {/* Grace Minutes */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBubble, { backgroundColor: '#FFF3E0' }]}>
            <Timer size={20} color="#E65100" />
          </View>
          <Text style={styles.cardTitle}>Late Grace Period</Text>
        </View>
        <Text style={styles.cardSubtitle}>Minutes after shift start before marking late</Text>
        <View style={styles.unitRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="number-pad"
            value={graceMinutes}
            onChangeText={setGraceMinutes}
            placeholder="15"
          />
          <Text style={styles.unitText}>minutes</Text>
        </View>
      </View>

      {/* Free Permission Hours */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBubble, { backgroundColor: '#F3E5F5' }]}>
            <Hourglass size={20} color="#7B1FA2" />
          </View>
          <Text style={styles.cardTitle}>Free Permission Hours</Text>
        </View>
        <Text style={styles.cardSubtitle}>Monthly permission hours before salary deduction applies</Text>
        <View style={styles.unitRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="decimal-pad"
            value={freePermissionHours}
            onChangeText={setFreePermissionHours}
            placeholder="2"
          />
          <Text style={styles.unitText}>hours / month</Text>
        </View>
      </View>

      {/* Lates Per Half-Day */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBubble, { backgroundColor: '#FEE2E2' }]}>
            <AlertTriangle size={20} color="#DC2626" />
          </View>
          <Text style={styles.cardTitle}>Lates Per Half-Day</Text>
        </View>
        <Text style={styles.cardSubtitle}>Number of late check-ins that count as a 0.5 day salary deduction</Text>
        <View style={styles.unitRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="number-pad"
            value={latesPerHalfDay}
            onChangeText={setLatesPerHalfDay}
            placeholder="3"
          />
          <Text style={styles.unitText}>lates = ½ day deduction</Text>
        </View>
      </View>

      {/* Monthly Leave Allowance */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBubble, { backgroundColor: '#E8F5E9' }]}>
            <CalendarPlus size={20} color="#2E7D32" />
          </View>
          <Text style={styles.cardTitle}>Monthly Leave Allowance</Text>
        </View>
        <Text style={styles.cardSubtitle}>Paid leave days earned per month (0 = disabled). Employees accumulate balance from joining date.</Text>
        <View style={styles.unitRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="decimal-pad"
            value={monthlyLeaveAllowance}
            onChangeText={setMonthlyLeaveAllowance}
            placeholder="0"
          />
          <Text style={styles.unitText}>days / month</Text>
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Save size={20} color="#fff" />
            <Text style={styles.saveBtnText}>Save Configuration</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  cardSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: 48,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 48,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 48,
  },
  timeGroup: {
    alignItems: 'center',
    gap: 4,
  },
  timeLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  timeInput: {
    width: 48,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    textAlign: 'center',
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.text,
    backgroundColor: '#FAFAFA',
  },
  timeSep: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  timeDash: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginHorizontal: 6,
    marginBottom: 8,
  },
  input: {
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: '#FAFAFA',
    marginLeft: 48,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: 48,
  },
  unitText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    marginTop: Spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
});
