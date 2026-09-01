import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface GameProgressProps {
  current: number;
  total: number;
  stageNum: 1 | 2 | 3;
}

const STAGE_LABELS = ['EASY', 'MEDIUM', 'HARD'] as const;

export function GameProgress({ current, total, stageNum }: GameProgressProps) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.round}>{current} / {total}</Text>
        <View style={styles.stages}>
          {STAGE_LABELS.map((label, i) => (
            <Text
              key={label}
              style={[styles.stage, i + 1 === stageNum && styles.stageActive, i + 1 < stageNum && styles.stageDone]}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.track} accessibilityLabel={`Tur ${current} / ${total}`}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  round: { ...typography.label, color: colors.text },
  stages: { flexDirection: 'row', gap: spacing.xs },
  stage: { ...typography.small, color: colors.textMuted, fontWeight: '600' },
  stageActive: { color: colors.primary },
  stageDone: { color: colors.success },
  track: { height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
});
