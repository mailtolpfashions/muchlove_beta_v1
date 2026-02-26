import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ArrowDownAZ, ArrowUpZA, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';

export type SortOption = 'a-z' | 'z-a' | 'recent';

interface SortPillsProps {
  value: SortOption;
  onChange: (v: SortOption) => void;
}

const options: { key: SortOption; label: string; Icon: any }[] = [
  { key: 'a-z', label: 'A–Z', Icon: ArrowDownAZ },
  { key: 'z-a', label: 'Z–A', Icon: ArrowUpZA },
  { key: 'recent', label: 'Recent', Icon: Clock },
];

export default function SortPills({ value, onChange }: SortPillsProps) {
  return (
    <View style={styles.row}>
      {options.map(({ key, label, Icon }) => {
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
