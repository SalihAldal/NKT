import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography, radii } from '@/theme';
import { useSettingsStore } from '@/store/settingsStore';
import { analytics } from '@/services/analytics';

const LANGUAGES = [
  { code: 'tr' as const, label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en' as const, label: 'English', flag: '🇬🇧' },
];

export function LanguageSettingsScreen() {
  const { settings, update } = useSettingsStore();

  return (
    <View style={styles.wrapper}>
      <Header title="Dil" />
      <ScreenContainer>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.row, settings.language === lang.code && styles.rowActive]}
            onPress={() => {
              update({ language: lang.code });
              analytics.track({ name: 'language_changed', params: { language: lang.code } });
            }}
          >
            <Text style={styles.flag}>{lang.flag}</Text>
            <Text style={styles.label}>{lang.label}</Text>
            {settings.language === lang.code ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, marginBottom: spacing.sm, gap: spacing.md },
  rowActive: { borderWidth: 1, borderColor: colors.primary },
  flag: { fontSize: 24 },
  label: { ...typography.body, color: colors.text, flex: 1 },
  check: { ...typography.label, color: colors.primary },
});
