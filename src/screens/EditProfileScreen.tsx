import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, radii } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { profileService } from '@/services/profile/profile.service';
import { analytics } from '@/services/analytics';

export function EditProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(user?.avatar);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickAvatar = () => {
    Alert.alert('Avatar', 'Fotoğraf yükleme yakında aktif olacak.', [
      { text: 'Tamam' },
      { text: 'Mock Avatar', onPress: () => setAvatarUri(`avatar://${user?.id}`) },
    ]);
  };

  const handleSave = async () => {
    const validation = profileService.validate({ name, bio });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setLoading(true);
    try {
      const updated = await profileService.updateProfile(user!.id, { name, bio, avatarUri });
      setUser(updated);
      analytics.track({ name: 'profile_edited', params: { fields: 'name,bio' } });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Profil güncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Header title="Profili Düzenle" />
      <ScreenContainer>
        <ScrollView keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} accessibilityLabel="Avatar değiştir">
            <View style={styles.avatar}><Text style={styles.avatarText}>{name[0] ?? '?'}</Text></View>
            <Text style={styles.changePhoto}>Fotoğrafı Değiştir</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Görünen Ad</Text>
          <TextInput style={[styles.input, errors.name && styles.inputError]} value={name} onChangeText={setName} placeholder="Adın" placeholderTextColor={colors.textMuted} maxLength={50} />
          {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

          <Text style={styles.label}>Kullanıcı Adı (Sabit)</Text>
          <TextInput
            style={[styles.input, styles.readonly]}
            value={user?.username ?? ''}
            editable={false}
            selectTextOnFocus={false}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} placeholder="Kendinden bahset..." placeholderTextColor={colors.textMuted} multiline maxLength={160} />
          {errors.bio ? <Text style={styles.error}>{errors.bio}</Text> : null}

          <Button title="Kaydet" onPress={handleSave} loading={loading} style={{ marginTop: spacing.xl }} />
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { ...typography.h1, color: colors.text },
  changePhoto: { ...typography.label, color: colors.primary, marginTop: spacing.sm },
  label: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, color: colors.text, ...typography.body, borderWidth: 1, borderColor: colors.surfaceBorder },
  readonly: { opacity: 0.7 },
  inputError: { borderColor: colors.error },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  error: { ...typography.small, color: colors.error, marginTop: 4 },
});
