import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import type { AnswerUiState } from '@/domain/models/game';

interface QuestionCardProps {
  prompt: string;
  targetName?: string;
  options?: Array<{ id: string; text: string }>;
  answerState: AnswerUiState;
  role: 'asker' | 'responder';
  onChoice?: (id: string) => void;
  textAnswer?: string;
  onTextChange?: (t: string) => void;
  onTextSubmit?: () => void;
}

export function QuestionCard({
  prompt,
  targetName,
  options,
  answerState,
  role,
  onChoice,
  textAnswer,
  onTextChange,
  onTextSubmit,
}: QuestionCardProps) {
  const locked = answerState === 'locked' || answerState === 'submitting' || answerState === 'timeout';

  return (
    <View style={styles.card}>
      <Text style={styles.badge}>🧠 SORU</Text>
      {role === 'asker' && targetName ? (
        <Text style={styles.role}>{targetName} adlı oyuncuya sor</Text>
      ) : (
        <Text style={styles.role}>Cevabını ver</Text>
      )}
      <ScrollView style={styles.promptScroll} nestedScrollEnabled>
        <Text style={styles.prompt}>{prompt}</Text>
      </ScrollView>

      {role === 'responder' && options ? (
        <View style={styles.options}>
          {options.map((opt) => (
            <Button
              key={opt.id}
              title={opt.text}
              onPress={() => onChoice?.(opt.id)}
              variant="outline"
              disabled={locked}
              style={styles.optBtn}
            />
          ))}
        </View>
      ) : null}

      {role === 'asker' ? (
        <Text style={styles.hint}>Cevaplayanın yanıtını bekle...</Text>
      ) : null}

      {answerState === 'submitting' ? (
        <Text style={styles.hint}>Cevabın kaydediliyor…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: colors.surfaceBorder },
  badge: { ...typography.small, color: colors.primary, fontWeight: '700' },
  role: { ...typography.caption, color: colors.textSecondary },
  promptScroll: { maxHeight: 200 },
  prompt: { ...typography.h3, color: colors.text, flexWrap: 'wrap' },
  options: { gap: spacing.sm },
  optBtn: { marginBottom: spacing.xs },
  hint: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
