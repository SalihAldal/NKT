import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { getAnimalAvatar } from '@/domain/constants/animal-avatars';

interface AnimalAvatarProps {
  avatarId?: string;
  size?: number;
}

export function AnimalAvatar({ avatarId, size = 22 }: AnimalAvatarProps) {
  const avatar = getAnimalAvatar(avatarId);

  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons
        name={avatar.icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={size}
        color={avatar.color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
  },
});
