import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useQuizStore } from '@/store/quizStore';

export function QuestionEditorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'QuestionEditor'>>();
  const { draft, updateQuestion } = useQuizStore();
  const question = draft.questions.find((q) => q.id === route.params?.questionId);
  const [text, setText] = useState(question?.text ?? '');

  if (!question) {
    return null;
  }

  const handleSave = () => {
    if (!text.trim()) {
      Alert.alert('Uyarı', 'Soru metni gerekli');
      return;
    }
    updateQuestion(question.id, { text });
    navigation.goBack();
  };

  return (
    <View style={styles.wrapper}>
      <Header title="Soruyu Düzenle" />
      <ScreenContainer keyboard>
        <Input label="Soru" value={text} onChangeText={setText} placeholder="Sorunu yaz..." multiline />
        <Text style={styles.type}>Tip: {question.type === 'multiple_choice' ? 'Çoktan Seçmeli' : 'Açık Uçlu'}</Text>
        <Button title="Kaydet" onPress={handleSave} />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  type: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xl },
});
