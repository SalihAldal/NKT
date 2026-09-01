import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, Linking, View } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography } from '@/theme';
import { PRIVACY_POLICY_SECTIONS } from '@/content/legal/privacy-policy';
import { getLegalUrl } from '@config/release';

export function PrivacyPolicyScreen() {
  const externalUrl = getLegalUrl('privacy');

  return (
    <ScreenContainer>
      <Header title="Gizlilik Politikası" />
      <ScrollView contentContainerStyle={styles.content}>
        {externalUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(externalUrl)} accessibilityRole="link">
            <Text style={styles.link}>Tam metni web{"'"}de görüntüle →</Text>
          </TouchableOpacity>
        ) : null}
        {PRIVACY_POLICY_SECTIONS.map((s) => (
          <View key={s.title}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.disclaimer}>
          Bu metin uygulamanın veri işleme davranışını açıklar. Mağaza yayını öncesi hukuk danışmanı tarafından gözden geçirilmelidir.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  link: { ...typography.body, color: colors.primary, marginBottom: spacing.md },
  disclaimer: { ...typography.small, color: colors.textMuted, marginTop: spacing.xl, fontStyle: 'italic' },
});
