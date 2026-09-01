import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface GameTimerProps {
  timeRemainingMs: number;
  totalMs?: number;
}

export function GameTimer({ timeRemainingMs, totalMs = 15000 }: GameTimerProps) {
  const seconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const pulse = useRef(new Animated.Value(1)).current;
  const isWarning = seconds <= 5 && seconds > 3;
  const isCritical = seconds <= 3 && seconds > 0;

  useEffect(() => {
    if (isCritical) {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [seconds, isCritical, pulse]);

  const color = isCritical ? colors.error : isWarning ? colors.warning : colors.text;
  const pct = Math.min(100, Math.max(0, (timeRemainingMs / totalMs) * 100));

  return (
    <View style={styles.wrap}>
      <Animated.Text
        style={[styles.timer, { color, transform: [{ scale: pulse }] }]}
        accessibilityLabel={`Kalan süre ${seconds} saniye`}
      >
        ⏱ {seconds}s
      </Animated.Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, alignItems: 'center' },
  timer: { ...typography.h2, fontWeight: '800' },
  track: { width: '100%', height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});
