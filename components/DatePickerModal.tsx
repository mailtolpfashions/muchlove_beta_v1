import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface DatePickerModalProps {
  visible: boolean;
  value?: Date | null;
  title?: string;
  onSelect: (date: Date | null) => void;
  onClose: () => void;
  minDate?: Date;
  maxDate?: Date;
}

export default function DatePickerModal({
  visible,
  value,
  title = 'Select Date',
  onSelect,
  onClose,
  minDate,
  maxDate,
}: DatePickerModalProps) {
  const initial = value || new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [selected, setSelected] = useState<Date | null>(value || null);

  // Reset view when modal opens
  React.useEffect(() => {
    if (visible) {
      const d = value || new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelected(value || null);
    }
  }, [visible, value]);

  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewYear, viewMonth]);

  const today = useMemo(() => new Date(), []);

  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const goToPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const goToNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelect = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    setSelected(d);
  };

  const handleConfirm = () => {
    onSelect(selected);
    onClose();
  };

  const handleClear = () => {
    onSelect(null);
    onClose();
  };

  // Build grid: empty slots + day numbers
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrev} style={styles.navBtn}>
              <ChevronLeft size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={goToNext} style={styles.navBtn}>
              <ChevronRight size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={styles.weekRow}>
            {DAYS.map(d => (
              <View key={d} style={styles.weekCell}>
                <Text style={styles.weekText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Date grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (day === null) {
                return <View key={`e-${idx}`} style={styles.dayCell} />;
              }

              const dateObj = new Date(viewYear, viewMonth, day);
              const isSelected = selected ? isSameDay(dateObj, selected) : false;
              const isToday = isSameDay(dateObj, today);
              const disabled = isDisabled(day);

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCell,
                    isToday && styles.todayCell,
                    isSelected && styles.selectedCell,
                  ]}
                  onPress={() => !disabled && handleSelect(day)}
                  disabled={disabled}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isToday && styles.todayText,
                      isSelected && styles.selectedText,
                      disabled && styles.disabledText,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>
                {selected
                  ? `Select ${selected.getDate().toString().padStart(2, '0')}-${(selected.getMonth() + 1).toString().padStart(2, '0')}-${selected.getFullYear()}`
                  : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CELL_SIZE = 42;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.screen,
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    width: '100%',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  weekCell: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxHeight: CELL_SIZE,
  },
  dayText: {
    fontSize: FontSize.body,
    fontWeight: '500',
    color: Colors.text,
  },
  todayCell: {
    borderRadius: 999,
    backgroundColor: Colors.background,
  },
  todayText: {
    fontWeight: '700',
    color: Colors.primary,
  },
  selectedCell: {
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  selectedText: {
    fontWeight: '700',
    color: Colors.surface,
  },
  disabledText: {
    color: Colors.border,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  clearBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.background,
  },
  clearBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
  },
  confirmBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.surface,
  },
});
