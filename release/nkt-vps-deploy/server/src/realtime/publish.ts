import { prisma } from '../database/prisma.js';
import { mapRoomToDto } from '../rooms/room.service.js';
import { publishRoomEvent, publishGameEvent } from './socket.js';
import { REALTIME_EVENTS } from './events.js';
import { logger } from '../common/logger.js';

export async function publishFullRoomUpdate(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      players: { where: { leftAt: null } },
      games: { where: { status: 'ACTIVE' }, orderBy: { startedAt: 'desc' }, take: 1 },
    },
  });
  if (!room) return;
  const dto = mapRoomToDto(room);
  publishRoomEvent(roomId, REALTIME_EVENTS.ROOM_UPDATED, { room: dto });
}

export async function publishRoomJoined(roomId: string, playerId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: { where: { leftAt: null } } },
  });
  if (!room) return;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  const dto = mapRoomToDto(room);
  const playerDto = dto.players.find((p) => p.id === playerId);
  if (!playerDto) return;
  publishRoomEvent(roomId, REALTIME_EVENTS.ROOM_JOINED, { room: dto, player: playerDto });
  await publishFullRoomUpdate(roomId);
}

export async function publishGameStarted(roomId: string, gameId: string) {
  publishRoomEvent(roomId, REALTIME_EVENTS.GAME_STARTED, { roomId, gameId });
  publishGameEvent(gameId, REALTIME_EVENTS.GAME_STARTED, { roomId, gameId });
  publishRoomEvent(roomId, REALTIME_EVENTS.GAME_STATE_UPDATED, {
    gameId,
    roomId,
    stage: 'round_active',
    currentQuestion: 1,
  });
}

export async function publishRoundStarted(roomId: string, gameId: string, roundNumber: number, contentId: string) {
  publishRoomEvent(roomId, REALTIME_EVENTS.ROUND_STARTED, { roomId, roundNumber: roundNumber + 1, contentId });
  publishGameEvent(gameId, REALTIME_EVENTS.ROUND_STARTED, { roomId, roundNumber: roundNumber + 1, contentId });
  publishRoomEvent(roomId, REALTIME_EVENTS.QUESTION_PRESENTED, { roomId, contentId });
  publishRoomEvent(roomId, REALTIME_EVENTS.GAME_STATE_UPDATED, {
    gameId,
    roomId,
    stage: 'round_active',
    currentQuestion: roundNumber + 1,
  });
}

export async function publishAnswerSubmitted(roomId: string, gameId: string, playerId: string, roundId: string, score: number) {
  publishRoomEvent(roomId, REALTIME_EVENTS.ANSWER_SUBMITTED, { roomId, playerId, matchId: roundId });
  publishGameEvent(gameId, REALTIME_EVENTS.ANSWER_SUBMITTED, { roomId, playerId, matchId: roundId });
  publishRoomEvent(roomId, REALTIME_EVENTS.SCORE_UPDATED, { roomId, playerId, score });
}

export async function publishStageCompleted(roomId: string, gameId: string, stage: number) {
  publishRoomEvent(roomId, REALTIME_EVENTS.STAGE_COMPLETED, { roomId, stage });
  publishGameEvent(gameId, REALTIME_EVENTS.STAGE_COMPLETED, { roomId, stage });
}

export async function publishGameCompleted(roomId: string, gameId: string) {
  const scores = await prisma.gameScore.findMany({ where: { gameId } });
  const payload = {
    roomId,
    scores: scores.map((s) => ({ playerId: s.playerId, score: s.score })),
  };
  publishRoomEvent(roomId, REALTIME_EVENTS.GAME_COMPLETED, payload);
  publishGameEvent(gameId, REALTIME_EVENTS.GAME_COMPLETED, payload);
  logger.info({ roomId, gameId }, 'Game completed realtime published');
}

export async function publishHostChanged(roomId: string, newHostId: string) {
  publishRoomEvent(roomId, REALTIME_EVENTS.HOST_CHANGED, { roomId, newHostId });
  await publishFullRoomUpdate(roomId);
}

export async function publishRoomClosed(roomId: string, reason: string) {
  publishRoomEvent(roomId, REALTIME_EVENTS.ROOM_CLOSED, { roomId, reason });
}
