import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';
import { ANIMAL_AVATARS } from '@/domain/constants/animal-avatars';
import { AnimalAvatar } from '@/components/room/AnimalAvatar';

interface AvatarPickerProps {
  value: string;
  onChange: (avatarId: string) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Avatar Seç</Text>
      <View style={styles.grid}>
        {ANIMAL_AVATARS.map((avatar) => (
          <TouchableOpacity
            key={avatar.id}
            style={[styles.item, value === avatar.id && styles.selected]}
            onPress={() => onChange(avatar.id)}
            accessibilityRole="button"
            accessibilityLabel={`Avatar ${avatar.label}`}
            accessibilityState={{ selected: value === avatar.id }}
          >
            <AnimalAvatar avatarId={avatar.id} size={24} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.card },
});
