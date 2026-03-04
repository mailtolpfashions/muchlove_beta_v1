/**
 * HTML date input wrapper styled to match the salon design system.
 * Web-only — uses TextInput which react-native-web renders as <input>.
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { WebTypo } from '@/constants/web';

interface Props {
  value: string;            // YYYY-MM-DD
  onChange: (v: string) => void;
  label?: string;
  min?: string;
  max?: string;
  style?: object;
}

export function WebDatePicker({ value, onChange, label, min, max, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        // @ts-ignore — web-only props passed through to <input>
        type="date"
        min={min}
        max={max}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 150,
  },
  label: {
    fontSize: WebTypo.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: WebTypo.body,
    color: Colors.text,
    backgroundColor: Colors.inputBg,
    // @ts-ignore — web outline
    outlineColor: Colors.inputFocus,
  },
});
