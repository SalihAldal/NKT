import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface StageTransitionViewProps {
  title: string;
  subtitle: string;
}

export function StageTransitionView({ title, subtitle }: StageTransitionViewProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.md },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  sub: { ...typography.h3, color: colors.textSecondary, textAlign: 'center' },
});
