import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Header } from '@/components/layout/Header';
import { colors, spacing, typography } from '@/theme';
import { OPEN_SOURCE_LICENSES } from '@/content/legal/open-source-licenses';

export function OpenSourceLicensesScreen() {
  return (
    <ScreenContainer>
      <Header title="Açık Kaynak Lisansları" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>NKT aşağıdaki açık kaynak projeleri kullanır:</Text>
        {OPEN_SOURCE_LICENSES.map((lib) => (
          <TouchableOpacity key={lib.name} style={styles.row} onPress={() => Linking.openURL(lib.url)} accessibilityRole="link">
            <Text style={styles.name}>{lib.name}</Text>
            <Text style={styles.license}>{lib.license}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  name: { ...typography.body, color: colors.text },
  license: { ...typography.caption, color: colors.textMuted },
});
