import { logger } from '@/utils/logger';
import type {
  RealtimeClient,
  RealtimeConnectionState,
  RealtimeEventBus,
  RealtimeEventHandler,
  RealtimeEventMap,
  RealtimeEventType,
  RealtimeSocketError,
} from './events';

export class MockRealtimeClient implements RealtimeClient {
  private connected = false;
  private connectionState: RealtimeConnectionState = 'disconnected';

  constructor(private readonly bus: RealtimeEventBus) {}

  async connect(): Promise<void> {
    this.connected = true;
    this.connectionState = 'connected';
    logger.debug('Realtime connected (mock)');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connectionState = 'disconnected';
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionState(): RealtimeConnectionState {
    return this.connectionState;
  }

  onConnectionState(): () => void {
    return () => {};
  }

  onError(): () => void {
    return () => {};
  }

  async joinRoom(roomId: string): Promise<void> {
    void roomId;
  }

  async joinGame(): Promise<void> {}

  async leaveRoom(roomId: string): Promise<void> {
    void roomId;
  }

  emit<T extends RealtimeEventType>(type: T, payload: RealtimeEventMap[T]): void {
    if (!this.connected) return;
    const roomId = 'roomId' in payload ? String((payload as { roomId: string }).roomId)
      : 'room' in payload && payload.room && typeof payload.room === 'object' && 'id' in payload.room
        ? String((payload.room as { id: string }).id)
        : undefined;
    this.bus.publish({ type, payload, timestamp: new Date().toISOString(), roomId });
  }

  on<T extends RealtimeEventType>(type: T, handler: RealtimeEventHandler<T>): () => void {
    return this.bus.subscribe(type, handler);
  }
}
