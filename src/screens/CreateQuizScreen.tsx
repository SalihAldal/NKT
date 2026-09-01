import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useQuizStore } from '@/store/quizStore';

export function CreateQuizScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, setTitle, setDescription, setStep } = useQuizStore();

  const handleContinue = () => {
    if (!draft.title.trim()) {
      Alert.alert('Uyarı', 'Test başlığı gerekli');
      return;
    }
    setStep(2);
    navigation.navigate('EditQuestions');
  };

  return (
    <View style={styles.wrapper}>
      <Header title="Quiz Oluştur" />
      <ScreenContainer keyboard>
        <Text style={styles.title}>Test detaylarını gir</Text>
        <Text style={styles.sub}>Arkadaşların bu bilgilerle testini görecek</Text>
        <Input label="Test Başlığı" value={draft.title} onChangeText={setTitle} placeholder="Örn: Beni ne kadar tanıyorsun?" />
        <Input label="Açıklama (opsiyonel)" value={draft.description} onChangeText={setDescription} placeholder="Kısa bir açıklama" multiline />
        <Button title="Sorulara Geç →" onPress={handleContinue} />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  sub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
});
