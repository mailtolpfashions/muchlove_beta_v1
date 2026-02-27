import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ArrowDownAZ, ArrowUpZA, Clock, TrendingUp, TrendingDown, Flame } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';

export type SortOption = 'a-z' | 'z-a' | 'recent' | 'visits-high' | 'visits-low';

export interface SortPillOption {
  key: SortOption;
  label: string;
  Icon: any;
}

interface SortPillsProps {
  value: SortOption;
  onChange: (v: SortOption) => void;
  /** Pass custom options to override the default set */
  options?: SortPillOption[];
}

const defaultOptions: SortPillOption[] = [
  { key: 'recent', label: 'Recent', Icon: Flame },
  { key: 'a-z', label: 'A–Z', Icon: ArrowDownAZ },
  { key: 'z-a', label: 'Z–A', Icon: ArrowUpZA },
];

export const visitSortOptions: SortPillOption[] = [
  { key: 'visits-high', label: 'Visits ↓', Icon: TrendingDown },
  { key: 'visits-low', label: 'Visits ↑', Icon: TrendingUp },
];

function SortPills({ value, onChange, options }: SortPillsProps) {
  const pills = options ?? defaultOptions;
  return (
    <View style={styles.row}>
      {pills.map(({ key, label, Icon }) => {
        const active = value === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(key)}
            activeOpacity={0.7}
          >
            <Icon size={12} color={active ? Colors.surface : Colors.textSecondary} />
            <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default React.memo(SortPills);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  textActive: {
    color: Colors.surface,
  },
});
