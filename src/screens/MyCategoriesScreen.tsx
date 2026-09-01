import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { customCategoryService } from '@/services/content/custom-category.service';
import { analytics } from '@/services/analytics';
import { isAppError } from '@/services/errors/app-error';

export function MyCategoriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async () => {
    if (!userId || !name.trim()) return;
    setError('');
    try {
      const cat = await customCategoryService.create(userId, name.trim(), description.trim());
      analytics.track({ name: 'custom_category_created', params: { categoryId: cat.id } });
      setSuccess('Kategori DRAFT olarak kaydedildi. Moderasyon sonrası odanda kullanılabilir.');
      setName('');
      setDescription('');
    } catch (e) {
      setError(isAppError(e) ? e.userMessage : (e instanceof Error ? e.message : 'Oluşturulamadı'));
    }
  };

  return (
    <ScreenContainer>
      <Button
        title=""
        onPress={() => navigation.goBack()}
        variant="ghost"
        icon={<Ionicons name="arrow-back" size={24} color={colors.text} />}
        fullWidth={false}
        style={styles.back}
      />
      <Text style={styles.title}>Kategorilerim</Text>
      <Text style={styles.sub}>Premium kullanıcılar özel kategori oluşturabilir. Yalnızca odanda görünür.</Text>

      <ScrollView style={styles.form}>
        <Input label="Kategori Adı" value={name} onChangeText={setName} placeholder="Örn: Bizim Eğlence" />
        <Input label="Açıklama" value={description} onChangeText={setDescription} placeholder="Kısa açıklama" multiline />
        <Button title="Kaydet (DRAFT)" onPress={handleCreate} />
        {success ? <Text style={styles.success}>{success}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.text },
  sub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  success: { ...typography.body, color: colors.success, marginTop: spacing.md },
  error: { ...typography.small, color: colors.error, marginTop: spacing.md },
});
