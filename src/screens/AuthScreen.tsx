import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { loginSchema, registerSchema } from '@/utils/validation';

export function AuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { login, register, isLoading, consumeRecoveryCode } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    try {
      if (mode === 'login') {
        const result = loginSchema.safeParse({ username, password });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((e) => {
            if (e.path[0]) fieldErrors[String(e.path[0])] = e.message;
          });
          setErrors(fieldErrors);
          return;
        }
        setErrors({});
        await login(username, password);
        navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] });
      } else {
        const result = registerSchema.safeParse({ username, password, birthDate });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((e) => {
            if (e.path[0]) fieldErrors[String(e.path[0])] = e.message;
          });
          setErrors(fieldErrors);
          return;
        }
        setErrors({});
        await register(username, password, birthDate);
        const recoveryCode = consumeRecoveryCode();
        if (recoveryCode) {
          navigation.replace('RecoveryCode', { code: recoveryCode });
          return;
        }
        navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] });
      }
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'İşlem başarısız');
    }
  };

  return (
    <ScreenContainer keyboard>
      <View style={styles.container}>
        <Logo size="md" />
        <Text style={styles.title}>{mode === 'login' ? 'Geri dön' : 'Hesabını Oluştur'}</Text>
        <Text style={styles.sub}>
          {mode === 'login'
            ? 'Kullanıcı adı ve şifre ile giriş yap.'
            : 'Kullanıcı adı, şifre ve doğum tarihi ile 10 saniyede başla.'}
        </Text>

        <Input
          label="Kullanıcı Adı"
          value={username}
          onChangeText={setUsername}
          placeholder="ornek_kullanici"
          autoCapitalize="none"
          error={errors.username}
        />
        <Input label="Şifre" value={password} onChangeText={setPassword} placeholder="Şifren" isPassword error={errors.password} />
        {mode === 'register' ? (
          <Input
            label="Doğum Tarihi (YYYY-MM-DD)"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="2000-01-31"
            error={errors.birthDate}
          />
        ) : null}

        <Button title={mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'} onPress={handleSubmit} loading={isLoading} />

        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={styles.switch}>
            {mode === 'login' ? 'Hesabın yok mu? Hesap oluştur' : 'Zaten hesabın var mı? Giriş yap'}
          </Text>
        </TouchableOpacity>
        {mode === 'login' ? (
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.guest}>Şifremi Unuttum</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.lg, paddingTop: spacing['3xl'] },
  title: { ...typography.h1, color: colors.text },
  sub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  switch: { ...typography.body, color: colors.primary, textAlign: 'center' },
  guest: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
