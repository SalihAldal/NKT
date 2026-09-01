import { describe, it, expect, beforeEach } from 'vitest';
import { REALTIME_EVENTS as SHARED_EVENTS } from '../../../shared/realtime/events';
import { REALTIME_EVENTS as SERVER_EVENTS } from '../realtime/events';
import { difficultyForRound, scoreForAnswer, stageForRound, GAME_RULES } from '../games/game-rules';
import { checkSocketRateLimit, resetSocketRateLimit } from '../realtime/rate-limit';

describe('PHASE 17 — Server realtime', () => {
  describe('Event contract parity', () => {
    it('server and shared event names match', () => {
      expect(SERVER_EVENTS).toEqual(SHARED_EVENTS);
    });
  });

  describe('Game rules — 30 question progression', () => {
    it('total questions is 30', () => {
      expect(GAME_RULES.TOTAL_QUESTIONS).toBe(30);
    });

    it('difficulty increases every 10 rounds', () => {
      expect(difficultyForRound(0)).toBe(1);
      expect(difficultyForRound(9)).toBe(1);
      expect(difficultyForRound(10)).toBe(2);
      expect(difficultyForRound(19)).toBe(2);
      expect(difficultyForRound(20)).toBe(3);
      expect(difficultyForRound(29)).toBe(3);
    });

    it('stage boundaries at 10 and 20', () => {
      expect(stageForRound(9)).toBe(1);
      expect(stageForRound(10)).toBe(2);
      expect(stageForRound(20)).toBe(3);
    });

    it('score uses server-side difficulty weights', () => {
      expect(scoreForAnswer(true, 0)).toBe(100);
      expect(scoreForAnswer(true, 10)).toBe(150);
      expect(scoreForAnswer(true, 20)).toBe(200);
      expect(scoreForAnswer(false, 20)).toBe(0);
    });
  });

  describe('Socket rate limiting', () => {
    beforeEach(() => resetSocketRateLimit());

    it('allows requests under limit', () => {
      expect(checkSocketRateLimit('user:join', 3, 1000)).toBe(true);
      expect(checkSocketRateLimit('user:join', 3, 1000)).toBe(true);
      expect(checkSocketRateLimit('user:join', 3, 1000)).toBe(true);
    });

    it('blocks requests over limit', () => {
      for (let i = 0; i < 3; i++) expect(checkSocketRateLimit('user:answer', 3, 1000)).toBe(true);
      expect(checkSocketRateLimit('user:answer', 3, 1000)).toBe(false);
    });
  });
});
