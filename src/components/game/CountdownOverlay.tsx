import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/theme';

export function CountdownOverlay({ seconds }: { seconds: number }) {
  const label = seconds <= 0 ? 'GO!' : String(seconds);
  return (
    <View style={styles.wrap}>
      <Text style={styles.count} accessibilityLabel={`Geri sayım ${label}`}>{label}</Text>
      <Text style={styles.sub}>Oyun başlıyor...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 96, fontWeight: '800', color: colors.primary },
  sub: { ...typography.body, color: colors.textSecondary, marginTop: 16 },
});
