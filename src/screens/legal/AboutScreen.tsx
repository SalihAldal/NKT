import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography } from '@/theme';
import { env } from '@config/environment';
import { RELEASE_VERSION, BUILD_METADATA } from '@config/version';
import type { RootStackParamList } from '@/navigation/types';

export function AboutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.wrapper}>
      <Header title="Hakkında" />
      <ScreenContainer>
        <Text style={styles.logo}>NKT</Text>
        <Text style={styles.name}>{BUILD_METADATA.name}</Text>
        <Text style={styles.version}>Sürüm {RELEASE_VERSION.app} ({env.appEnv})</Text>
        <Text style={styles.desc}>Arkadaşlarınla quiz oluştur, oda aç ve ne kadar tanıdığınızı test edin.</Text>

        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('PrivacyPolicy')} accessibilityRole="button">
          <Text style={styles.linkText}>Gizlilik Politikası</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('TermsOfService')} accessibilityRole="button">
          <Text style={styles.linkText}>Kullanım Koşulları</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('OpenSourceLicenses')} accessibilityRole="button">
          <Text style={styles.linkText}>Açık Kaynak Lisansları</Text>
        </TouchableOpacity>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  logo: { fontSize: 48, fontWeight: '800', color: colors.primary, textAlign: 'center', marginTop: spacing.xl },
  name: { ...typography.h2, color: colors.text, textAlign: 'center' },
  version: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  desc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing['2xl'] },
  link: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  linkText: { ...typography.body, color: colors.primary },
});
