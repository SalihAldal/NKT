import { prisma } from '../database/prisma.js';
import { AppError, ERR } from '../common/response.js';
import type { Game, GameContent } from '@prisma/client';
import { GAME_RULES, difficultyForRound, stageForRound } from './game-rules.js';
import { pairingEngine } from './pairing-engine.js';
import { calculateScore, timerForRound } from './scoring.js';
import {
  publishAnswerSubmitted,
  publishGameCompleted,
  publishRoundStarted,
  publishStageCompleted,
} from '../realtime/publish.js';

const roundTimers = new Map<string, NodeJS.Timeout>();

function roundTimerKey(gameId: string, roundId: string): string {
  return `${gameId}:${roundId}`;
}

export function scheduleRoundTimeout(gameId: string, roundId: string, roundNum: number, startedAt: Date) {
  const k = roundTimerKey(gameId, roundId);
  const existing = roundTimers.get(k);
  if (existing) clearTimeout(existing);
  const delay = Math.max(50, startedAt.getTime() + timerForRound(roundNum) - Date.now() + 50);
  roundTimers.set(k, setTimeout(() => {
    void handleRoundTimeout(gameId, roundId).catch(() => undefined);
  }, delay));
}

export function cancelRoundTimeout(gameId: string, roundId: string) {
  const k = roundTimerKey(gameId, roundId);
  const t = roundTimers.get(k);
  if (t) clearTimeout(t);
  roundTimers.delete(k);
}

export function resetRoundTimeouts() {
  for (const t of roundTimers.values()) clearTimeout(t);
  roundTimers.clear();
}

export async function selectContentForGame(
  gameId: string,
  categoryId: string,
  playerIds: string[],
  isPremiumRoom: boolean,
): Promise<GameContent[]> {
  void gameId;
  const usedContentIds = await prisma.contentUsage.findMany({
    where: { userId: { in: playerIds.filter(Boolean) as string[] } },
    select: { contentId: true },
    distinct: ['contentId'],
  });
  const excludeIds = new Set(usedContentIds.map((u) => u.contentId));
  const selected: GameContent[] = [];

  for (let round = 0; round < GAME_RULES.TOTAL_QUESTIONS; round++) {
    const difficulty = difficultyForRound(round);
    const content = await pickContent(categoryId, difficulty, isPremiumRoom, excludeIds);
    selected.push(content);
    excludeIds.add(content.id);
  }
  return selected;
}

async function pickContent(
  categoryId: string,
  difficulty: number,
  isPremiumRoom: boolean,
  excludeIds: Set<string>,
): Promise<GameContent> {
  const baseWhere = {
    categoryId,
    difficulty,
    active: true,
    moderationStatus: { in: ['APPROVED', 'ACTIVE'] as const },
    premium: isPremiumRoom ? undefined : false,
  };

  const content = await prisma.gameContent.findFirst({
    where: {
      ...baseWhere,
      id: excludeIds.size ? { notIn: [...excludeIds] } : undefined,
    },
    orderBy: { usageCount: 'asc' },
  });
  if (content) return content;

  const retry = await prisma.gameContent.findFirst({
    where: baseWhere,
    orderBy: { usageCount: 'asc' },
  });
  if (retry) return retry;

  throw new AppError(
    'CONTENT_EXHAUSTED',
    `No approved content at difficulty ${difficulty} for category ${categoryId}`,
    500,
  );
}

export async function initializeGameRounds(gameId: string, contents: GameContent[], playerIds: string[]) {
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < contents.length; i++) {
      const round = await tx.gameRound.create({
        data: {
          gameId,
          roundNum: i,
          stage: String(stageForRound(i)),
          startedAt: i === 0 ? new Date() : undefined,
        },
      });
      await tx.gameQuestion.create({ data: { roundId: round.id, contentId: contents[i]!.id, order: 0 } });
      const pairs = pairingEngine.generatePairs(playerIds, i + 1);
      for (const pair of pairs) {
        await tx.match.create({
          data: { roundId: round.id, playerAId: pair.askerId, playerBId: pair.responderId },
        });
      }
    }
    await tx.game.update({ where: { id: gameId }, data: { currentStage: 0, totalStages: contents.length } });
  });
  const firstRound = await prisma.gameRound.findFirst({ where: { gameId, roundNum: 0 } });
  if (firstRound?.startedAt) {
    scheduleRoundTimeout(gameId, firstRound.id, 0, firstRound.startedAt);
  }
}

function buildPrompt(content: GameContent, role: 'asker' | 'responder', askerName: string, responderName: string): string {
  if (role === 'asker') return `${responderName}'e sor: ${content.prompt}`;
  return content.prompt;
}

function isActionContent(type: string): boolean {
  return type === 'CHALLENGE' || type === 'PERFORMANCE';
}

export async function getPlayerView(gameId: string, playerId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      rounds: {
        include: {
          questions: { include: { content: true } },
          answers: true,
          matches: true,
        },
        orderBy: { roundNum: 'asc' },
      },
      scores: true,
      players: true,
      category: true,
    },
  });
  if (!game) throw ERR.NOT_FOUND;

  const currentRound = game.rounds[game.currentStage];
  const question = currentRound?.questions[0];
  const match = currentRound?.matches.find((m) => m.playerAId === playerId || m.playerBId === playerId);

  let role: 'asker' | 'responder' | 'observer' | 'bye' = 'observer';
  if (match) {
    role = match.playerAId === playerId ? 'asker' : 'responder';
  } else if (currentRound && game.status === 'ACTIVE') {
    role = 'bye';
  }

  const asker = match ? game.players.find((p) => p.playerId === match.playerAId) : undefined;
  const responder = match ? game.players.find((p) => p.playerId === match.playerBId) : undefined;
  const content = question?.content;

  let prompt: string | undefined;
  let options: unknown = undefined;
  if (content && match && game.status === 'ACTIVE') {
    if (role === 'asker') {
      prompt = buildPrompt(content, 'asker', asker?.displayName ?? '', responder?.displayName ?? '');
    } else if (role === 'responder') {
      prompt = buildPrompt(content, 'responder', asker?.displayName ?? '', responder?.displayName ?? '');
      if (content.type === 'QUESTION') options = content.options;
    }
  }

  const totalTimeMs = currentRound ? timerForRound(currentRound.roundNum) : 0;
  const roundStarted = currentRound?.startedAt?.getTime() ?? Date.now();
  const timeRemainingMs = Math.max(0, roundStarted + totalTimeMs - Date.now());

  const hasAnswered = currentRound?.answers.some((a) => a.playerId === playerId) ?? false;

  return {
    gameId: game.id,
    roomId: game.roomId,
    status: game.status.toLowerCase(),
    currentStage: game.currentStage,
    totalStages: game.totalStages,
    categoryName: game.category?.name,
    players: game.players.map((p) => ({ id: p.playerId, displayName: p.displayName })),
    scores: game.scores.map((s) => ({ playerId: s.playerId, score: s.score, rank: s.rank })),
    role,
    matchId: match?.id,
    askerName: asker?.displayName,
    responderName: responder?.displayName,
    currentQuestion: question
      ? {
          id: question.id,
          roundId: currentRound!.id,
          type: question.content.type.toLowerCase(),
          prompt: prompt ?? question.content.prompt,
          options,
          difficulty: question.content.difficulty,
        }
      : null,
    hasAnswered,
    timeRemainingMs,
    totalTimeMs,
  };
}

export async function resumeGameForPlayer(roomId: string, playerId: string) {
  const game = await prisma.game.findFirst({
    where: { roomId, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  });
  if (!game) return null;
  const member = await prisma.gamePlayer.findFirst({ where: { gameId: game.id, playerId } });
  if (!member) return null;
  return getPlayerView(game.id, playerId);
}

export async function submitAnswer(gameId: string, playerId: string, roundId: string, answer: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
      rounds: {
        where: { id: roundId },
        include: { questions: { include: { content: true } }, answers: true, matches: true },
      },
    },
  });
  if (!game || game.status !== 'ACTIVE') throw new AppError('INVALID_GAME_STATE', 'Game not active', 400);

  const round = game.rounds[0];
  if (!round || round.gameId !== gameId) throw ERR.NOT_FOUND;
  if (round.roundNum !== game.currentStage) throw new AppError('INVALID_GAME_STATE', 'Wrong round', 400);
  if (!game.players.some((p) => p.playerId === playerId)) throw new AppError('UNAUTHORIZED', 'Not in game', 403);
  if (round.answers.some((a) => a.playerId === playerId)) throw new AppError('ALREADY_ANSWERED', 'Already answered', 409);
  if (!answer.trim()) throw new AppError('INVALID_ANSWER', 'Answer required', 400);

  const match = round.matches.find((m) => m.playerAId === playerId || m.playerBId === playerId);
  if (!match) throw new AppError('NOT_AUTHORIZED', 'No active match', 403);

  const content = round.questions[0]?.content;
  if (!content) throw ERR.NOT_FOUND;

  const isAction = isActionContent(content.type);
  const isResponder = match.playerBId === playerId;
  const isAsker = match.playerAId === playerId;
  if (isAction) {
    if (!isAsker) throw new AppError('NOT_AUTHORIZED', 'Only asker can complete action', 403);
  } else if (!isResponder) {
    throw new AppError('NOT_RESPONDER', 'Only responder can answer', 403);
  }

  const totalTimeMs = timerForRound(round.roundNum);
  const roundStarted = round.startedAt?.getTime() ?? Date.now();
  const timeRemainingMs = Math.max(0, roundStarted + totalTimeMs - Date.now());
  if (timeRemainingMs <= 0) throw new AppError('TIMEOUT', 'Answer time expired', 400);

  let isCorrect: boolean | null = null;
  let completed = false;
  if (isAction) {
    completed = answer.trim() === 'completed';
    isCorrect = completed;
  } else if (content.correctAnswer) {
    isCorrect = answer.trim().toLowerCase() === content.correctAnswer.trim().toLowerCase();
  } else if (Array.isArray(content.options)) {
    const opts = content.options as Array<{ id: string; isCorrect?: boolean }>;
    const opt = opts.find((o) => o.id === answer);
    isCorrect = opt?.isCorrect === true;
  } else {
    isCorrect = null;
  }

  const scorePlayerId = match.playerBId;
  const score = calculateScore({
    contentType: content.type,
    roundNum: round.roundNum,
    isCorrect: isCorrect === true,
    completed,
    timeRemainingMs,
    totalTimeMs,
  });

  await prisma.$transaction(async (tx) => {
    await tx.gameAnswer.create({
      data: { roundId, playerId, answer, isCorrect, score },
    });
    const existing = await tx.gameScore.findUnique({ where: { gameId_playerId: { gameId, playerId: scorePlayerId } } });
    if (existing) {
      await tx.gameScore.update({ where: { id: existing.id }, data: { score: existing.score + score } });
    } else {
      await tx.gameScore.create({ data: { gameId, playerId: scorePlayerId, score } });
    }
    if (content) {
      await tx.gameContent.update({ where: { id: content.id }, data: { usageCount: { increment: 1 } } });
      const gp = await tx.gamePlayer.findFirst({ where: { gameId, playerId: scorePlayerId } });
      if (gp?.userId) {
        await tx.contentUsage.create({ data: { userId: gp.userId, contentId: content.id, gameId, roomId: game.roomId } });
      }
    }
  });

  const playerScore = await prisma.gameScore.findUnique({ where: { gameId_playerId: { gameId, playerId: scorePlayerId } } });
  await publishAnswerSubmitted(game.roomId, gameId, playerId, roundId, playerScore?.score ?? score);

  await finalizeRoundIfComplete(gameId, roundId);
  return getPlayerView(gameId, playerId);
}

export async function handleRoundTimeout(gameId: string, roundId: string) {
  const round = await prisma.gameRound.findUnique({
    where: { id: roundId },
    include: { questions: { include: { content: true } }, answers: true, matches: true, game: true },
  });
  if (!round || round.game.status !== 'ACTIVE' || round.roundNum !== round.game.currentStage) return;

  const answered = new Set(round.answers.map((a) => a.playerId));
  for (const match of round.matches) {
    const content = round.questions[0]?.content;
    const isAction = content && isActionContent(content.type);
    const requiredPlayerId = isAction ? match.playerAId : match.playerBId;
    if (answered.has(requiredPlayerId)) continue;
    await prisma.gameAnswer.create({
      data: { roundId, playerId: requiredPlayerId, answer: null, isCorrect: false, score: 0, timedOut: true },
    });
    answered.add(requiredPlayerId);
  }
  await finalizeRoundIfComplete(gameId, roundId);
}

export async function finalizeRoundIfComplete(gameId: string, roundId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.status !== 'ACTIVE') return;

  const round = await prisma.gameRound.findUnique({
    where: { id: roundId },
    include: { answers: true, matches: true, questions: { include: { content: true } } },
  });
  if (!round || round.roundNum !== game.currentStage) return;

  const matchCount = round.matches.length;
  const answerCount = round.answers.length;
  if (answerCount < matchCount || matchCount === 0) return;

  cancelRoundTimeout(gameId, roundId);

  const prevStage = stageForRound(round.roundNum);
  const nextStageNum = round.roundNum + 1;
  if (nextStageNum < game.totalStages) {
    const nextStage = stageForRound(nextStageNum);
    if (nextStage !== prevStage) {
      await publishStageCompleted(game.roomId, gameId, prevStage);
    }
    const advanced = await advanceRound(gameId);
    const nextRound = await prisma.gameRound.findFirst({
      where: { gameId, roundNum: advanced.currentStage },
      include: { questions: true },
    });
    if (nextRound?.questions[0]) {
      await publishRoundStarted(game.roomId, gameId, advanced.currentStage, nextRound.questions[0].contentId);
    }
    if (nextRound?.startedAt) {
      scheduleRoundTimeout(gameId, nextRound.id, nextRound.roundNum, nextRound.startedAt);
    }
  } else {
    await completeGame(gameId);
    await publishGameCompleted(game.roomId, gameId);
  }
}

export async function advanceRound(gameId: string): Promise<Game> {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw ERR.NOT_FOUND;

  const nextStage = game.currentStage + 1;
  if (nextStage >= game.totalStages) {
    return completeGame(gameId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.game.update({ where: { id: gameId }, data: { currentStage: nextStage } });
    await tx.gameRound.updateMany({
      where: { gameId, roundNum: nextStage },
      data: { startedAt: new Date() },
    });
  });
  return prisma.game.findUniqueOrThrow({ where: { id: gameId } });
}

export async function completeGame(gameId: string): Promise<Game> {
  const scores = await prisma.gameScore.findMany({ where: { gameId }, orderBy: { score: 'desc' } });
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < scores.length; i++) {
      await tx.gameScore.update({ where: { id: scores[i]!.id }, data: { rank: i + 1 } });
    }
    await tx.game.update({ where: { id: gameId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (game) await tx.room.update({ where: { id: game.roomId }, data: { status: 'COMPLETED' } });
  });
  return prisma.game.findUniqueOrThrow({ where: { id: gameId } });
}

export async function abortGame(gameId: string): Promise<Game> {
  const game = await prisma.game.update({
    where: { id: gameId },
    data: { status: 'ABORTED', completedAt: new Date() },
  });
  await prisma.room.update({ where: { id: game.roomId }, data: { status: 'CLOSED' } });
  return game;
}

export async function getGameResult(gameId: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      scores: { orderBy: { rank: 'asc' } },
      players: true,
      category: true,
      rounds: { include: { answers: true } },
    },
  });
  if (!game) throw ERR.NOT_FOUND;

  const answerStats = new Map<string, { correct: number }>();
  for (const round of game.rounds) {
    for (const ans of round.answers) {
      const stat = answerStats.get(ans.playerId) ?? { correct: 0 };
      if (ans.isCorrect) stat.correct += 1;
      answerStats.set(ans.playerId, stat);
    }
  }

  const durationMs = game.completedAt
    ? game.completedAt.getTime() - game.startedAt.getTime()
    : 0;

  return {
    gameId: game.id,
    roomId: game.roomId,
    categoryName: game.category?.name,
    status: game.status.toLowerCase(),
    scores: game.scores.map((s) => {
      const player = game.players.find((p) => p.playerId === s.playerId);
      const stats = answerStats.get(s.playerId);
      return {
        playerId: s.playerId,
        displayName: player?.displayName ?? 'Unknown',
        score: s.score,
        rank: s.rank,
        correctAnswers: stats?.correct ?? 0,
      };
    }),
    startedAt: game.startedAt.toISOString(),
    completedAt: game.completedAt?.toISOString(),
    durationMs,
    totalQuestions: game.totalStages,
  };
}
