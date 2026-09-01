import { create } from 'zustand';
import type { GameRoom, RoomPlayer } from '@/domain/models/game';
import type { RoomActionContext } from '@/api/contracts/room.api';
import type { LobbyUiState } from '@/domain/constants/room';
import { ROOM_CONFIG } from '@/domain/constants/room';
import { CONNECTION_STATE } from '@/domain/constants/enums';
import { roomService } from '@/services/room/room.service';
import { realtimeClient } from '@/services/realtime/realtime-client';
import { REALTIME_EVENTS } from '@/services/realtime/events';
import { AppState, type AppStateStatus } from 'react-native';
import { isAppError } from '@/services/errors/app-error';

interface RoomMembership {
  room: GameRoom;
  player: RoomPlayer;
  sessionToken: string;
}

interface RoomStore {
  membership: RoomMembership | null;
  uiState: LobbyUiState;
  error: string | null;
  isConnected: boolean;
  unsubscribe: (() => void) | null;

  createRoom: (hostUserId: string, hostDisplayName: string, avatarEmoji?: string) => Promise<void>;
  joinRoom: (code: string, displayName: string, userId?: string, avatarEmoji?: string) => Promise<void>;
  refreshRoom: () => Promise<void>;
  setReady: (isReady: boolean) => Promise<void>;
  startGame: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  subscribeRealtime: () => void;
  handleAppState: (state: AppStateStatus) => void;
  setUiState: (state: LobbyUiState) => void;
  clear: () => void;
}

const ctx = (m: RoomMembership): RoomActionContext => ({
  roomId: m.room.id,
  playerId: m.player.id,
  sessionToken: m.sessionToken,
});

const deriveUiState = (room: GameRoom, player: RoomPlayer, connected: boolean): LobbyUiState => {
  if (!connected) return 'disconnected';
  const active = room.players.filter((p) => p.connectionState === CONNECTION_STATE.CONNECTED);
  if (active.length === 0) return 'empty';
  const allReady = active.every((p) => p.isReady);
  if (allReady && active.length >= ROOM_CONFIG.MIN_PLAYERS) return 'ready';
  return 'waiting';
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  membership: null,
  uiState: 'loading',
  error: null,
  isConnected: false,
  unsubscribe: null,

  createRoom: async (hostUserId, hostDisplayName, avatarEmoji) => {
    set({ uiState: 'loading', error: null });
    try {
      const result = await roomService.createRoom(hostUserId, hostDisplayName, avatarEmoji);
      set({
        membership: { room: result.room, player: result.player, sessionToken: result.player.sessionToken },
        uiState: deriveUiState(result.room, result.player, true),
        isConnected: true,
      });
      get().subscribeRealtime();
    } catch (e) {
      set({ uiState: 'network_error', error: isAppError(e) ? e.userMessage : 'Oda oluşturulamadı' });
      throw e;
    }
  },

  joinRoom: async (code, displayName, userId, avatarEmoji) => {
    set({ uiState: 'loading', error: null });
    try {
      const result = await roomService.joinRoom(code, displayName, userId, avatarEmoji);
      set({
        membership: { room: result.room, player: result.player, sessionToken: result.player.sessionToken },
        uiState: deriveUiState(result.room, result.player, true),
        isConnected: true,
      });
      get().subscribeRealtime();
    } catch (e) {
      const msg = isAppError(e) ? e.userMessage : 'Odaya katılınamadı';
      const uiState: LobbyUiState =
        isAppError(e) && e.code === 'ROOM_NOT_FOUND' ? 'invalid_room'
        : isAppError(e) && e.code === 'ROOM_FULL' ? 'room_full'
        : isAppError(e) && e.code === 'ROOM_EXPIRED' ? 'room_expired'
        : isAppError(e) && e.code === 'PLAYER_REMOVED' ? 'player_removed'
        : 'network_error';
      set({ uiState, error: msg });
      throw e;
    }
  },

  refreshRoom: async () => {
    const { membership } = get();
    if (!membership) return;
    try {
      const room = await roomService.getRoomState(ctx(membership));
      const player = room.players.find((p) => p.id === membership.player.id) ?? membership.player;
      set({
        membership: { room, player, sessionToken: membership.sessionToken },
        uiState: deriveUiState(room, player, get().isConnected),
      });
    } catch (e) {
      if (isAppError(e) && (e.code === 'PLAYER_REMOVED' || e.code === 'ROOM_EXPIRED')) {
        set({ uiState: e.code === 'PLAYER_REMOVED' ? 'player_removed' : 'room_expired', error: e.userMessage });
      }
    }
  },

  setReady: async (isReady) => {
    const { membership } = get();
    if (!membership) return;
    const room = await roomService.setReady(ctx(membership), isReady);
    const player = room.players.find((p) => p.id === membership.player.id) ?? membership.player;
    set({
      membership: { room, player, sessionToken: membership.sessionToken },
      uiState: deriveUiState(room, player, true),
    });
  },

  startGame: async () => {
    const { membership } = get();
    if (!membership) return;
    set({ uiState: 'host_starting' });
    const room = await roomService.startGame(ctx(membership));
    set({
      membership: { ...membership, room },
      uiState: 'ready',
    });
  },

  leaveRoom: async () => {
    const { membership, unsubscribe } = get();
    if (membership) {
      try { await roomService.leave(ctx(membership)); } catch { /* ignore */ }
      await realtimeClient.leaveRoom(membership.room.id);
    }
    unsubscribe?.();
    set({ membership: null, uiState: 'loading', isConnected: false, unsubscribe: null });
  },

  kickPlayer: async (playerId) => {
    const { membership } = get();
    if (!membership) return;
    const room = await roomService.kickPlayer(ctx(membership), playerId);
    set({ membership: { ...membership, room } });
  },

  subscribeRealtime: () => {
    const { membership, unsubscribe } = get();
    if (!membership) return;
    unsubscribe?.();

    const unsubs = [
      realtimeClient.on(REALTIME_EVENTS.ROOM_UPDATED, (event) => {
        if (event.roomId !== membership.room.id) return;
        const room = event.payload.room;
        const player = room.players.find((p) => p.id === membership.player.id);
        if (!player && membership.player.isHost === false) {
          set({ uiState: 'player_removed', error: 'Odadan çıkarıldın.' });
          return;
        }
        if (player) {
          set({
            membership: { room, player, sessionToken: membership.sessionToken },
            uiState: deriveUiState(room, player, get().isConnected),
          });
        } else {
          set({ membership: { ...membership, room } });
        }
      }),
      realtimeClient.on(REALTIME_EVENTS.ROOM_JOINED, (event) => {
        if (event.roomId !== membership.room.id) return;
        if (membership.player.isHost && event.payload.player.id !== membership.player.id) {
          import('@/services/notifications').then(({ notificationService }) => {
            notificationService.scheduleLocal(
              'Yeni oyuncu!',
              `${event.payload.player.displayName} odaya katıldı`,
              { type: 'friend_joined_room', code: membership.room.code, roomId: membership.room.id },
            );
          });
        }
      }),
      realtimeClient.on(REALTIME_EVENTS.HOST_CHANGED, (event) => {
        if (event.roomId !== membership.room.id) return;
        get().refreshRoom();
      }),
      realtimeClient.on(REALTIME_EVENTS.ROOM_CLOSED, (event) => {
        if (event.roomId !== membership.room.id) return;
        analyticsTrackClosed();
        set({ uiState: 'room_expired', error: 'Oda kapatıldı.' });
      }),
    ];

    set({ isConnected: true, unsubscribe: () => unsubs.forEach((u) => u()) });
  },

  handleAppState: (state) => {
    const { membership } = get();
    if (!membership) return;
    if (state === 'active') {
      void realtimeClient.connect()
        .then(() => realtimeClient.joinRoom(membership.room.id, membership.sessionToken))
        .catch(() => undefined);
      set({ isConnected: true });
      roomService.reconnect(ctx(membership)).then((room) => {
        const player = room.players.find((p) => p.id === membership.player.id) ?? membership.player;
        set({
          membership: { room, player, sessionToken: membership.sessionToken },
          uiState: deriveUiState(room, player, true),
        });
      }).catch(() => set({ uiState: 'disconnected', isConnected: false }));
    } else if (state === 'background') {
      set({ isConnected: false, uiState: 'disconnected' });
    }
  },

  setUiState: (uiState) => set({ uiState }),
  clear: () => {
    get().unsubscribe?.();
    set({ membership: null, uiState: 'loading', error: null, isConnected: false, unsubscribe: null });
  },
}));

function analyticsTrackClosed() {
  import('@/services/analytics').then(({ analytics }) => {
    analytics.track({ name: 'room_closed', params: {} });
  });
}

AppState.addEventListener('change', (state) => {
  useRoomStore.getState().handleAppState(state);
});
