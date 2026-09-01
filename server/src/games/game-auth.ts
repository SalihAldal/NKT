import { prisma } from '../database/prisma.js';
import { ERR } from '../common/response.js';

/** Validates sessionToken → playerId → game membership chain (prevents IDOR). */
export async function verifyGamePlayer(gameId: string, playerId: string, sessionToken: string) {
  const player = await prisma.roomPlayer.findUnique({ where: { sessionToken } });
  if (!player || player.id !== playerId) throw ERR.FORBIDDEN;

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.roomId !== player.roomId) throw ERR.FORBIDDEN;

  const gamePlayer = await prisma.gamePlayer.findFirst({ where: { gameId, playerId } });
  if (!gamePlayer) throw ERR.FORBIDDEN;

  return { player, game, gamePlayer };
}

/** Ensures authenticated user can only read game result if they participated. */
export async function verifyGameAccess(gameId: string, userId: string) {
  const gamePlayer = await prisma.gamePlayer.findFirst({ where: { gameId, userId } });
  if (!gamePlayer) throw ERR.FORBIDDEN;
  return gamePlayer;
}
