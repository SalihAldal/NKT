import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';
import { useQuizStore } from '@/store/quizStore';

export function QuizPreviewScreen() {
  const navigation = useNavigation();
  const { draft } = useQuizStore();

  return (
    <View style={styles.wrapper}>
      <Header title="Önizleme" />
      <ScreenContainer>
        <Text style={styles.title}>{draft.title}</Text>
        {draft.questions.map((q, i) => (
          <Card key={q.id} style={styles.card}>
            <Text style={styles.qNum}>Soru {i + 1}</Text>
            <Text style={styles.qText}>{q.text || '—'}</Text>
          </Card>
        ))}
        <Button title="Geri Dön" variant="outline" onPress={() => navigation.goBack()} />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xl },
  card: { marginBottom: spacing.md },
  qNum: { ...typography.small, color: colors.primary },
  qText: { ...typography.body, color: colors.text },
});
