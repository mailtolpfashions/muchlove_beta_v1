/**
 * Fade-in + slide-up animation wrapper for admin page content.
 * Uses React Native's built-in Animated API — no extra dependencies.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

export function AnimatedPage({ children }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
