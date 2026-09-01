import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, radii } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { supportService, type SupportCategory } from '@/services/support/support.service';
import { analytics } from '@/services/analytics';

const CATEGORIES: Array<{ key: SupportCategory; label: string }> = [
  { key: 'bug', label: 'Hata Bildirimi' },
  { key: 'content', label: 'İçerik Şikayeti' },
  { key: 'account', label: 'Hesap Sorunu' },
  { key: 'payment', label: 'Ödeme Sorunu' },
  { key: 'other', label: 'Diğer' },
];

export function ContactUsScreen() {
  const user = useAuthStore((s) => s.user);
  const [category, setCategory] = useState<SupportCategory>('bug');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Hata', 'Lütfen bir açıklama yaz.');
      return;
    }
    setLoading(true);
    try {
      await supportService.submitTicket(user?.id ?? 'guest', category, description.trim());
      analytics.track({ name: 'support_ticket_created', params: { category } });
      Alert.alert('Teşekkürler', 'Mesajın alındı. En kısa sürede dönüş yapacağız.');
      setDescription('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Header title="Bize Ulaşın" />
      <ScreenContainer>
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.categories}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c.key} style={[styles.catBtn, category === c.key && styles.catActive]} onPress={() => setCategory(c.key)}>
              <Text style={[styles.catText, category === c.key && styles.catTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Açıklama</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Sorununu detaylı anlat..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <Button title="Gönder" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.xl }} />
        <Text style={styles.email}>destek@nkt.app</Text>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  label: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  catBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.surface },
  catActive: { backgroundColor: colors.primary },
  catText: { ...typography.small, color: colors.textMuted },
  catTextActive: { color: colors.text },
  input: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, color: colors.text, ...typography.body, minHeight: 120, borderWidth: 1, borderColor: colors.surfaceBorder },
  email: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
