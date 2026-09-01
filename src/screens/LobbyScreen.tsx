import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Button } from '@/components/ui/Button';
import { RoomCodeDisplay } from '@/components/room/RoomCodeDisplay';
import { PlayerCard } from '@/components/room/PlayerCard';
import { LobbyStateView } from '@/components/room/LobbyStateView';
import { ConfirmModal } from '@/components/room/ConfirmModal';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { shareRoom } from '@/services/sharing/room-share';
import { ROOM_CONFIG } from '@/domain/constants/room';
import { CONNECTION_STATE } from '@/domain/constants/enums';
import { isAppError } from '@/services/errors/app-error';
import { realtimeClient } from '@/services/realtime/realtime-client';
import { REALTIME_EVENTS } from '@/services/realtime/events';

export function LobbyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Lobby'>>();
  const user = useAuthStore((s) => s.user);

  const membership = useRoomStore((s) => s.membership);
  const uiState = useRoomStore((s) => s.uiState);
  const isConnected = useRoomStore((s) => s.isConnected);
  const error = useRoomStore((s) => s.error);
  const createRoom = useRoomStore((s) => s.createRoom);
  const setReady = useRoomStore((s) => s.setReady);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const kickPlayer = useRoomStore((s) => s.kickPlayer);
  const refreshRoom = useRoomStore((s) => s.refreshRoom);
  const clear = useRoomStore((s) => s.clear);

  const [kickTarget, setKickTarget] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (route.params?.action === 'create' && !membership && !creating) {
      void (async () => {
        setCreating(true);
        try {
          if (!user?.id) {
            setActionError('Bu işlem için giriş yapmalısın');
            return;
          }
          await createRoom(user.id, user.name ?? user.username);
        } catch (e) {
          setActionError(isAppError(e) ? e.userMessage : 'Oda oluşturulamadı');
        } finally {
          setCreating(false);
        }
      })();
    }
  }, [route.params?.action, membership, creating, user, createRoom]);

  useEffect(() => {
    if (!membership) return;
    const unsub = realtimeClient.on(REALTIME_EVENTS.GAME_STARTED, (event) => {
      if (event.roomId !== membership.room.id) return;
      const gameId = (event.payload as { gameId?: string }).gameId;
      if (gameId && !membership.player.isHost) {
        navigation.replace('Game', { gameId });
      }
    });
    return unsub;
  }, [membership, navigation]);

  useEffect(() => {
    if (['room_expired', 'invalid_room', 'player_removed'].includes(uiState)) {
      const timer = setTimeout(() => {
        clear();
        navigation.replace('FriendRoom');
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [uiState, clear, navigation]);

  const room = membership?.room;
  const player = membership?.player;
  const isHost = player?.isHost ?? false;

  const activePlayers = room?.players.filter((p) => p.connectionState === CONNECTION_STATE.CONNECTED) ?? [];
  const readyCount = activePlayers.filter((p) => p.isReady).length;
  const canStart =
    isHost &&
    activePlayers.length >= ROOM_CONFIG.MIN_PLAYERS &&
    (!ROOM_CONFIG.REQUIRE_ALL_READY || activePlayers.every((p) => p.isReady));

  const handleLeave = async () => {
    await leaveRoom();
    navigation.replace('FriendRoom');
  };

  const handleStart = () => {
    if (!canStart) return;
    navigation.navigate('CategorySelect');
  };

  const handleKick = async () => {
    if (!kickTarget) return;
    await kickPlayer(kickTarget);
    setKickTarget(null);
  };

  if (!room || !player) {
    return (
      <ScreenContainer scroll={false}>
        <LobbyStateView state={creating || uiState === 'loading' ? 'loading' : uiState} onRetry={refreshRoom} />
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Button
            title=""
            onPress={handleLeave}
            variant="ghost"
            icon={<Ionicons name="arrow-back" size={24} color={colors.text} />}
            fullWidth={false}
            style={styles.back}
          />
          <View style={styles.badges}>
            {room.isPremiumRoom ? (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>👑 Premium Oda</Text>
              </View>
            ) : null}
            <View style={[styles.connBadge, !isConnected && styles.connOff]}>
              <Ionicons name={isConnected ? 'wifi' : 'cloud-offline-outline'} size={14} color={colors.text} />
              <Text style={styles.connText}>{isConnected ? 'Bağlı' : 'Yenileniyor'}</Text>
            </View>
          </View>
        </View>

        <LobbyStateView state={uiState} onRetry={refreshRoom} />

        <RoomCodeDisplay code={room.code} />

        <View style={styles.shareRow}>
          <Button title="Paylaş" onPress={() => shareRoom(room.code)} variant="outline" fullWidth={false} style={styles.shareBtn} />
        </View>

        <View style={styles.playerHeader}>
          <Text style={styles.sectionTitle}>
            Oyuncular ({activePlayers.length}/{room.maxPlayers})
          </Text>
          <Text style={styles.readyInfo}>{readyCount}/{activePlayers.length} hazır</Text>
        </View>

        {room.players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            isCurrentUser={p.id === player.id}
            showKick={isHost && p.id !== player.id}
            onKick={() => setKickTarget(p.id)}
          />
        ))}

        {!room.isPremiumRoom ? (
          <View style={styles.lockedCategory}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
            <Text style={styles.lockedText}>Premium kategoriler host premium ise açılır</Text>
          </View>
        ) : null}

        {actionError || error ? <Text style={styles.error}>{actionError || error}</Text> : null}

        <View style={styles.footer}>
          {!isHost ? (
            <Button
              title={player.isReady ? 'Hazır Değilim' : 'Hazırım'}
              onPress={() => setReady(!player.isReady)}
              variant={player.isReady ? 'secondary' : 'primary'}
            />
          ) : (
            <Button
              title="Kategori Seç"
              onPress={handleStart}
              disabled={!canStart}
            />
          )}
          <Button title="Odadan Ayrıl" onPress={handleLeave} variant="ghost" />
        </View>
      </ScrollView>

      <ConfirmModal
        visible={!!kickTarget}
        title="Oyuncuyu Çıkar"
        message="Bu oyuncuyu odadan çıkarmak istediğine emin misin?"
        confirmLabel="Çıkar"
        destructive
        onConfirm={handleKick}
        onCancel={() => setKickTarget(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing['3xl'], gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  back: { minWidth: 44, minHeight: 44 },
  badges: { gap: spacing.sm, alignItems: 'flex-end' },
  premiumBadge: { backgroundColor: colors.premium, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  premiumText: { ...typography.small, color: colors.text, fontWeight: '600' },
  connBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success + '33', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  connOff: { backgroundColor: colors.warning + '33' },
  connText: { ...typography.small, color: colors.text },
  shareRow: { alignItems: 'center' },
  shareBtn: { minWidth: 120 },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...typography.h3, color: colors.text },
  readyInfo: { ...typography.caption, color: colors.textSecondary },
  lockedCategory: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12 },
  lockedText: { ...typography.caption, color: colors.textMuted },
  footer: { gap: spacing.md, marginTop: spacing.lg },
  error: { ...typography.small, color: colors.error, textAlign: 'center' },
});
