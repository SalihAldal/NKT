import { AppError } from '../common/response.js';
import { prisma } from '../database/prisma.js';
import { isAdult18 } from '../auth/identity.js';

export async function assertUserCanAccess18(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { birthDate: true },
  });
  if (!user?.birthDate || !isAdult18(user.birthDate)) {
    throw new AppError('AGE_RESTRICTED', '18+ content requires adult account', 403);
  }
}

export async function assertRoomPlayersCanAccess18(roomId: string): Promise<void> {
  const players = await prisma.roomPlayer.findMany({
    where: { roomId, leftAt: null, userId: { not: null } },
    select: { userId: true },
  });
  const userIds = players.map((p) => p.userId).filter(Boolean) as string[];
  if (userIds.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, birthDate: true },
  });
  for (const user of users) {
    if (!user.birthDate || !isAdult18(user.birthDate)) {
      throw new AppError('AGE_RESTRICTED', 'All players must be 18+ for this category', 403);
    }
  }
}
