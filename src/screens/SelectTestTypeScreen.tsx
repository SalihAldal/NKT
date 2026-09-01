import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, radii } from '@/theme';
import { QUIZ_CATEGORIES } from '@/constants';
import type { RootStackParamList } from '@/navigation/types';
import type { QuizCategoryId } from '@/types';
import { useQuizStore } from '@/store/quizStore';

const STEPS = ['Tür Seç', 'Sorular', 'Ayarlar', 'Paylaş'];

export function SelectTestTypeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, setCategory, resetDraft } = useQuizStore();
  const [selected, setSelected] = useState<QuizCategoryId | null>(draft.categoryId);

  const handleContinue = () => {
    if (!selected) return;
    setCategory(selected);
    navigation.navigate('CreateQuiz');
  };

  return (
    <View style={styles.wrapper}>
      <Header title="Test Türü Seç" />
      <ScreenContainer scroll={false} edges={[]}>
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={step} style={styles.stepItem}>
              <View style={[styles.stepDot, i === 0 && styles.stepActive]}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, i === 0 && styles.stepLabelActive]}>{step}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.title}>Ne tür bir test oluşturmak istersin?</Text>

        <FlatList
          data={QUIZ_CATEGORIES}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            const isSelected = selected === item.id;
            return (
              <TouchableOpacity
                style={[styles.categoryCard, isSelected && styles.categorySelected]}
                onPress={() => setSelected(item.id as QuizCategoryId)}
                activeOpacity={0.8}
              >
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={styles.check} />
                ) : null}
                <Text style={styles.categoryEmoji}>{item.emoji}</Text>
                <Text style={styles.categoryLabel} numberOfLines={2}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <View style={styles.footer}>
          <Button title="Devam Et →" onPress={handleContinue} disabled={!selected} />
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepActive: { backgroundColor: colors.primary },
  stepNum: { ...typography.small, color: colors.text, fontWeight: '700' },
  stepLabel: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  stepLabelActive: { color: colors.primary },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xl },
  grid: { paddingBottom: 100 },
  gridRow: { gap: spacing.md, marginBottom: spacing.md },
  categoryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  categorySelected: { borderColor: colors.primary, borderWidth: 2 },
  check: { position: 'absolute', top: 10, right: 10 },
  categoryEmoji: { fontSize: 32 },
  categoryLabel: { ...typography.caption, color: colors.text, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 24, left: 20, right: 20 },
});
