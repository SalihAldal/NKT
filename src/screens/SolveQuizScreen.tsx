import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StateView } from '@/components/feedback/StateView';
import { colors, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useQuizStore } from '@/store/quizStore';
import { api } from '@/api/client';
import type { Quiz } from '@/types';

export function SolveQuizScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SolveQuiz'>>();
  const {
    currentQuiz, solvingAnswers, solvingIndex,
    startSolving, setAnswer, nextQuestion, prevQuestion, submitQuiz, loadQuiz,
  } = useQuizStore();
  const [loading, setLoading] = useState(true);
  const [solverName, setSolverName] = useState('');
  const [showNameInput, setShowNameInput] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        let quiz: Quiz;
        if (route.params?.quizId) {
          quiz = await api.getQuiz(route.params.quizId);
        } else if (route.params?.shareCode) {
          quiz = await api.getQuizByShareCode(route.params.shareCode);
        } else {
          throw new Error('Quiz bulunamadı');
        }
        startSolving(quiz);
      } catch (e) {
        Alert.alert('Hata', e instanceof Error ? e.message : 'Quiz yüklenemedi', [
          { text: 'Tamam', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [route.params]);

  if (loading) return <StateView type="loading" />;
  if (!currentQuiz) return <StateView type="error" onRetry={() => navigation.goBack()} />;

  const question = currentQuiz.questions[solvingIndex];
  if (!question) return <StateView type="error" />;

  const progress = ((solvingIndex + 1) / currentQuiz.questions.length) * 100;
  const isLast = solvingIndex === currentQuiz.questions.length - 1;
  const currentAnswer = solvingAnswers[question.id];

  const handleSubmit = async () => {
    if (!solverName.trim()) {
      Alert.alert('İsim gerekli', 'Devam etmek için adını gir');
      return;
    }
    try {
      const attempt = await submitQuiz(solverName);
      navigation.replace('Result', { quizId: currentQuiz.id, attempt });
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Gönderilemedi');
    }
  };

  if (showNameInput) {
    return (
      <View style={styles.wrapper}>
        <Header title={currentQuiz.title} />
        <ScreenContainer keyboard>
          <Text style={styles.title}>Adın ne?</Text>
          <Text style={styles.sub}>Sonuçlarda bu isim görünecek</Text>
          <Input label="İsmin" value={solverName} onChangeText={setSolverName} placeholder="İsmini yaz..." />
          <Button
            title="Başla"
            onPress={() => {
              if (!solverName.trim()) setSolverName('Misafir');
              setShowNameInput(false);
            }}
          />
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Header title={`${solvingIndex + 1}/${currentQuiz.questions.length}`} />
      <ScreenContainer scroll={false}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <Text style={styles.question}>{question.text}</Text>

        {question.type === 'multiple_choice' && question.options
          ? question.options.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.option, currentAnswer === opt.id && styles.optionSelected]}
                onPress={() => setAnswer(question.id, opt.id)}
              >
                <Text style={styles.optionText}>{opt.text}</Text>
              </TouchableOpacity>
            ))
          : null}

        <View style={styles.navRow}>
          <Button title="← Geri" variant="outline" onPress={prevQuestion} fullWidth={false} style={styles.navBtn} disabled={solvingIndex === 0} />
          {isLast ? (
            <Button title="Bitir" onPress={handleSubmit} fullWidth={false} style={styles.navBtn} disabled={!currentAnswer} />
          ) : (
            <Button title="İleri →" onPress={nextQuestion} fullWidth={false} style={styles.navBtn} disabled={!currentAnswer} />
          )}
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.text },
  sub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  nameInput: { marginBottom: spacing.xl },
  inputLabel: { ...typography.label, color: colors.textSecondary },
  inputBox: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, marginTop: spacing.sm },
  inputText: { ...typography.body, color: colors.text },
  progressBar: { height: 4, backgroundColor: colors.surface, borderRadius: 2, marginBottom: spacing.xl },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  question: { ...typography.h2, color: colors.text, marginBottom: spacing['2xl'] },
  option: { backgroundColor: colors.card, borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.surfaceBorder },
  optionSelected: { borderColor: colors.primary, backgroundColor: 'rgba(139,92,246,0.15)' },
  optionText: { ...typography.body, color: colors.text },
  navRow: { flexDirection: 'row', gap: spacing.md, marginTop: 'auto', paddingBottom: spacing.xl },
  navBtn: { flex: 1 },
});
