import { env } from '@config/environment';
import type {
  RealtimeClient,
  RealtimeEvent,
  RealtimeEventBus,
  RealtimeEventHandler,
  RealtimeEventMap,
  RealtimeEventType,
  RealtimeRoomService,
} from './events';
import { MockRealtimeClient } from './mock-realtime-client';
import { SocketIORealtimeClient } from './socket-io-client';
import { logger } from '@/utils/logger';

class InMemoryRealtimeEventBus implements RealtimeEventBus {
  private handlers = new Map<RealtimeEventType, Set<RealtimeEventHandler<RealtimeEventType>>>();

  publish<T extends RealtimeEventType>(event: RealtimeEvent<T>): void {
    const set = this.handlers.get(event.type);
    if (!set) return;
    set.forEach((handler) => {
      try {
        handler(event as RealtimeEvent<RealtimeEventType>);
      } catch (e) {
        logger.error('Realtime handler error', e);
      }
    });
  }

  subscribe<T extends RealtimeEventType>(type: T, handler: RealtimeEventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const wrapped = handler as RealtimeEventHandler<RealtimeEventType>;
    this.handlers.get(type)!.add(wrapped);
    return () => this.handlers.get(type)?.delete(wrapped);
  }
}

class RealtimeRoomServiceImpl implements RealtimeRoomService {
  constructor(
    private client: RealtimeClient,
    private bus: RealtimeEventBus,
  ) {}

  subscribe(roomId: string, handlers: Partial<Record<RealtimeEventType, RealtimeEventHandler<RealtimeEventType>>>): () => void {
    const unsubs: Array<() => void> = [];
    Object.entries(handlers).forEach(([type, handler]) => {
      if (handler) {
        unsubs.push(
          this.bus.subscribe(type as RealtimeEventType, (event) => {
            const eventRoomId = event.roomId ?? ('roomId' in event.payload ? String((event.payload as { roomId: string }).roomId) : undefined);
            if (eventRoomId === roomId) handler(event);
          }),
        );
      }
    });
    return () => unsubs.forEach((u) => u());
  }

  publish<T extends RealtimeEventType>(roomId: string, type: T, payload: RealtimeEventMap[T]): void {
    this.client.emit(type, payload);
    this.bus.publish({ type, payload, timestamp: new Date().toISOString(), roomId });
  }
}

function createRealtimeClient(bus: RealtimeEventBus, useMock = env.useMockRealtime): RealtimeClient {
  if (useMock) {
    return new MockRealtimeClient(bus);
  }
  return new SocketIORealtimeClient(bus);
}

export const realtimeEventBus: RealtimeEventBus = new InMemoryRealtimeEventBus();
export const realtimeClient: RealtimeClient = createRealtimeClient(realtimeEventBus);
export { createRealtimeClient };
export const realtimeRoomService: RealtimeRoomService = new RealtimeRoomServiceImpl(
  realtimeClient,
  realtimeEventBus,
);
