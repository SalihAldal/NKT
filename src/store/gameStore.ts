import { create } from 'zustand';
import type { PlayerGameView } from '@/domain/models/game';
import { gameService } from '@/services/game/game.service';
import { isAppError } from '@/services/errors/app-error';
import { analytics } from '@/services/analytics';

interface GamePlayerCtx {
  playerId: string;
  sessionToken: string;
  roomId: string;
}

interface GameStore {
  view: PlayerGameView | null;
  gameId: string | null;
  playerCtx: GamePlayerCtx | null;
  isSyncing: boolean;
  error: string | null;
  unsubscribe: (() => void) | null;

  initGame: (gameId: string, playerCtx: GamePlayerCtx) => Promise<void>;
  refresh: () => Promise<void>;
  submitAnswer: (matchId: string, answer: string) => Promise<void>;
  resume: (playerCtx: GamePlayerCtx) => Promise<boolean>;
  subscribe: () => void;
  clear: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  view: null,
  gameId: null,
  playerCtx: null,
  isSyncing: false,
  error: null,
  unsubscribe: null,

  initGame: async (gameId, playerCtx) => {
    set({ isSyncing: true, gameId, playerCtx, error: null });
    try {
      const view = await gameService.getPlayerView({
        gameId,
        playerId: playerCtx.playerId,
        sessionToken: playerCtx.sessionToken,
      });
      set({ view, isSyncing: false });
      get().subscribe();
    } catch (e) {
      set({ isSyncing: false, error: isAppError(e) ? e.userMessage : 'Oyun yüklenemedi' });
    }
  },

  refresh: async () => {
    const { gameId, playerCtx } = get();
    if (!gameId || !playerCtx) return;
    try {
      const view = await gameService.getPlayerView({
        gameId,
        playerId: playerCtx.playerId,
        sessionToken: playerCtx.sessionToken,
      });
      set({ view });
    } catch (e) {
      if (isAppError(e)) set({ error: e.userMessage });
    }
  },

  submitAnswer: async (matchId, answer) => {
    const { gameId, playerCtx } = get();
    if (!gameId || !playerCtx) return;
    set({ isSyncing: true });
    analytics.track({ name: 'answer_submitted', params: { roomId: playerCtx.roomId, matchId } });
    const view = await gameService.submitAnswer(
      { gameId, playerId: playerCtx.playerId, sessionToken: playerCtx.sessionToken },
      matchId,
      answer,
    );
    set({ view, isSyncing: false });
  },

  resume: async (playerCtx) => {
    set({ isSyncing: true, playerCtx });
    const { analytics } = await import('@/services/analytics');
    analytics.track({ name: 'game_resumed', params: { roomId: playerCtx.roomId } });
    const view = await gameService.resumeGame(playerCtx.roomId, playerCtx);
    if (!view) { set({ isSyncing: false }); return false; }
    set({ view, gameId: view.gameId, isSyncing: false });
    get().subscribe();
    return true;
  },

  subscribe: () => {
    const { playerCtx } = get();
    if (!playerCtx) return;
    get().unsubscribe?.();
    const unsub = gameService.subscribeToGame(playerCtx.roomId, () => { void get().refresh(); });
    set({ unsubscribe: unsub });
  },

  clear: () => {
    get().unsubscribe?.();
    set({ view: null, gameId: null, playerCtx: null, isSyncing: false, error: null, unsubscribe: null });
  },
}));
