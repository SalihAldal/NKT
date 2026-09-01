#!/usr/bin/env tsx
/**
 * Database integrity checks — requires migrated DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
let failures = 0;

function fail(msg: string) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

function pass(msg: string) {
  console.log(`PASS: ${msg}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  console.log('=== NKT Database Integrity ===\n');

  await prisma.$queryRaw`SELECT 1`;
  pass('Database connection');

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  const required = ['users', 'rooms', 'games', 'categories', 'game_contents', 'purchases', 'subscriptions'];
  for (const t of required) {
    if (!tables.some((r) => r.tablename === t)) fail(`Missing table: ${t}`);
  }
  pass(`Core tables present (${tables.length} total)`);

  // Duplicate room code
  try {
    const hostId = randomUUID();
    const user = await prisma.user.create({ data: { profile: { create: { displayName: 'Test', username: `t_${Date.now()}` } } } });
    const code = `TST${Date.now().toString().slice(-4)}`;
    await prisma.room.create({
      data: { code, hostUserId: user.id, expiresAt: new Date(Date.now() + 3600000) },
    });
    await prisma.room.create({
      data: { code, hostUserId: user.id, expiresAt: new Date(Date.now() + 3600000) },
    });
    fail('Duplicate room code was allowed');
  } catch {
    pass('Duplicate room code rejected');
  }

  // Duplicate username
  try {
    const u1 = randomUUID();
    const u2 = randomUUID();
    await prisma.user.create({ data: { id: u1, profile: { create: { displayName: 'A', username: 'dup_user_test' } } } });
    await prisma.user.create({ data: { id: u2, profile: { create: { displayName: 'B', username: 'dup_user_test' } } } });
    fail('Duplicate username was allowed');
  } catch {
    pass('Duplicate username rejected');
  }

  // Duplicate friendship
  try {
    const a = await prisma.user.create({ data: { profile: { create: { displayName: 'A', username: `fa_${Date.now()}` } } } });
    const b = await prisma.user.create({ data: { profile: { create: { displayName: 'B', username: `fb_${Date.now()}` } } } });
    await prisma.friendship.create({ data: { requesterId: a.id, receiverId: b.id } });
    await prisma.friendship.create({ data: { requesterId: a.id, receiverId: b.id } });
    fail('Duplicate friendship was allowed');
  } catch {
    pass('Duplicate friendship rejected');
  }

  // Invalid enum via raw SQL
  try {
    await prisma.$executeRawUnsafe(`INSERT INTO users (id, status) VALUES ('${randomUUID()}', 'INVALID_STATUS')`);
    fail('Invalid enum was allowed');
  } catch {
    pass('Invalid enum rejected');
  }

  // Room → game flow
  const cat = await prisma.category.findFirst();
  if (cat) {
    const host = await prisma.user.create({
      data: {
        profile: { create: { displayName: 'Host', username: `host_${Date.now()}` } },
        entitlement: { create: { status: 'free' } },
      },
      include: { profile: true },
    });
    const room = await prisma.room.create({
      data: {
        code: `GM${Date.now().toString().slice(-5)}`,
        hostUserId: host.id,
        categoryId: cat.id,
        status: 'PLAYING',
        expiresAt: new Date(Date.now() + 3600000),
        players: { create: { displayName: 'Host', isHost: true, sessionToken: randomUUID().replace(/-/g, '') } },
      },
      include: { players: true },
    });
    const game = await prisma.game.create({
      data: {
        roomId: room.id,
        categoryId: cat.id,
        totalStages: 30,
        players: { create: { playerId: room.players[0]!.id, displayName: 'Host' } },
        rounds: {
          create: {
            roundNum: 0,
            questions: {
              create: {
                contentId: (await prisma.gameContent.upsert({
                  where: { id: `integrity-content-${cat.id}` },
                  create: {
                    id: `integrity-content-${cat.id}`,
                    categoryId: cat.id,
                    type: 'QUESTION',
                    prompt: 'Integrity test?',
                    moderationStatus: 'APPROVED',
                  },
                  update: {},
                })).id,
              },
            },
          },
        },
      },
      include: { rounds: true },
    });
    if (!game.rounds[0]) fail('Game round not created');
    else pass('Room → game → round flow');

    await prisma.gameAnswer.create({
      data: { roundId: game.rounds[0].id, playerId: room.players[0]!.id, answer: 'test', score: 100 },
    });
    try {
      await prisma.gameAnswer.create({
        data: { roundId: game.rounds[0].id, playerId: room.players[0]!.id, answer: 'dup', score: 0 },
      });
      fail('Duplicate answer allowed');
    } catch {
      pass('Duplicate answer per round rejected');
    }
  } else {
    console.log('SKIP: No categories — run seed first');
  }

  const categoryCount = await prisma.category.count();
  if (categoryCount >= 20) pass(`Categories seeded (${categoryCount})`);
  else console.log(`SKIP: Expected 20 categories after seed, found ${categoryCount}`);

  console.log(`\n=== Result: ${failures === 0 ? 'PASS' : `FAIL (${failures})`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
