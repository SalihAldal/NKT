import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/theme';
import type { FinalGameStats } from '@/domain/models/game';
import { AnimalAvatar } from '@/components/room/AnimalAvatar';

interface GameFinalViewProps {
  stats: FinalGameStats[];
  categoryName?: string;
  onRematch: () => void;
  onNewCategory: () => void;
  onShare: () => void;
  onLobby: () => void;
  isHost: boolean;
}

export function GameFinalView({
  stats,
  categoryName,
  onRematch,
  onNewCategory,
  onShare,
  onLobby,
  isHost,
}: GameFinalViewProps) {
  const podium = stats.slice(0, 3);
  const rest = stats.slice(3);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Oyun Bitti! 🎉</Text>
      {categoryName ? <Text style={styles.cat}>{categoryName}</Text> : null}

      <View style={styles.podium}>
        {podium.map((p, i) => (
          <View key={p.playerId} style={[styles.podiumItem, i === 0 && styles.first]}>
            <Text style={styles.medal}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</Text>
            <AnimalAvatar avatarId={p.avatarEmoji} size={24} />
            <Text style={styles.name} numberOfLines={1}>{p.displayName}</Text>
            <Text style={styles.score}>{p.score} puan</Text>
            <Text style={styles.meta}>{p.correctCount} doğru · {(p.avgResponseMs / 1000).toFixed(1)}s ort.</Text>
          </View>
        ))}
      </View>

      {rest.map((p) => (
        <View key={p.playerId} style={styles.row}>
          <Text style={styles.rank}>{p.rank}.</Text>
          <Text style={styles.rowName}>{p.displayName}</Text>
          <Text style={styles.rowScore}>{p.score}</Text>
        </View>
      ))}

      <View style={styles.ctas}>
        {isHost ? <Button title="Tekrar Oyna" onPress={onRematch} /> : null}
        {isHost ? <Button title="Başka Kategori" onPress={onNewCategory} variant="outline" /> : null}
        <Button title="Sonuçları Paylaş" onPress={onShare} variant="outline" />
        <Button title="Odaya Dön" onPress={onLobby} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  cat: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.md, marginVertical: spacing.lg },
  podiumItem: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, padding: spacing.md, flex: 1, gap: 4 },
  first: { transform: [{ scale: 1.05 }], borderWidth: 1, borderColor: colors.premiumGold + '66' },
  medal: { fontSize: 28 },
  name: { ...typography.label, color: colors.text },
  score: { ...typography.h3, color: colors.primary },
  meta: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  rank: { width: 24, color: colors.textMuted },
  rowName: { ...typography.body, color: colors.text, flex: 1 },
  rowScore: { ...typography.label, color: colors.primary },
  ctas: { gap: spacing.sm, marginTop: spacing.lg },
});
