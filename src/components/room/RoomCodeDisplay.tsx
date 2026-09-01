import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/theme';
import { copyRoomCode } from '@/services/sharing/room-share';

interface RoomCodeDisplayProps {
  code: string;
  onCopy?: () => void;
}

export function RoomCodeDisplay({ code, onCopy }: RoomCodeDisplayProps) {
  const handleCopy = async () => {
    await copyRoomCode(code);
    onCopy?.();
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleCopy}
      accessibilityRole="button"
      accessibilityLabel={`Oda kodu ${code.split('').join(' ')}. Kopyalamak için dokun`}
    >
      <Text style={styles.label}>Oda Kodu</Text>
      <View style={styles.codeRow}>
        <Text style={styles.code} accessibilityLabel={code}>
          {code.toUpperCase()}
        </Text>
        <Ionicons name="copy-outline" size={22} color={colors.primaryLight} />
      </View>
      <Text style={styles.hint}>Kopyalamak için dokun</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: { ...typography.caption, color: colors.textMuted },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  code: {
    ...typography.h1,
    color: colors.text,
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
  },
  hint: { ...typography.small, color: colors.textMuted },
});
