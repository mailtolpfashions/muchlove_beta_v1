/**
 * Admin Attendance Config — weekly off, shift timing, grace, leaves, lates.
 * Form-based (not a DataTable) — mirrors mobile attendance-config screen.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
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
import { useData } from '@/providers/DataProvider';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';
import { AnimatedPage } from '@/components/web/AnimatedPage';
import { useAlert } from '@/providers/AlertProvider';

const WEEKDAYS = [
  { label: 'Sunday', short: 'Sun', value: 0 },
  { label: 'Monday', short: 'Mon', value: 1 },
  { label: 'Tuesday', short: 'Tue', value: 2 },
  { label: 'Wednesday', short: 'Wed', value: 3 },
  { label: 'Thursday', short: 'Thu', value: 4 },
  { label: 'Friday', short: 'Fri', value: 5 },
  { label: 'Saturday', short: 'Sat', value: 6 },
];

export default function AdminAttendanceConfig() {
  const { salonConfig, updateSalonConfig } = useData();
  const { showAlert } = useAlert();

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

    if (isNaN(startH) || startH < 0 || startH > 23) { showAlert('Invalid', 'Shift start hour must be 0–23'); return false; }
    if (isNaN(startM) || startM < 0 || startM > 59) { showAlert('Invalid', 'Shift start minutes must be 0–59'); return false; }
    if (isNaN(endH) || endH < 0 || endH > 23) { showAlert('Invalid', 'Shift end hour must be 0–23'); return false; }
    if (isNaN(endM) || endM < 0 || endM > 59) { showAlert('Invalid', 'Shift end minutes must be 0–59'); return false; }
    if (endH * 60 + endM <= startH * 60 + startM) { showAlert('Invalid', 'Shift end must be after shift start'); return false; }
    if (isNaN(workHrs) || workHrs <= 0 || workHrs > 24) { showAlert('Invalid', 'Working hours must be 1–24'); return false; }
    if (isNaN(grace) || grace < 0 || grace > 120) { showAlert('Invalid', 'Grace minutes must be 0–120'); return false; }
    if (isNaN(freePerm) || freePerm < 0 || freePerm > 100) { showAlert('Invalid', 'Free permission hours must be 0–100'); return false; }
    if (isNaN(leaveAllow) || leaveAllow < 0 || leaveAllow > 5) { showAlert('Invalid', 'Monthly leave allowance must be 0–5'); return false; }
    if (isNaN(latesHD) || latesHD < 1 || latesHD > 10) { showAlert('Invalid', 'Lates per half-day must be 1–10'); return false; }
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
    <AnimatedPage>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.grid}>

          {/* Weekly Off Day */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBubble, { backgroundColor: '#FCE4EC' }]}>
                <CalendarOff size={20} color="#E91E63" />
              </View>
              <View style={s.cardTitleBlock}>
                <Text style={s.cardTitle}>Weekly Off Day</Text>
                <Text style={s.cardSubtitle}>Recurring day off for all employees</Text>
              </View>
            </View>
            <View style={s.chipRow}>
              {WEEKDAYS.map(day => (
                <Pressable key={day.value} style={[s.chip, weeklyOffDay === day.value && s.chipActive]} onPress={() => setWeeklyOffDay(day.value)}>
                  <Text style={[s.chipText, weeklyOffDay === day.value && s.chipTextActive]}>{day.short}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Shift Timing */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBubble, { backgroundColor: '#E3F2FD' }]}>
                <Clock size={20} color="#1976D2" />
              </View>
              <View style={s.cardTitleBlock}>
                <Text style={s.cardTitle}>Shift Timing</Text>
                <Text style={s.cardSubtitle}>Current: {shiftDisplay}</Text>
              </View>
            </View>
            <View style={s.timeRow}>
              <View style={s.timeGroup}>
                <Text style={s.timeLabel}>Start Hour</Text>
                <TextInput style={s.timeInput} maxLength={2} value={shiftStartHour} onChangeText={setShiftStartHour} placeholder="9" placeholderTextColor={Colors.textTertiary} />
              </View>
              <Text style={s.timeSep}>:</Text>
              <View style={s.timeGroup}>
                <Text style={s.timeLabel}>Start Min</Text>
                <TextInput style={s.timeInput} maxLength={2} value={shiftStartMin} onChangeText={setShiftStartMin} placeholder="00" placeholderTextColor={Colors.textTertiary} />
              </View>
              <Text style={s.timeDash}>–</Text>
              <View style={s.timeGroup}>
                <Text style={s.timeLabel}>End Hour</Text>
                <TextInput style={s.timeInput} maxLength={2} value={shiftEndHour} onChangeText={setShiftEndHour} placeholder="20" placeholderTextColor={Colors.textTertiary} />
              </View>
              <Text style={s.timeSep}>:</Text>
              <View style={s.timeGroup}>
                <Text style={s.timeLabel}>End Min</Text>
                <TextInput style={s.timeInput} maxLength={2} value={shiftEndMin} onChangeText={setShiftEndMin} placeholder="00" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>
          </View>

          {/* Working Hours */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBubble, { backgroundColor: '#E8F5E9' }]}>
                <Coffee size={20} color="#388E3C" />
              </View>
              <View style={s.cardTitleBlock}>
                <Text style={s.cardTitle}>Net Working Hours / Day</Text>
                <Text style={s.cardSubtitle}>Shift minus breaks (e.g. 11hr − 2hr lunch = 9)</Text>
              </View>
            </View>
            <TextInput style={s.fieldInput} value={workingHoursPerDay} onChangeText={setWorkingHoursPerDay} placeholder="9" placeholderTextColor={Colors.textTertiary} />
          </View>

          {/* Grace Minutes */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBubble, { backgroundColor: '#FFF3E0' }]}>
                <Timer size={20} color="#E65100" />
              </View>
              <View style={s.cardTitleBlock}>
                <Text style={s.cardTitle}>Late Grace Period</Text>
                <Text style={s.cardSubtitle}>Minutes after shift start before marking late</Text>
              </View>
            </View>
            <View style={s.unitRow}>
              <TextInput style={[s.fieldInput, { flex: 1 }]} value={graceMinutes} onChangeText={setGraceMinutes} placeholder="15" placeholderTextColor={Colors.textTertiary} />
              <Text style={s.unitText}>minutes</Text>
            </View>
          </View>

          {/* Free Permission Hours */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBubble, { backgroundColor: '#F3E5F5' }]}>
                <Hourglass size={20} color="#7B1FA2" />
              </View>
              <View style={s.cardTitleBlock}>
                <Text style={s.cardTitle}>Free Permission Hours</Text>
                <Text style={s.cardSubtitle}>Monthly permission hours before salary deduction</Text>
              </View>
            </View>
            <View style={s.unitRow}>
              <TextInput style={[s.fieldInput, { flex: 1 }]} value={freePermissionHours} onChangeText={setFreePermissionHours} placeholder="2" placeholderTextColor={Colors.textTertiary} />
              <Text style={s.unitText}>hours / month</Text>
            </View>
          </View>

          {/* Lates Per Half-Day */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBubble, { backgroundColor: '#FEE2E2' }]}>
                <AlertTriangle size={20} color="#DC2626" />
              </View>
              <View style={s.cardTitleBlock}>
                <Text style={s.cardTitle}>Lates Per Half-Day</Text>
                <Text style={s.cardSubtitle}>Late check-ins that count as 0.5 day salary deduction</Text>
              </View>
            </View>
            <View style={s.unitRow}>
              <TextInput style={[s.fieldInput, { flex: 1 }]} value={latesPerHalfDay} onChangeText={setLatesPerHalfDay} placeholder="3" placeholderTextColor={Colors.textTertiary} />
              <Text style={s.unitText}>lates = ½ day deduction</Text>
            </View>
          </View>

          {/* Monthly Leave Allowance */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBubble, { backgroundColor: '#E8F5E9' }]}>
                <CalendarPlus size={20} color="#2E7D32" />
              </View>
              <View style={s.cardTitleBlock}>
                <Text style={s.cardTitle}>Monthly Leave Allowance</Text>
                <Text style={s.cardSubtitle}>Paid leave days earned per month (0 = disabled)</Text>
              </View>
            </View>
            <View style={s.unitRow}>
              <TextInput style={[s.fieldInput, { flex: 1 }]} value={monthlyLeaveAllowance} onChangeText={setMonthlyLeaveAllowance} placeholder="0" placeholderTextColor={Colors.textTertiary} />
              <Text style={s.unitText}>days / month</Text>
            </View>
          </View>

        </View>

        {/* Save Button */}
        <Pressable style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={s.saveBtnContent}>
              <Save size={18} color="#fff" />
              <Text style={s.saveBtnText}>Save Configuration</Text>
            </View>
          )}
        </Pressable>
      </ScrollView>
    </AnimatedPage>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 24,
    minWidth: 340,
    flex: 1,
    shadowColor: WebColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  iconBubble: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardTitleBlock: { flex: 1 },
  cardTitle: { fontSize: WebTypo.body, fontWeight: '700', color: Colors.text },
  cardSubtitle: { fontSize: WebTypo.tiny, color: Colors.textSecondary, marginTop: 2 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1.5, borderColor: '#E0E0E0' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: WebTypo.tiny, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  timeGroup: { alignItems: 'center', gap: 4 },
  timeLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500' },
  timeInput: {
    width: 52, height: 46, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0E0E0',
    textAlign: 'center', fontSize: 20, fontWeight: '700', color: Colors.text, backgroundColor: '#FAFAFA',
    outlineStyle: 'none' as any,
  },
  timeSep: { fontSize: 22, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10 },
  timeDash: { fontSize: 22, fontWeight: '700', color: Colors.textSecondary, marginHorizontal: 8, marginBottom: 10 },

  fieldInput: {
    height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0E0E0',
    paddingHorizontal: 14, fontSize: WebTypo.body, fontWeight: '600',
    color: Colors.text, backgroundColor: '#FAFAFA', outlineStyle: 'none' as any,
  },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitText: { fontSize: WebTypo.tiny, color: Colors.textSecondary, fontWeight: '500' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14,
    marginTop: 28, maxWidth: 280, alignSelf: 'center',
    paddingHorizontal: 32,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText: { fontSize: WebTypo.body, fontWeight: '700', color: '#fff' },
});
