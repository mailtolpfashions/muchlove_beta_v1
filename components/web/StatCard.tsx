/**
 * Animated KPI stat card for the admin dashboard.
 * Counts up from 0 to target value on mount. Hover lift effect.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Colors } from '@/constants/colors';
import { WebTypo, WebColors } from '@/constants/web';

interface Props {
  icon: React.ReactNode;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  gradient: readonly [string, string];
}

export function StatCard({ icon, label, value, prefix = '', suffix = '', gradient }: Props) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hovered, setHovered] = useState(false);
  const liftAnim = useRef(new Animated.Value(0)).current;

  // Count-up animation
  useEffect(() => {
    if (value === 0) { setDisplayValue(0); return; }
    const duration = 800;
    const steps = 30;
    const stepTime = duration / steps;
    let current = 0;
    const increment = value / steps;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(current));
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);

  // Hover lift
  useEffect(() => {
    Animated.timing(liftAnim, {
      toValue: hovered ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hovered]);

  const translateY = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  const formatValue = (v: number) => {
    if (prefix === '₹') {
      return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString();
    }
    return v.toString();
  };

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <Animated.View
        style={[
          styles.card,
          { transform: [{ translateY }] },
          hovered && styles.cardHovered,
        ]}
      >
        <View style={styles.row}>
          <View style={styles.textCol}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>
              {prefix}{formatValue(displayValue)}{suffix}
            </Text>
          </View>
          <View style={[styles.iconCircle, { backgroundColor: gradient[0] + '18' }]}>
            {icon}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    shadowColor: WebColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    // @ts-ignore — web elevation
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F8F0F3',
    minWidth: 200,
  },
  cardHovered: {
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    borderColor: Colors.primaryLight,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: WebTypo.small,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: WebTypo.h1,
    fontWeight: '700',
    color: Colors.text,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
});
