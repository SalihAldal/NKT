import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useQuizStore } from '@/store/quizStore';
import { useAuthStore } from '@/store/authStore';
import { QUIZ_LIMITS } from '@/constants';

export function EditQuestionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const {
    draft, addQuestion, removeQuestion, generateWithAI,
    isGeneratingAI, aiError, validateDraft, setStep,
  } = useQuizStore();

  useEffect(() => {
    if (draft.questions.length === 0) {
      for (let i = 0; i < QUIZ_LIMITS.DEFAULT_QUESTIONS; i++) addQuestion();
    }
  }, []);

  const handleAI = async () => {
    await generateWithAI('arkadaşlık', 10, user?.isPremium ?? false);
    if (aiError) Alert.alert('AI', aiError);
  };

  const handleContinue = () => {
    const { valid, errors } = validateDraft();
    if (!valid) {
      Alert.alert('Eksik bilgi', errors[0]);
      return;
    }
    setStep(4);
    navigation.navigate('ShareQuiz', { quizId: 'draft' });
  };

  return (
    <View style={styles.wrapper}>
      <Header title="Sorularını Oluştur" />
      <ScreenContainer scroll={false} edges={[]}>
        <View style={styles.topBar}>
          <Text style={styles.count}>Toplam {draft.questions.length} soru</Text>
          <TouchableOpacity style={styles.aiBtn} onPress={handleAI} disabled={isGeneratingAI}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={styles.aiText}>{isGeneratingAI ? 'Üretiliyor...' : 'AI ile Oluştur'}</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={draft.questions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={styles.questionCard}>
              <Ionicons name="reorder-three" size={20} color={colors.textMuted} />
              <View style={styles.questionContent}>
                <Text style={styles.questionText} numberOfLines={2}>
                  {item.text || `Soru ${index + 1}`}
                </Text>
                <Text style={styles.questionType}>
                  {item.type === 'multiple_choice' ? 'Çoktan Seçmeli' : 'Açık Uçlu'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('QuestionEditor', { questionId: item.id })}>
                <Ionicons name="pencil" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeQuestion(item.id)}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        />

        <View style={styles.footer}>
          <Button title="+ Soru Ekle" onPress={() => addQuestion()} variant="secondary" />
          <Button title="Önizleme" onPress={() => navigation.navigate('QuizPreview')} variant="outline" style={styles.previewBtn} />
          <Button title="Paylaşmaya Geç →" onPress={handleContinue} />
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  count: { ...typography.label, color: colors.text },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  aiText: { ...typography.small, color: colors.primary },
  list: { paddingBottom: 200, gap: spacing.md },
  questionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.surfaceBorder },
  questionContent: { flex: 1 },
  questionText: { ...typography.bodyMedium, color: colors.text },
  questionType: { ...typography.small, color: colors.textMuted },
  footer: { position: 'absolute', bottom: 24, left: 20, right: 20, gap: spacing.md },
  previewBtn: { marginVertical: spacing.sm },
});
