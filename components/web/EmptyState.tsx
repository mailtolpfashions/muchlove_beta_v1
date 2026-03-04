/**
 * Empty state placeholder for tables and screens with no data.
 * Renders a centered icon + title + subtitle.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { WebTypo } from '@/constants/web';

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  iconWrap: {
    marginBottom: 16,
    opacity: 0.5,
  },
  title: {
    fontSize: WebTypo.h3,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: WebTypo.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
});
