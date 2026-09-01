import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import type { RoundResultView } from '@/domain/models/game';
import { GameScoreboard } from './GameScoreboard';
import type { PlayerScoreEntry } from '@/domain/models/game';

interface RoundResultCardProps {
  result: RoundResultView;
  scores: PlayerScoreEntry[];
}

export function RoundResultCard({ result, scores }: RoundResultCardProps) {
  const emoji = result.isCorrect || result.completed ? '✅' : result.completed === false ? '❌' : '⏱';
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      {result.scoreAwarded > 0 ? (
        <Text style={styles.score}>+{result.scoreAwarded}</Text>
      ) : (
        <Text style={styles.scoreMuted}>0 puan</Text>
      )}
      {result.revealedAnswer ? (
        <Text style={styles.answer}>Cevap: {result.revealedAnswer}</Text>
      ) : null}
      {result.responseTimeMs ? (
        <Text style={styles.time}>{(result.responseTimeMs / 1000).toFixed(1)}s</Text>
      ) : null}
      <Text style={styles.total}>Toplam: {result.totalScore}</Text>
      <GameScoreboard scores={scores} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  emoji: { fontSize: 48 },
  score: { ...typography.h1, color: colors.success },
  scoreMuted: { ...typography.h3, color: colors.textMuted },
  answer: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  time: { ...typography.caption, color: colors.textMuted },
  total: { ...typography.label, color: colors.primary },
});
