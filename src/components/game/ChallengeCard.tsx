import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import type { AnswerUiState } from '@/domain/models/game';

interface ChallengeCardProps {
  prompt: string;
  answerState: AnswerUiState;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function ChallengeCard({ prompt, answerState, onComplete, onSkip }: ChallengeCardProps) {
  const locked = answerState === 'locked' || answerState === 'submitting' || answerState === 'timeout';

  return (
    <View style={styles.card}>
      <Text style={styles.badge}>🔥 GÖREV</Text>
      <ScrollView style={styles.promptScroll} nestedScrollEnabled>
        <Text style={styles.prompt}>{prompt}</Text>
      </ScrollView>
      {!locked ? (
        <View style={styles.actions}>
          <Button title="Görevi tamamladım ✓" onPress={() => onComplete?.()} />
          <Button title="Yapamadım" onPress={() => onSkip?.()} variant="ghost" />
        </View>
      ) : null}
      {answerState === 'submitting' ? (
        <Text style={styles.hint}>Kaydediliyor…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: spacing.xl, gap: spacing.lg, borderWidth: 1, borderColor: colors.warning + '44' },
  badge: { ...typography.small, color: colors.warning, fontWeight: '700' },
  promptScroll: { maxHeight: 220 },
  prompt: { ...typography.h3, color: colors.text, flexWrap: 'wrap' },
  actions: { gap: spacing.md },
  hint: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
