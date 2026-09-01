import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const recoverPassword = useAuthStore((s) => s.recoverPassword);
  const consumeRecoveryCode = useAuthStore((s) => s.consumeRecoveryCode);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [username, setUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const submit = async () => {
    try {
      await recoverPassword(username.trim(), recoveryCode.trim(), newPassword);
      const rotated = consumeRecoveryCode();
      if (rotated) {
        navigation.replace('RecoveryCode', { code: rotated });
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] });
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Şifre sıfırlama başarısız');
    }
  };

  return (
    <ScreenContainer keyboard>
      <View style={styles.container}>
        <Text style={styles.title}>Şifremi Unuttum</Text>
        <Text style={styles.sub}>Kullanıcı adın + kurtarma kodun ile yeni şifre belirle.</Text>
        <Input label="Kullanıcı Adı" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <Input label="Kurtarma Kodu" value={recoveryCode} onChangeText={setRecoveryCode} autoCapitalize="characters" />
        <Input label="Yeni Şifre" value={newPassword} onChangeText={setNewPassword} isPassword />
        <Button title="Şifreyi Güncelle" onPress={submit} loading={isLoading} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.lg, paddingTop: spacing['2xl'] },
  title: { ...typography.h2, color: colors.text },
  sub: { ...typography.body, color: colors.textSecondary },
});
