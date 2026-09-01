import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import type { RootStackParamList } from '@/navigation/types';
import { colors, spacing, typography } from '@/theme';

export function RecoveryCodeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RecoveryCode'>>();
  const code = route.params.code;

  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Kopyalandı', 'Kurtarma kodu panoya kopyalandı.');
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Hesabını Kurtarma Kodu</Text>
        <Text style={styles.description}>Bu kodu güvenli bir yerde sakla. Tekrar düz metin olarak gösterilmez.</Text>

        <View style={styles.codeCard}>
          <Text style={styles.code}>{code}</Text>
        </View>

        <TouchableOpacity onPress={copyCode}>
          <Text style={styles.copy}>Kodu Kopyala</Text>
        </TouchableOpacity>

        <Button title="Devam Et" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] })} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  codeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  code: {
    ...typography.h2,
    color: colors.highlight,
    textAlign: 'center',
    letterSpacing: 2,
  },
  copy: { ...typography.bodyMedium, color: colors.primary, textAlign: 'center' },
});
