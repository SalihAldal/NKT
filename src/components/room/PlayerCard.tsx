import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomPlayer } from '@/domain/models/game';
import { CONNECTION_STATE } from '@/domain/constants/enums';
import { colors, radii, spacing, typography } from '@/theme';
import { AnimalAvatar } from '@/components/room/AnimalAvatar';

interface PlayerCardProps {
  player: RoomPlayer;
  isCurrentUser?: boolean;
  onKick?: () => void;
  showKick?: boolean;
}

export function PlayerCard({ player, isCurrentUser, onKick, showKick }: PlayerCardProps) {
  const disconnected = player.connectionState === CONNECTION_STATE.DISCONNECTED;

  return (
    <View
      style={[styles.card, isCurrentUser && styles.currentUser]}
      accessibilityLabel={`${player.displayName}${player.isHost ? ', host' : ''}${player.isReady ? ', hazır' : ''}`}
    >
      <View style={styles.avatar}>
        <AnimalAvatar avatarId={player.avatarEmoji} size={24} />
        {disconnected ? (
          <View style={styles.disconnectedBadge}>
            <Ionicons name="cloud-offline-outline" size={10} color={colors.text} />
          </View>
        ) : null}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {player.displayName}
            {isCurrentUser ? ' (Sen)' : ''}
          </Text>
          {player.isHost ? (
            <View style={styles.hostBadge}>
              <Text style={styles.hostText}>Host</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.status, player.isReady && styles.ready]}>
          {disconnected ? 'Bağlantı kesildi' : player.isReady ? 'Hazır ✓' : 'Bekliyor...'}
        </Text>
      </View>
      {showKick && !player.isHost ? (
        <TouchableOpacity
          onPress={onKick}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`${player.displayName} oyuncusunu çıkar`}
        >
          <Ionicons name="close-circle-outline" size={24} color={colors.error} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  currentUser: { borderColor: colors.primary },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  disconnectedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.warning,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { ...typography.label, color: colors.text, flexShrink: 1 },
  hostBadge: { backgroundColor: colors.primary, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  hostText: { ...typography.small, color: colors.text, fontWeight: '600' },
  status: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  ready: { color: colors.success },
});
