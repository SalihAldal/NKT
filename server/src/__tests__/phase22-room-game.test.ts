import { describe, it, expect, beforeEach } from 'vitest';
import { PairingEngine } from '../games/pairing-engine';
import { calculateScore, timerForRound } from '../games/scoring';
import { difficultyForRound, GAME_RULES } from '../games/game-rules';
import { assertValidDisplayName, sanitizeDisplayName } from '../rooms/display-name';
import { assertJoinAllowed, recordFailedJoin, resetJoinGuard } from '../rooms/join-guard';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('PHASE 22 — Multiplayer room & game engine', () => {
  describe('Pairing engine', () => {
    it('generates balanced pairs for 5 players', () => {
      const engine = new PairingEngine();
      const ids = ['a', 'b', 'c', 'd', 'e'];
      const pairs = engine.generatePairs(ids, 1);
      expect(pairs).toHaveLength(2);
      pairs.forEach((p) => {
        expect(ids).toContain(p.askerId);
        expect(ids).toContain(p.responderId);
        expect(p.askerId).not.toBe(p.responderId);
      });
    });

    it('rotates pairings across rounds', () => {
      const engine = new PairingEngine();
      const ids = ['a', 'b', 'c', 'd'];
      const r1 = engine.generatePairs(ids, 1).map((p) => [p.askerId, p.responderId].sort().join(':'));
      const r2 = engine.generatePairs(ids, 2).map((p) => [p.askerId, p.responderId].sort().join(':'));
      expect(r1).not.toEqual(r2);
    });
  });

  describe('Scoring & difficulty', () => {
    it('30 questions with difficulty every 10 rounds', () => {
      expect(GAME_RULES.TOTAL_QUESTIONS).toBe(30);
      expect(difficultyForRound(0)).toBe(1);
      expect(difficultyForRound(9)).toBe(1);
      expect(difficultyForRound(10)).toBe(2);
      expect(difficultyForRound(19)).toBe(2);
      expect(difficultyForRound(20)).toBe(3);
    });

    it('server timer decreases with difficulty', () => {
      expect(timerForRound(0)).toBeGreaterThan(timerForRound(10));
      expect(timerForRound(10)).toBeGreaterThan(timerForRound(20));
    });

    it('correct answer scores with time bonus', () => {
      const fast = calculateScore({
        contentType: 'QUESTION',
        roundNum: 0,
        isCorrect: true,
        completed: false,
        timeRemainingMs: 10_000,
        totalTimeMs: 15_000,
      });
      const slow = calculateScore({
        contentType: 'QUESTION',
        roundNum: 0,
        isCorrect: true,
        completed: false,
        timeRemainingMs: 1_000,
        totalTimeMs: 15_000,
      });
      expect(fast).toBeGreaterThan(slow);
      expect(calculateScore({
        contentType: 'QUESTION',
        roundNum: 0,
        isCorrect: false,
        completed: false,
        timeRemainingMs: 10_000,
        totalTimeMs: 15_000,
      })).toBe(0);
    });
  });

  describe('Display name security', () => {
    it('rejects empty names', () => {
      expect(() => assertValidDisplayName('   ')).toThrow();
    });

    it('strips HTML and control chars', () => {
      expect(sanitizeDisplayName('<script>x</script>Ali')).toBe('Ali');
      expect(sanitizeDisplayName('Test\x00Name')).toBe('TestName');
    });
  });

  describe('Join brute-force guard', () => {
    beforeEach(() => resetJoinGuard());

    it('locks after repeated failures', () => {
      for (let i = 0; i < 5; i++) recordFailedJoin('1.2.3.4');
      expect(() => assertJoinAllowed('1.2.3.4')).toThrow('JOIN_RATE_LIMITED');
    });
  });

  describe('Infrastructure static checks', () => {
    const root = join(process.cwd());

    it('room routes expose kick/rematch/resume', () => {
      const routes = readFileSync(join(root, 'src/rooms/room.routes.ts'), 'utf-8');
      expect(routes).toContain('/kick');
      expect(routes).toContain('/rematch');
      expect(routes).toContain('/room/:roomId/resume');
    });

    it('game service uses pairing matches', () => {
      const game = readFileSync(join(root, 'src/games/game.service.ts'), 'utf-8');
      expect(game).toContain('pairingEngine');
      expect(game).toContain('tx.match.create');
      expect(game).toContain('NOT_RESPONDER');
    });

    it('room service enforces min players and idempotent start', () => {
      const room = readFileSync(join(root, 'src/rooms/room.service.ts'), 'utf-8');
      expect(room).toContain('MIN_PLAYERS');
      expect(room).toContain('status: \'ACTIVE\'');
      expect(room).toContain('kickedAt');
    });

    it('no public room list endpoint', () => {
      const routes = readFileSync(join(root, 'src/rooms/room.routes.ts'), 'utf-8');
      expect(routes).not.toContain('listActive');
      expect(routes).not.toContain('/discover');
    });
  });
});
