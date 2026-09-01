import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography } from '@/theme';
import { TERMS_OF_SERVICE_SECTIONS } from '@/content/legal/terms-of-service';
import { getLegalUrl } from '@config/release';

export function TermsOfServiceScreen() {
  const externalUrl = getLegalUrl('terms');

  return (
    <ScreenContainer>
      <Header title="Kullanım Koşulları" />
      <ScrollView contentContainerStyle={styles.content}>
        {externalUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(externalUrl)} accessibilityRole="link">
            <Text style={styles.link}>Tam metni web{"'"}de görüntüle →</Text>
          </TouchableOpacity>
        ) : null}
        {TERMS_OF_SERVICE_SECTIONS.map((s) => (
          <React.Fragment key={s.title}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </React.Fragment>
        ))}
        <Text style={styles.disclaimer}>
          Bu metin uygulama kullanım kurallarını açıklar. Mağaza yayını öncesi hukuk danışmanı tarafından gözden geçirilmelidir.
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
