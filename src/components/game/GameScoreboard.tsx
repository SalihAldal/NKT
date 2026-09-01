import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import type { PlayerScoreEntry } from '@/domain/models/game';
import { AnimalAvatar } from '@/components/room/AnimalAvatar';

export function GameScoreboard({ scores }: { scores: PlayerScoreEntry[] }) {
  return (
    <View style={styles.board}>
      {scores.slice(0, 6).map((s) => (
        <View key={s.playerId} style={styles.row}>
          <Text style={styles.rank}>
            {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `${s.rank}.`}
          </Text>
          <AnimalAvatar avatarId={s.avatarEmoji} size={16} />
          <Text style={styles.name} numberOfLines={1}>{s.displayName}</Text>
          <Text style={styles.pts}>{s.score}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { width: 28, textAlign: 'center' },
  name: { ...typography.caption, color: colors.text, flex: 1 },
  pts: { ...typography.label, color: colors.primary },
});
