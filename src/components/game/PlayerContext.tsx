import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { AnimalAvatar } from '@/components/room/AnimalAvatar';

interface PlayerContextProps {
  name: string;
  avatar?: string;
  role: 'asker' | 'responder' | 'observer' | 'bye';
  label?: string;
}

export function PlayerContext({ name, avatar, role, label }: PlayerContextProps) {
  const roleLabel = label ?? (role === 'asker' ? 'Soran' : role === 'responder' ? 'Cevaplayan' : '');
  return (
    <View style={styles.wrap}>
      <AnimalAvatar avatarId={avatar} size={36} />
      <View style={styles.info}>
        {roleLabel ? <Text style={styles.role}>{roleLabel}</Text> : null}
        <Text style={styles.name}>{name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1 },
  role: { ...typography.small, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  name: { ...typography.h3, color: colors.text },
});
