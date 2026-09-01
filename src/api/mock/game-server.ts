import { v4 as uuidv4 } from 'uuid';
import type {
  GameSession,
  GameSessionMatch,
  GameSessionPlayer,
  GameRoundPlan,
  PlayerGameView,
  GameRoom,
  RoomPlayer,
  RoundResultView,
} from '@/domain/models/game';
import type { GameContent } from '@/domain/models/content';
import {
  CONNECTION_STATE,
  ROOM_STATE,
  ANSWER_TYPE,
} from '@/domain/constants/enums';
import {
  GAME_CONFIG as GC,
  difficultyForRound,
  stageForRound,
  timerForDifficulty,
  getCategoryContentTypes,
  STAGE_LABELS,
} from '@/domain/constants/game';
import { getCategoryById } from '@/domain/constants/categories';
import { PairingEngine } from '@/services/game/pairing-engine';
import { scoringEngine } from '@/services/game/scoring-engine';
import { GameStateMachine } from '@/services/game/game-state-machine';
import { contentSelector } from '@/services/content/content-selector';
import { contentHistoryService } from '@/services/content/content-history';
import { contentRepository } from '@/services/content/content-repository';
import { PremiumAccessPolicy } from '@/services/entitlement/room-entitlement.service';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { gameError } from '@/services/errors/app-error';
import { realtimeRoomService } from '@/services/realtime/realtime-client';
import { REALTIME_EVENTS } from '@/services/realtime/events';
import { getContentByCategory, getContentById } from './content-pool';

type RoomGetter = (roomId: string) => GameRoom | undefined;
type RoomUpdater = (room: GameRoom) => void;

const sessions = new Map<string, GameSession>();
const roomToGame = new Map<string, string>();
const playerSessions = new Map<string, string>();
const pairing = new PairingEngine();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const cloneSession = (s: GameSession): GameSession => JSON.parse(JSON.stringify(s)) as GameSession;

const publishGameState = (session: GameSession) => {
  realtimeRoomService.publish(session.roomId, REALTIME_EVENTS.GAME_STATE_UPDATED, {
    gameId: session.gameId,
    roomId: session.roomId,
    stage: session.stage,
    currentQuestion: session.currentQuestion,
  });
};

const buildPrompt = (
  content: GameContent,
  role: 'asker' | 'responder',
  askerName: string,
  responderName: string,
): string => {
  if (role === 'asker') {
    return `${responderName}'e sor: ${content.prompt}`;
  }
  return content.prompt;
};

const stripOptions = (content: GameContent) =>
  content.options?.map((o) => ({ id: o.id, text: o.text })) ?? [];

const validateAnswer = (content: GameContent, answer: string): boolean => {
  if (content.answerType === ANSWER_TYPE.CHOICE) {
    const opt = content.options?.find((o) => o.id === answer);
    return opt?.isCorrect === true;
  }
  if (content.answerType === ANSWER_TYPE.TEXT) {
    return (content.correctAnswer ?? '').toLowerCase().trim() === answer.toLowerCase().trim();
  }
  return answer === 'completed';
};

export class GameServer {
  constructor(
    private getRoom: RoomGetter,
    private updateRoom: RoomUpdater,
  ) {}

  getSession(gameId: string): GameSession | undefined {
    return sessions.get(gameId);
  }

  getActiveGameForRoom(roomId: string): GameSession | undefined {
    const gameId = roomToGame.get(roomId);
    return gameId ? sessions.get(gameId) : undefined;
  }

  async selectCategory(roomId: string, categoryId: string, hostUserId: string): Promise<GameRoom> {
    const room = this.getRoom(roomId);
    if (!room) throw gameError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
    const category = getCategoryById(categoryId);
    if (!category) throw gameError('CATEGORY_NOT_FOUND', 'Kategori bulunamadı.');
    const hostEntitlement = await entitlementService.getEntitlement(hostUserId);
    PremiumAccessPolicy.assertPremiumCategoryAccess(categoryId, hostEntitlement, category.isFree);

    room.selectedCategoryId = categoryId;
    room.state = ROOM_STATE.CATEGORY_SELECTION;
    room.updatedAt = new Date().toISOString();
    this.updateRoom(room);
    realtimeRoomService.publish(roomId, REALTIME_EVENTS.CATEGORY_SELECTED, { roomId, categoryId });
    publishUpdate(room);
    return JSON.parse(JSON.stringify(room)) as GameRoom;
  }

  async createAndStart(
    room: GameRoom,
    categoryId: string,
  ): Promise<GameSession> {
    const existing = roomToGame.get(room.id);
    if (existing) {
      const s = sessions.get(existing);
      if (s && s.status === 'active') throw gameError('GAME_EXISTS', 'Oyun zaten aktif.');
    }

    const activePlayers = room.players.filter((p) => p.connectionState === CONNECTION_STATE.CONNECTED);
    if (activePlayers.length < GC.MIN_PLAYERS) {
      throw gameError('NOT_ENOUGH_PLAYERS', 'Yeterli oyuncu yok.');
    }

    const seed = uuidv4();
    const gameId = uuidv4();
    const pool = getContentByCategory(categoryId, true);
    const contentTypes = getCategoryContentTypes(categoryId);
    const roomHistory = await contentHistoryService.getRoomContentIds(room.id);
    const category = getCategoryById(categoryId)!;
    const playerHistorySets = await Promise.all(
      activePlayers.map((p) =>
        p.userId
          ? contentHistoryService.getRecentContentIds(p.userId, categoryId)
          : Promise.resolve([]),
      ),
    );
    const playerHistoryIds = [...new Set(playerHistorySets.flat())];
    const selectedIds: string[] = [];
    const roundPlans: GameRoundPlan[] = [];

    for (let round = 1; round <= GC.TOTAL_QUESTIONS; round++) {
      const difficulty = difficultyForRound(round);
      const stage = stageForRound(round);
      const result = contentSelector.select(
        {
          categoryId,
          contentTypes,
          difficulty,
          excludeIds: selectedIds,
          roomHistoryIds: roomHistory,
          playerHistoryIds,
          premiumUnlocked: room.isPremiumRoom,
          count: 1,
          seed,
          roundNumber: round,
          ageRatingMax: category.ageRating === '18+' ? '18+' : undefined,
        },
        pool,
      );
      const content = result.items[0];
      if (!content) throw gameError('CONTENT_EXHAUSTED', 'Yeterli içerik yok.');
      selectedIds.push(content.id);

      const playerIds = activePlayers.map((p) => p.id);
      const pairs = pairing.generatePairs(playerIds, round);
      const matches: GameSessionMatch[] = pairs.map((pair) => ({
        id: uuidv4(),
        roundNumber: round,
        askerPlayerId: pair.askerId,
        responderPlayerId: pair.responderId,
        contentId: content.id,
        contentType: content.type,
        answerType: content.answerType,
        difficulty,
        status: 'pending',
      }));

      roundPlans.push({ roundNumber: round, contentId: content.id, difficulty, stage, matches });
    }

    const session: GameSession = {
      gameId,
      roomId: room.id,
      categoryId,
      contentSelectionSeed: seed,
      totalQuestions: GC.TOTAL_QUESTIONS,
      currentQuestion: 0,
      currentStage: 1,
      stage: 'countdown',
      players: activePlayers.map((p) => ({
        playerId: p.id,
        userId: p.userId,
        displayName: p.displayName,
        avatarEmoji: p.avatarEmoji,
        score: 0,
        correctCount: 0,
        connectionState: p.connectionState,
      })),
      roundPlans,
      scores: Object.fromEntries(activePlayers.map((p) => [p.id, 0])),
      status: 'active',
      countdownEndsAt: new Date(Date.now() + GC.COUNTDOWN_SECONDS * 1000).toISOString(),
      submittedMatchIds: [],
    };

    sessions.set(gameId, session);
    roomToGame.set(room.id, gameId);
    activePlayers.forEach((p) => playerSessions.set(p.id, gameId));

    room.currentGameId = gameId;
    room.state = ROOM_STATE.COUNTDOWN;
    room.selectedCategoryId = categoryId;
    room.updatedAt = new Date().toISOString();
    this.updateRoom(room);

    realtimeRoomService.publish(room.id, REALTIME_EVENTS.GAME_STARTED, { roomId: room.id, gameId });
    publishGameState(session);
    publishUpdate(room);

    this.scheduleCountdown(session);
    return cloneSession(session);
  }

  private scheduleCountdown(session: GameSession) {
    const key = `countdown-${session.gameId}`;
    this.clearTimer(key);
    const ms = GC.COUNTDOWN_SECONDS * 1000;
    timers.set(key, setTimeout(() => this.beginRound(session.gameId), ms));
  }

  private beginRound(gameId: string) {
    const session = sessions.get(gameId);
    if (!session || session.status !== 'active') return;

    const nextRound = session.currentQuestion + 1;
    if (nextRound > session.totalQuestions) {
      this.finishGame(session);
      return;
    }

    session.currentQuestion = nextRound;
    session.currentStage = stageForRound(nextRound);
    session.stage = 'round_active';

    const plan = session.roundPlans.find((r) => r.roundNumber === nextRound);
    if (!plan) return;

    const timeMs = timerForDifficulty(plan.difficulty);
    plan.startedAt = new Date().toISOString();
    plan.endsAt = new Date(Date.now() + timeMs).toISOString();
    session.roundEndsAt = plan.endsAt;

    plan.matches.forEach((m) => { m.status = 'active'; });

    void contentHistoryService.recordUsage({
      playerId: 'system',
      contentId: plan.contentId,
      categoryId: session.categoryId,
      gameId: session.gameId,
      roomId: session.roomId,
    });
    contentRepository.incrementUsage(plan.contentId, 'usageCount');
    session.players.forEach((p) => {
      void contentHistoryService.recordUsage({
        playerId: p.playerId,
        contentId: plan.contentId,
        categoryId: session.categoryId,
        gameId: session.gameId,
        roomId: session.roomId,
      });
    });

    const room = this.getRoom(session.roomId);
    if (room) {
      room.state = ROOM_STATE.PLAYING;
      room.currentRoundId = `round-${nextRound}`;
      this.updateRoom(room);
    }

    realtimeRoomService.publish(session.roomId, REALTIME_EVENTS.ROUND_STARTED, {
      roomId: session.roomId,
      roundNumber: nextRound,
      contentId: plan.contentId,
    });
    publishGameState(session);

    const key = `round-${gameId}-${nextRound}`;
    this.clearTimer(key);
    timers.set(key, setTimeout(() => this.handleRoundTimeout(gameId, nextRound), timeMs));
  }

  private handleRoundTimeout(gameId: string, roundNumber: number) {
    const session = sessions.get(gameId);
    if (!session || session.stage !== 'round_active' || session.currentQuestion !== roundNumber) return;

    const plan = session.roundPlans.find((r) => r.roundNumber === roundNumber);
    if (!plan) return;

    plan.matches.forEach((m) => {
      if (m.status === 'active') {
        m.status = 'timeout';
        m.scoreAwarded = 0;
      }
    });

    this.showRoundResult(session);
  }

  getPlayerView(gameId: string, playerId: string): PlayerGameView {
    const session = sessions.get(gameId);
    if (!session) throw gameError('GAME_NOT_FOUND', 'Oyun bulunamadı.');
    if (session.status === 'completed' || session.status === 'aborted') {
      return this.buildCompletedView(session, playerId);
    }

    const player = session.players.find((p) => p.playerId === playerId);
    if (!player) throw gameError('NOT_MEMBER', 'Bu oyunun üyesi değilsin.');

    const plan = session.roundPlans.find((r) => r.roundNumber === session.currentQuestion);
    const match = plan?.matches.find(
      (m) => m.askerPlayerId === playerId || m.responderPlayerId === playerId,
    );

    let role: PlayerGameView['role'] = 'observer';
    if (match) {
      role = match.askerPlayerId === playerId ? 'asker' : 'responder';
    } else if (plan && session.stage === 'round_active') {
      role = 'bye';
    }

    const content = match ? getContentById(match.contentId) : undefined;
    const asker = match ? session.players.find((p) => p.playerId === match.askerPlayerId) : undefined;
    const responder = match ? session.players.find((p) => p.playerId === match.responderPlayerId) : undefined;

    let prompt: string | undefined;
    let options: PlayerGameView['options'];
    if (content && match && session.stage === 'round_active') {
      if (role === 'asker') {
        prompt = buildPrompt(content, 'asker', asker?.displayName ?? '', responder?.displayName ?? '');
      } else if (role === 'responder') {
        prompt = buildPrompt(content, 'responder', asker?.displayName ?? '', responder?.displayName ?? '');
        if (content.answerType === ANSWER_TYPE.CHOICE) options = stripOptions(content);
      }
    }

    const now = Date.now();
    const roundEndsAt = session.roundEndsAt;
    const timeRemainingMs = roundEndsAt ? Math.max(0, new Date(roundEndsAt).getTime() - now) : undefined;

    const category = getCategoryById(session.categoryId);
    const scores = this.buildScoreboard(session);
    const lastRoundResult = session.stage === 'round_result'
      ? this.buildRoundResult(session, playerId, match)
      : undefined;

    return {
      gameId: session.gameId,
      roomId: session.roomId,
      stage: session.stage,
      currentQuestion: session.currentQuestion,
      totalQuestions: session.totalQuestions,
      currentStageNum: session.currentStage,
      role,
      matchId: match?.id,
      askerName: asker?.displayName,
      responderName: responder?.displayName,
      askerAvatar: asker?.avatarEmoji,
      responderAvatar: responder?.avatarEmoji,
      categoryId: session.categoryId,
      categoryName: category?.name,
      prompt,
      contentType: content?.type,
      answerType: content?.answerType,
      options,
      timeRemainingMs,
      roundEndsAt: session.roundEndsAt,
      countdownEndsAt: session.countdownEndsAt,
      countdownSeconds: session.countdownEndsAt
        ? Math.max(0, Math.ceil((new Date(session.countdownEndsAt).getTime() - now) / 1000))
        : undefined,
      answerState: this.buildAnswerState(session, match, playerId),
      lastScoreDelta: match?.scoreAwarded,
      scores,
      lastRoundResult,
      stageTransition: session.stage === 'stage_transition'
        ? STAGE_LABELS[session.currentStage]
        : undefined,
    };
  }

  submitAnswer(gameId: string, playerId: string, matchId: string, answer: string): PlayerGameView {
    const session = sessions.get(gameId);
    if (!session) throw gameError('GAME_NOT_FOUND', 'Oyun bulunamadı.');
    if (session.status !== 'active') throw gameError('GAME_ENDED', 'Oyun sona erdi.');

    const dedupeKey = `${matchId}:${playerId}`;
    if (session.submittedMatchIds.includes(dedupeKey)) {
      return this.getPlayerView(gameId, playerId);
    }
    if (session.stage !== 'round_active') throw gameError('INVALID_STATE', 'Şu an cevap gönderilemez.');

    const plan = session.roundPlans.find((r) => r.roundNumber === session.currentQuestion);
    const match = plan?.matches.find((m) => m.id === matchId);
    if (!match) throw gameError('MATCH_NOT_FOUND', 'Eşleşme bulunamadı.');
    if (match.status !== 'active') throw gameError('MATCH_CLOSED', 'Bu tur kapandı.');
    if (match.responderPlayerId !== playerId && match.askerPlayerId !== playerId) {
      throw gameError('NOT_AUTHORIZED', 'Bu eşleşmeye cevap veremezsin.');
    }

    const content = getContentById(match.contentId);
    if (!content) throw gameError('CONTENT_NOT_FOUND', 'İçerik bulunamadı.');

    const isAction = content.answerType === ANSWER_TYPE.ACTION || content.answerType === ANSWER_TYPE.NONE;
    const responderOnly = !isAction && match.responderPlayerId !== playerId;
    if (responderOnly) throw gameError('NOT_RESPONDER', 'Cevaplayan sensin değilsin.');

    const now = Date.now();
    const endsAt = plan?.endsAt ? new Date(plan.endsAt).getTime() : now;
    const totalTimeMs = timerForDifficulty(match.difficulty);
    const timeRemainingMs = Math.max(0, endsAt - now);
    if (timeRemainingMs <= 0) throw gameError('TIMEOUT', 'Süre doldu.');

    const isCorrect = isAction ? answer === 'completed' : validateAnswer(content, answer);
    const completed = isAction ? answer === 'completed' : isCorrect;
    const scoreAwarded = scoringEngine.calculate({
      difficulty: match.difficulty,
      contentType: content.type,
      isCorrect,
      completed,
      timeRemainingMs,
      totalTimeMs,
    });

    match.answer = answer;
    match.isCorrect = isCorrect;
    match.completed = completed;
    match.scoreAwarded = scoreAwarded;
    match.timeSpentMs = totalTimeMs - timeRemainingMs;
    match.submittedAt = new Date().toISOString();
    match.status = 'answered';
    match.submittedBy = playerId;
    session.submittedMatchIds.push(dedupeKey);

    const scorer = session.players.find((p) => p.playerId === match.responderPlayerId);
    if (scorer) {
      scorer.score += scoreAwarded;
      if (isCorrect || completed) scorer.correctCount += 1;
      session.scores[scorer.playerId] = scorer.score;
    }

    realtimeRoomService.publish(session.roomId, REALTIME_EVENTS.ANSWER_SUBMITTED, {
      roomId: session.roomId,
      playerId,
      matchId,
    });
    realtimeRoomService.publish(session.roomId, REALTIME_EVENTS.SCORE_UPDATED, {
      roomId: session.roomId,
      playerId: scorer?.playerId ?? playerId,
      score: scorer?.score ?? 0,
    });

    const allAnswered = plan!.matches.every((m) => m.status === 'answered' || m.status === 'timeout' || m.status === 'skipped');
    if (allAnswered) {
      this.clearTimer(`round-${gameId}-${session.currentQuestion}`);
      this.showRoundResult(session);
    }

    return this.getPlayerView(gameId, playerId);
  }

  private showRoundResult(session: GameSession) {
    session.stage = 'round_result';
    publishGameState(session);

    const key = `result-${session.gameId}`;
    this.clearTimer(key);
    timers.set(key, setTimeout(() => {
      const isStageEnd = session.currentQuestion % GC.STAGE_SIZE === 0;
      const isGameEnd = session.currentQuestion >= session.totalQuestions;

      if (isGameEnd) {
        this.finishGame(session);
      } else if (isStageEnd) {
        session.stage = 'stage_transition';
        publishGameState(session);
        realtimeRoomService.publish(session.roomId, REALTIME_EVENTS.STAGE_COMPLETED, {
          roomId: session.roomId,
          stage: session.currentStage,
        });
        timers.set(`stage-${session.gameId}`, setTimeout(() => this.beginRound(session.gameId), GC.STAGE_TRANSITION_MS));
      } else {
        this.beginRound(session.gameId);
      }
    }, GC.ROUND_RESULT_MS));
  }

  private finishGame(session: GameSession) {
    session.stage = 'final_result';
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    publishGameState(session);

    const room = this.getRoom(session.roomId);
    if (room) {
      room.state = ROOM_STATE.FINAL_RESULT;
      this.updateRoom(room);
    }

    const finalScores = this.buildScoreboard(session).map((s) => ({
      playerId: s.playerId,
      score: s.score,
    }));

    realtimeRoomService.publish(session.roomId, REALTIME_EVENTS.GAME_COMPLETED, {
      roomId: session.roomId,
      scores: finalScores,
    });

    timers.set(`final-${session.gameId}`, setTimeout(() => {
      session.stage = 'completed';
      if (room) {
        room.state = ROOM_STATE.COMPLETED;
        this.updateRoom(room);
      }
      publishGameState(session);
    }, GC.ROUND_RESULT_MS * 2));
  }

  private buildCompletedView(session: GameSession, playerId: string): PlayerGameView {
    const category = getCategoryById(session.categoryId);
    return {
      gameId: session.gameId,
      roomId: session.roomId,
      stage: session.stage,
      currentQuestion: session.currentQuestion,
      totalQuestions: session.totalQuestions,
      currentStageNum: session.currentStage,
      role: 'observer',
      categoryId: session.categoryId,
      categoryName: category?.name,
      scores: this.buildScoreboard(session),
      finalStats: this.buildFinalStats(session),
      abortReason: session.status === 'aborted' ? 'Oyun sonlandırıldı.' : undefined,
    };
  }

  private buildRoundResult(session: GameSession, playerId: string, match: GameSessionMatch | undefined): RoundResultView | undefined {
    if (!match) return undefined;
    const content = getContentById(match.contentId);
    const scorer = session.players.find((p) => p.playerId === match.responderPlayerId);
    const totalScore = session.scores[match.responderPlayerId] ?? scorer?.score ?? 0;
    const revealAnswer = content?.answerType === ANSWER_TYPE.CHOICE
      ? content.options?.find((o) => o.isCorrect)?.text
      : content?.correctAnswer;

    return {
      matchId: match.id,
      scoreAwarded: match.scoreAwarded ?? 0,
      isCorrect: match.isCorrect,
      completed: match.completed,
      totalScore,
      responseTimeMs: match.timeSpentMs,
      revealedAnswer: revealAnswer,
    };
  }

  private buildAnswerState(session: GameSession, match: GameSessionMatch | undefined, playerId: string): PlayerGameView['answerState'] {
    if (!match) return 'idle';
    if (session.stage === 'round_result') return 'result';
    if (match.status === 'timeout') return 'timeout';
    if (match.status === 'answered' || match.status === 'skipped') return 'locked';
    if (match.responderPlayerId === playerId && session.stage === 'round_active') return 'answering';
    return 'idle';
  }

  private buildFinalStats(session: GameSession) {
    const stats = session.players.map((p) => {
      let correctCount = 0;
      let challengeCompletions = 0;
      let totalResponseMs = 0;
      let responseCount = 0;
      session.roundPlans.forEach((plan) => {
        plan.matches.forEach((m) => {
          if (m.responderPlayerId !== p.playerId) return;
          if (m.isCorrect) correctCount += 1;
          if (m.completed && (m.contentType === 'challenge' || m.contentType === 'performance')) {
            challengeCompletions += 1;
          }
          if (m.timeSpentMs) { totalResponseMs += m.timeSpentMs; responseCount += 1; }
        });
      });
      return {
        playerId: p.playerId,
        displayName: p.displayName,
        avatarEmoji: p.avatarEmoji,
        score: p.score,
        rank: 0,
        correctCount,
        challengeCompletions,
        avgResponseMs: responseCount > 0 ? Math.round(totalResponseMs / responseCount) : 0,
      };
    });
    return stats
      .sort((a, b) => b.score - a.score)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  private buildScoreboard(session: GameSession) {
    return [...session.players]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        playerId: p.playerId,
        displayName: p.displayName,
        avatarEmoji: p.avatarEmoji,
        score: p.score,
        rank: i + 1,
      }));
  }

  resumeGame(roomId: string, playerId: string): PlayerGameView | null {
    const gameId = roomToGame.get(roomId);
    if (!gameId) return null;
    const session = sessions.get(gameId);
    if (!session || session.status === 'completed') return null;
    if (!session.players.some((p) => p.playerId === playerId)) return null;
    return this.getPlayerView(gameId, playerId);
  }

  clearRoomGame(roomId: string) {
    const gameId = roomToGame.get(roomId);
    if (gameId) {
      this.clearAllTimers(gameId);
      sessions.delete(gameId);
      roomToGame.delete(roomId);
    }
  }

  abortGame(roomId: string, reason: string) {
    const gameId = roomToGame.get(roomId);
    if (!gameId) return;
    const session = sessions.get(gameId);
    if (!session) return;
    session.status = 'aborted';
    session.stage = 'aborted';
    publishGameState(session);
    realtimeRoomService.publish(roomId, REALTIME_EVENTS.GAME_ABORTED, { roomId, reason });
    this.clearAllTimers(gameId);
  }

  private clearTimer(key: string) {
    const t = timers.get(key);
    if (t) { clearTimeout(t); timers.delete(key); }
  }

  private clearAllTimers(gameId: string) {
    [...timers.keys()].filter((k) => k.includes(gameId)).forEach((k) => this.clearTimer(k));
  }

  _reset() {
    sessions.clear();
    roomToGame.clear();
    playerSessions.clear();
    pairing.reset();
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
  }
}

function publishUpdate(room: GameRoom) {
  realtimeRoomService.publish(room.id, REALTIME_EVENTS.ROOM_UPDATED, { room: JSON.parse(JSON.stringify(room)) as GameRoom });
}

let _gameServer: GameServer | null = null;

export function initGameServer(getRoom: RoomGetter, updateRoom: RoomUpdater): GameServer {
  _gameServer = new GameServer(getRoom, updateRoom);
  return _gameServer;
}

export function getGameServer(): GameServer {
  if (!_gameServer) throw new Error('GameServer not initialized');
  return _gameServer;
}
