import { io, type Socket } from 'socket.io-client';
import { env } from '@config/environment';
import { secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';
import { logger } from '@/utils/logger';
import { REALTIME_EVENTS } from './events';
import type {
  RealtimeClient,
  RealtimeConnectionState,
  RealtimeEventBus,
  RealtimeEventHandler,
  RealtimeEventMap,
  RealtimeEventType,
  RealtimeSocketError,
} from './events';

const CONNECT_TIMEOUT_MS = 12_000;
const ALL_EVENTS = Object.values(REALTIME_EVENTS) as RealtimeEventType[];

export class SocketIORealtimeClient implements RealtimeClient {
  private socket: Socket | null = null;
  private connected = false;
  private connectionState: RealtimeConnectionState = 'disconnected';
  private readonly stateHandlers = new Set<(state: RealtimeConnectionState) => void>();
  private readonly errorHandlers = new Set<(error: RealtimeSocketError) => void>();
  private readonly roomMemberships = new Map<string, string>();
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly bus: RealtimeEventBus) {}

  private setConnectionState(state: RealtimeConnectionState) {
    this.connectionState = state;
    this.connected = state === 'connected';
    this.stateHandlers.forEach((h) => {
      try { h(state); } catch (e) { logger.error('Connection state handler error', e); }
    });
  }

  private emitError(error: RealtimeSocketError) {
    this.errorHandlers.forEach((h) => {
      try { h(error); } catch (e) { logger.error('Realtime error handler error', e); }
    });
  }

  private attachSocketListeners(socket: Socket) {
    socket.on('connect', () => {
      this.setConnectionState('connected');
      logger.debug('Socket.IO connected');
      for (const [roomId, sessionToken] of this.roomMemberships) {
        socket.emit('join:room', { roomId, sessionToken });
      }
    });

    socket.io.on('reconnect_attempt', () => this.setConnectionState('reconnecting'));
    socket.io.on('reconnect', () => this.setConnectionState('connected'));
    socket.io.on('reconnect_failed', () => {
      this.setConnectionState('disconnected');
      this.emitError({ code: 'SERVER_ERROR', message: 'Realtime yeniden bağlanılamadı' });
    });

    socket.on('disconnect', (reason) => {
      logger.debug('Socket.IO disconnected', reason);
      if (reason === 'io server disconnect') {
        this.setConnectionState('disconnected');
      } else {
        this.setConnectionState('reconnecting');
      }
    });

    socket.on('connect_error', (err) => {
      logger.warn('Socket.IO connect_error', err.message);
      this.emitError({ code: 'SERVER_ERROR', message: 'Realtime bağlantı hatası' });
    });

    socket.on('error', (payload: RealtimeSocketError) => {
      this.emitError(payload);
    });

    for (const eventName of ALL_EVENTS) {
      socket.on(eventName, (payload: RealtimeEventMap[typeof eventName]) => {
        const roomId = this.resolveRoomId(eventName, payload);
        this.bus.publish({
          type: eventName,
          payload,
          timestamp: new Date().toISOString(),
          roomId,
        });
      });
    }
  }

  private resolveRoomId<T extends RealtimeEventType>(
    type: T,
    payload: RealtimeEventMap[T],
  ): string | undefined {
    if (payload && typeof payload === 'object') {
      if ('room' in payload && payload.room && typeof payload.room === 'object' && 'id' in payload.room) {
        return String((payload.room as { id: string }).id);
      }
      if ('roomId' in payload) return String((payload as { roomId: string }).roomId);
    }
    return undefined;
  }

  async connect(token?: string): Promise<void> {
    if (this.socket?.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      this.setConnectionState('connecting');
      const authToken = token ?? (await secureStorage.get(STORAGE_KEYS.authToken));
      if (!authToken) {
        this.setConnectionState('disconnected');
        this.emitError({ code: 'UNAUTHORIZED', message: 'Oturum gerekli' });
        throw new Error('UNAUTHORIZED');
      }

      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      const socket = io(env.realtimeUrl, {
        auth: { token: authToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: CONNECT_TIMEOUT_MS,
        autoConnect: true,
      });

      this.socket = socket;
      this.attachSocketListeners(socket);

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('REALTIME_TIMEOUT'));
        }, CONNECT_TIMEOUT_MS);

        const onConnect = () => { cleanup(); resolve(); };
        const onError = () => {
          cleanup();
          reject(new Error('REALTIME_CONNECT_FAILED'));
        };

        const cleanup = () => {
          clearTimeout(timer);
          socket.off('connect', onConnect);
          socket.off('connect_error', onError);
        };

        if (socket.connected) { cleanup(); resolve(); return; }
        socket.once('connect', onConnect);
        socket.once('connect_error', onError);
      });
    })().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  async disconnect(): Promise<void> {
    this.roomMemberships.clear();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setConnectionState('disconnected');
  }

  isConnected(): boolean {
    return this.connected && Boolean(this.socket?.connected);
  }

  getConnectionState(): RealtimeConnectionState {
    return this.connectionState;
  }

  onConnectionState(handler: (state: RealtimeConnectionState) => void): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  onError(handler: (error: RealtimeSocketError) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  async joinRoom(roomId: string, sessionToken?: string): Promise<void> {
    if (!sessionToken) throw new Error('sessionToken required for joinRoom');
    this.roomMemberships.set(roomId, sessionToken);
    if (!this.socket?.connected) await this.connect();
    await new Promise<void>((resolve, reject) => {
      if (!this.socket) { reject(new Error('Socket not initialized')); return; }
      this.socket.emit('join:room', { roomId, sessionToken }, (ack?: { ok?: boolean; error?: RealtimeSocketError }) => {
        if (ack?.error) {
          this.emitError(ack.error);
          reject(new Error(ack.error.code));
          return;
        }
        resolve();
      });
      setTimeout(() => resolve(), 3000);
    });
  }

  async joinGame(gameId: string, playerId: string): Promise<void> {
    if (!this.socket?.connected) await this.connect();
    this.socket?.emit('join:game', { gameId, playerId });
  }

  async leaveRoom(roomId: string): Promise<void> {
    this.roomMemberships.delete(roomId);
    this.socket?.emit('leave:room', { roomId });
  }

  emit<T extends RealtimeEventType>(type: T, payload: RealtimeEventMap[T]): void {
    if (!this.socket?.connected) return;
    this.socket.emit(type, payload);
  }

  on<T extends RealtimeEventType>(type: T, handler: RealtimeEventHandler<T>): () => void {
    return this.bus.subscribe(type, handler);
  }
}
