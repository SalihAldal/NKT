import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { colors, gradients, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

export function FriendRoomScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Button
        title=""
        onPress={() => navigation.goBack()}
        variant="ghost"
        icon={<Ionicons name="arrow-back" size={24} color={colors.text} />}
        style={styles.back}
        fullWidth={false}
      />

      <Text style={styles.title}>Arkadaş Ortamı</Text>
      <Text style={styles.subtitle}>
        Arkadaşlarınla gerçek zamanlı oyna. Oda oluştur veya koda katıl.
      </Text>

      <LinearGradient colors={[...gradients.primarySoft]} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.heroEmoji}>🎉</Text>
        <Text style={styles.heroTitle}>Arkadaşlarınla Oyna</Text>
        <Text style={styles.heroDesc}>Oda oluştur, kodu paylaş, kategori seç ve 30 soruluk partiye başla.</Text>
        <Button
          title="Oda Oluştur"
          onPress={() => navigation.navigate('Lobby', { action: 'create' })}
          fullWidth={false}
          style={styles.heroBtn}
        />
      </LinearGradient>

      <View style={styles.secondary}>
        <Text style={styles.secondaryEmoji}>🚪</Text>
        <Text style={styles.secondaryTitle}>Odaya Katıl</Text>
        <Text style={styles.secondaryDesc}>6 haneli oda kodunu gir ve lobiye katıl.</Text>
        <Button
          title="Odaya Katıl"
          onPress={() => navigation.navigate('JoinRoom')}
          variant="outline"
          fullWidth={false}
          style={styles.secondaryBtn}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: spacing.lg, minWidth: 44, minHeight: 44 },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing['2xl'] },
  hero: { borderRadius: 24, padding: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
  heroEmoji: { fontSize: 48 },
  heroTitle: { ...typography.h2, color: colors.text },
  heroDesc: { ...typography.body, color: colors.textSecondary },
  heroBtn: { marginTop: spacing.md, alignSelf: 'flex-start', minWidth: 160 },
  secondary: {
    borderRadius: 24, padding: spacing.xl, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.surfaceBorder, gap: spacing.sm,
  },
  secondaryEmoji: { fontSize: 40 },
  secondaryTitle: { ...typography.h3, color: colors.text },
  secondaryDesc: { ...typography.caption, color: colors.textSecondary },
  secondaryBtn: { marginTop: spacing.md, alignSelf: 'flex-start', minWidth: 140 },
});
