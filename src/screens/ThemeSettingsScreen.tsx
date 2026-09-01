import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography, radii } from '@/theme';
import { useSettingsStore } from '@/store/settingsStore';
import { analytics } from '@/services/analytics';

const THEMES = [
  { code: 'dark' as const, label: 'Koyu', icon: '🌙' },
  { code: 'system' as const, label: 'Sistem', icon: '⚙️' },
];

export function ThemeSettingsScreen() {
  const { settings, update } = useSettingsStore();

  return (
    <View style={styles.wrapper}>
      <Header title="Tema" />
      <ScreenContainer>
        {THEMES.map((theme) => (
          <TouchableOpacity
            key={theme.code}
            style={[styles.row, settings.theme === theme.code && styles.rowActive]}
            onPress={() => {
              update({ theme: theme.code });
              analytics.track({ name: 'theme_changed', params: { theme: theme.code } });
            }}
          >
            <Text style={styles.icon}>{theme.icon}</Text>
            <Text style={styles.label}>{theme.label}</Text>
            {settings.theme === theme.code ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
        ))}
        <Text style={styles.note}>NKT premium dark tasarım dili korunur.</Text>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, marginBottom: spacing.sm, gap: spacing.md },
  rowActive: { borderWidth: 1, borderColor: colors.primary },
  icon: { fontSize: 24 },
  label: { ...typography.body, color: colors.text, flex: 1 },
  check: { ...typography.label, color: colors.primary },
  note: { ...typography.small, color: colors.textMuted, marginTop: spacing.xl, textAlign: 'center' },
});
