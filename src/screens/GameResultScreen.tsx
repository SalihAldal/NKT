import React, { useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { StateView } from '@/components/feedback/StateView';
import { useGameStore } from '@/store/gameStore';
import { useRoomStore } from '@/store/roomStore';
import type { RootStackParamList } from '@/navigation/types';
import { GameFinalView } from '@/components/game/GameFinalView';
import { apiServices } from '@/api/client';
import * as Sharing from 'expo-sharing';

export function GameResultScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameResult'>>();
  const membership = useRoomStore((s) => s.membership);
  const view = useGameStore((s) => s.view);
  const error = useGameStore((s) => s.error);
  const isSyncing = useGameStore((s) => s.isSyncing);
  const initGame = useGameStore((s) => s.initGame);
  const refresh = useGameStore((s) => s.refresh);
  const clear = useGameStore((s) => s.clear);

  useEffect(() => {
    if (!membership || !route.params.gameId) return;
    void initGame(route.params.gameId, {
      playerId: membership.player.id,
      sessionToken: membership.sessionToken,
      roomId: membership.room.id,
    });
  }, [membership, route.params.gameId, initGame]);

  if (error) {
    return (
      <ScreenContainer>
        <StateView type="error" title="Sonuçlar yüklenemedi" message={error} onRetry={() => void refresh()} />
      </ScreenContainer>
    );
  }

  if (isSyncing || (!view?.finalStats && !view?.scores.length)) {
    return <ScreenContainer><StateView type="loading" title="Sonuçlar yükleniyor..." /></ScreenContainer>;
  }

  const handleRematch = async () => {
    if (!membership) return;
    const ctx = { roomId: membership.room.id, playerId: membership.player.id, sessionToken: membership.sessionToken };
    clear();
    await apiServices.room.rematch(ctx);
    navigation.replace('CategorySelect');
  };

  return (
    <ScreenContainer>
      <GameFinalView
        stats={view.finalStats ?? view.scores.map((s) => ({
          playerId: s.playerId,
          displayName: s.displayName,
          avatarEmoji: s.avatarEmoji,
          score: s.score,
          rank: s.rank,
          correctCount: 0,
          challengeCompletions: 0,
          avgResponseMs: 0,
        }))}
        categoryName={view.categoryName}
        isHost={membership?.player.isHost ?? false}
        onRematch={handleRematch}
        onNewCategory={() => { clear(); navigation.replace('CategorySelect'); }}
        onShare={async () => {
          const lines = (view.finalStats ?? []).map((s) => `${s.rank}. ${s.displayName}: ${s.score}`).join('\n');
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(`NKT Sonuç 🎉\n${lines}`);
        }}
        onLobby={() => { clear(); navigation.replace('Lobby', {}); }}
      />
    </ScreenContainer>
  );
}
