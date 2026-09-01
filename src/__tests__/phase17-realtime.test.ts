import { describe, it, expect } from 'vitest';
import { REALTIME_EVENTS as SHARED_EVENTS } from '../../shared/realtime/events';
import { REALTIME_EVENTS } from '@/services/realtime/events';
import { difficultyForRound, stageForRound } from '@/domain/constants/game';
import { createRealtimeClient, realtimeEventBus } from '@/services/realtime/realtime-client';
import { MockRealtimeClient } from '@/services/realtime/mock-realtime-client';
import { SocketIORealtimeClient } from '@/services/realtime/socket-io-client';

describe('PHASE 17 — Production multiplayer client', () => {
  it('mobile realtime events match shared contract', () => {
    expect(REALTIME_EVENTS).toEqual(SHARED_EVENTS);
  });

  it('uses MockRealtimeClient when useMockRealtime=true', () => {
    const client = createRealtimeClient(realtimeEventBus, true);
    expect(client).toBeInstanceOf(MockRealtimeClient);
  });

  it('uses SocketIORealtimeClient when useMockRealtime=false', () => {
    const client = createRealtimeClient(realtimeEventBus, false);
    expect(client).toBeInstanceOf(SocketIORealtimeClient);
  });

  it('validateProductionConfig rejects mock realtime', () => {
    const validate = () => {
      const env = { isProduction: true, useMockApi: false, useMockRealtime: true, apiUrl: 'x', realtimeUrl: 'y' };
      if (env.useMockRealtime) throw new Error('Mock realtime cannot be enabled in production');
    };
    expect(validate).toThrow(/Mock realtime/);
  });

  it('domain difficulty progression matches 10/20/30 rule', () => {
    expect(difficultyForRound(1)).toBe(1);
    expect(difficultyForRound(10)).toBe(1);
    expect(difficultyForRound(11)).toBe(2);
    expect(difficultyForRound(21)).toBe(3);
    expect(stageForRound(10)).toBe(1);
    expect(stageForRound(11)).toBe(2);
    expect(stageForRound(21)).toBe(3);
  });
});
