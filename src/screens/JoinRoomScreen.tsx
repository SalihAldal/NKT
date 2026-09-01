import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { validateRoomCode } from '@/services/security/validation';
import { isAppError } from '@/services/errors/app-error';

export function JoinRoomScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'JoinRoom'>>();
  const user = useAuthStore((s) => s.user);
  const joinRoom = useRoomStore((s) => s.joinRoom);

  const [code, setCode] = useState(route.params?.code?.toUpperCase() ?? '');
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    setError('');
    if (!displayName.trim()) {
      setError('İsim gerekli');
      return;
    }
    if (!validateRoomCode(code)) {
      setError('Geçerli 6 haneli kod gir');
      return;
    }

    setLoading(true);
    try {
      if (!user?.id) {
        setError('Bu işlem için giriş yapmalısın');
        return;
      }
      await joinRoom(code, displayName.trim(), user.id);
      navigation.replace('Lobby', {});
    } catch (e) {
      setError(isAppError(e) ? e.userMessage : 'Katılım başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer keyboard>
      <Button
        title=""
        onPress={() => navigation.goBack()}
        variant="ghost"
        icon={<Ionicons name="arrow-back" size={24} color={colors.text} />}
        style={styles.back}
        fullWidth={false}
      />

      <Text style={styles.title}>Odaya Katıl</Text>
      <Text style={styles.subtitle}>6 haneli kodu gir, odaya katıl.</Text>

      <View style={styles.form}>
        <Input
          label="Oda Kodu"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ABC123"
          maxLength={6}
          autoCapitalize="characters"
          accessibilityLabel="6 haneli oda kodu"
        />
        <Input
          label="Görünen İsim"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Adın"
          maxLength={20}
          autoCapitalize="words"
          accessibilityLabel="Görünen isim"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Katıl" onPress={handleJoin} loading={loading} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: spacing.lg, minWidth: 44, minHeight: 44 },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing['2xl'] },
  form: { gap: spacing.lg },
  error: { ...typography.small, color: colors.error },
});
