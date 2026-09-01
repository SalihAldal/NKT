import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useQuizStore } from '@/store/quizStore';
import { shareResult } from '@/services/sharing';
import { analytics } from '@/services/analytics';

export function ResultScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Result'>>();
  const { currentQuiz, currentAttempt } = useQuizStore();
  const attempt = route.params.attempt ?? currentAttempt;

  React.useEffect(() => {
    if (attempt && currentQuiz) {
      analytics.track({ name: 'result_viewed', params: { quizId: currentQuiz.id, score: attempt.score } });
    }
  }, [attempt, currentQuiz]);

  if (!attempt || !currentQuiz) {
    return null;
  }

  const creatorName = currentQuiz.creatorName.split(' ')[0];

  return (
    <View style={styles.wrapper}>
      <Header title="" showBack={false} rightAction={
        <Text onPress={() => shareResult(currentQuiz.title, attempt.score, attempt.correctCount, attempt.totalQuestions)}>↗</Text>
      } />
      <ScreenContainer>
        <Text style={styles.celebration}>Harika! 🎉</Text>
        <Text style={styles.headline}>
          {creatorName}&apos;i %{attempt.score} oranında tanıyorsun!
        </Text>

        <View style={styles.ringContainer}>
          <ScoreRing percentage={attempt.score} label={`${attempt.correctCount} / ${attempt.totalQuestions} doğru`} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statValueGreen}>{attempt.correctCount} Doğru</Text></View>
          <View style={styles.stat}><Text style={styles.statValueRed}>{attempt.totalQuestions - attempt.correctCount} Yanlış</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{attempt.averageTimeSeconds} sn Ort.</Text></View>
        </View>

        <Button title="Sonucu Paylaş ✨" onPress={() => shareResult(currentQuiz.title, attempt.score, attempt.correctCount, attempt.totalQuestions)} />
        <Button title="Testi Tekrar Çöz" variant="outline" onPress={() => navigation.replace('SolveQuiz', { quizId: currentQuiz.id })} />

        <Card style={styles.ctaCard}>
          <Text style={styles.ctaEmoji}>🏆</Text>
          <Text style={styles.ctaText}>Sen de kendi testini oluştur!</Text>
          <Button title="Test Oluştur +" onPress={() => navigation.navigate('SelectTestType')} fullWidth={false} />
        </Card>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  celebration: { ...typography.h1, color: colors.text, textAlign: 'center' },
  headline: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  ringContainer: { alignItems: 'center', marginVertical: spacing['2xl'] },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing['2xl'] },
  stat: { alignItems: 'center' },
  statValueGreen: { ...typography.label, color: colors.success },
  statValueRed: { ...typography.label, color: colors.error },
  statValue: { ...typography.label, color: colors.text },
  ctaCard: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  ctaEmoji: { fontSize: 32 },
  ctaText: { ...typography.bodyMedium, color: colors.text },
});
