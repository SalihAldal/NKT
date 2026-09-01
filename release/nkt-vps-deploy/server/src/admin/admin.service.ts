import { prisma } from '../database/prisma.js';
import type { Prisma } from '@prisma/client';

export async function writeAuditLog(data: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  requestId: string;
}) {
  return prisma.auditLog.create({
    data: {
      adminId: data.adminId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      before: data.before as Prisma.InputJsonValue | undefined,
      after: data.after as Prisma.InputJsonValue | undefined,
      requestId: data.requestId,
    },
  });
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  return { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getDashboardStats(range: 'today' | '7d' | '30d' | '90d' = '7d') {
  const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const since = new Date(Date.now() - days * 86400000);
  const dauSince = new Date(Date.now() - 86400000);

  const [
    totalUsers,
    dau,
    premiumUsers,
    roomsActive,
    reportsPending,
    totalContent,
    activeContent,
    draftContent,
    reviewContent,
    rejectedContent,
    premiumContent,
    freeContent,
    adult18Content,
    categoriesBelowTarget,
    reviewQueueCount,
    avgQuality,
    quizzesCreated,
    quizzesSolved,
    gamesActive,
    gamesCompleted,
    subscriptionsActive,
    purchasesTotal,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: dauSince }, status: { not: 'DELETED' } } }),
    prisma.user.count({ where: { isPremium: true, status: { not: 'DELETED' } } }),
    prisma.room.count({ where: { status: { in: ['LOBBY', 'PLAYING'] } } }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'INVESTIGATING'] } } }),
    prisma.gameContent.count(),
    prisma.gameContent.count({ where: { active: true, moderationStatus: { in: ['APPROVED', 'ACTIVE'] } } }),
    prisma.gameContent.count({ where: { moderationStatus: 'DRAFT' } }),
    prisma.gameContent.count({ where: { moderationStatus: 'REVIEW' } }),
    prisma.gameContent.count({ where: { moderationStatus: 'REJECTED' } }),
    prisma.gameContent.count({ where: { premium: true } }),
    prisma.gameContent.count({ where: { premium: false } }),
    prisma.gameContent.count({ where: { ageRating: '18+' } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count FROM categories c
      LEFT JOIN (SELECT category_id, COUNT(*) as cnt FROM game_contents GROUP BY category_id) gc ON gc.category_id = c.id
      WHERE COALESCE(gc.cnt, 0) < c.minimum_content_target
    `.then((r) => Number(r[0]?.count ?? 0)),
    prisma.gameContent.count({ where: { moderationStatus: 'REVIEW' } }),
    prisma.gameContent.aggregate({ _avg: { qualityScore: true } }),
    prisma.quiz.count({ where: { status: { not: 'DELETED' } } }),
    prisma.quizResult.count(),
    prisma.game.count({ where: { status: 'ACTIVE' } }),
    prisma.game.count({ where: { status: 'COMPLETED' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.purchase.count({ where: { state: 'COMPLETED' } }),
  ]);

  return {
    totalUsers,
    dau,
    quizzesCreated,
    quizzesSolved,
    roomsActive,
    premiumUsers,
    aiUsage: await prisma.contentBatch.count({ where: { createdAt: { gte: since } } }),
    reportsPending,
    totalContent,
    categoriesBelowTarget,
    activeContent,
    draftContent,
    reviewContent,
    rejectedContent,
    premiumContent,
    freeContent,
    adult18Content,
    averageQualityScore: Math.round(avgQuality._avg.qualityScore ?? 0),
    reviewQueueCount,
    contentVersion: '2026.1',
    gamesActive,
    gamesCompleted,
    subscriptionsActive,
    purchasesTotal,
  };
}

export async function listCategoriesWithCounts() {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  const counts = await prisma.gameContent.groupBy({
    by: ['categoryId'],
    _count: { id: true },
    _avg: { qualityScore: true },
  });
  const reviewCounts = await prisma.gameContent.groupBy({
    by: ['categoryId'],
    where: { moderationStatus: 'REVIEW' },
    _count: { id: true },
  });
  const countMap = new Map(counts.map((c) => [c.categoryId, c._count.id]));
  const reviewMap = new Map(reviewCounts.map((c) => [c.categoryId, c._count.id]));
  const avgMap = new Map(counts.map((c) => [c.categoryId, Math.round(c._avg.qualityScore ?? 0)]));

  return categories.map((cat) => {
    const contentCount = countMap.get(cat.id) ?? 0;
    const progress = Math.min(100, Math.round((contentCount / cat.minimumContentTarget) * 100));
    return {
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      order: cat.order,
      isFree: cat.isFree,
      isActive: cat.isActive,
      contentCount,
      minimumContentTarget: cat.minimumContentTarget,
      ageRating: cat.ageRating,
      warning: contentCount < cat.minimumContentTarget,
      progress,
      incomplete: contentCount < cat.minimumContentTarget,
      qualityScore: avgMap.get(cat.id) ?? 0,
      reviewQueue: reviewMap.get(cat.id) ?? 0,
    };
  });
}

export async function listUsers(params: { page: number; pageSize: number; search?: string; status?: string }) {
  const where: Prisma.UserWhereInput = { status: { not: 'DELETED' } };
  if (params.status) where.status = params.status.toUpperCase() as Prisma.EnumUserStatusFilter['equals'];
  if (params.search) {
    where.OR = [
      { profile: { username: { contains: params.search.toLowerCase() } } },
      { profile: { displayName: { contains: params.search, mode: 'insensitive' } } },
      { id: params.search },
    ];
  }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        profile: true,
        identities: { where: { provider: 'EMAIL' }, take: 1 },
        _count: { select: { quizzes: true, gamePlayers: true, friendshipsSent: true } },
      },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  const items = users.map((u) => ({
    id: u.id,
    displayName: u.profile?.displayName ?? 'Unknown',
    email: u.identities[0]?.email ?? '',
    username: u.profile?.username ?? '',
    status: u.status.toLowerCase(),
    isPremium: u.isPremium,
    accountType: u.accountType.toLowerCase(),
    quizzesCreated: u._count.quizzes,
    gamesPlayed: u._count.gamePlayers,
    friendsCount: u._count.friendshipsSent,
    warningCount: u.warningCount,
    contentRestricted: u.contentRestricted,
    joinedAt: u.createdAt.toISOString(),
    lastActiveAt: u.lastActiveAt.toISOString(),
  }));

  return { items, ...paginationMeta(total, params.page, params.pageSize) };
}

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      entitlement: true,
      identities: true,
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 5 },
      supportTickets: { orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { quizzes: true, gamePlayers: true, reportsSent: true } },
    },
  });
  if (!user || user.status === 'DELETED') return null;
  return {
    id: user.id,
    displayName: user.profile?.displayName ?? '',
    username: user.profile?.username ?? '',
    email: user.identities.find((i) => i.provider === 'EMAIL')?.email ?? '',
    status: user.status.toLowerCase(),
    isPremium: user.isPremium,
    accountType: user.accountType.toLowerCase(),
    warningCount: user.warningCount,
    contentRestricted: user.contentRestricted,
    joinedAt: user.createdAt.toISOString(),
    lastActiveAt: user.lastActiveAt.toISOString(),
    entitlement: user.entitlement,
    subscriptions: user.subscriptions,
    recentTickets: user.supportTickets,
    quizzesCreated: user._count.quizzes,
    gamesPlayed: user._count.gamePlayers,
    reportsSent: user._count.reportsSent,
  };
}

export async function listContent(params: {
  page: number;
  pageSize: number;
  categoryId?: string;
  search?: string;
  type?: string;
  difficulty?: number;
  premium?: boolean;
  active?: boolean;
  moderationStatus?: string;
  reviewQueue?: boolean;
}) {
  const where: Prisma.GameContentWhereInput = {};
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.search) where.prompt = { contains: params.search, mode: 'insensitive' };
  if (params.type) where.type = params.type.toUpperCase() as Prisma.EnumContentTypeFilter['equals'];
  if (params.difficulty !== undefined) where.difficulty = params.difficulty;
  if (params.premium !== undefined) where.premium = params.premium;
  if (params.active !== undefined) where.active = params.active;
  if (params.moderationStatus) where.moderationStatus = params.moderationStatus.toUpperCase() as Prisma.EnumContentModerationStatusFilter['equals'];
  if (params.reviewQueue) where.moderationStatus = 'REVIEW';

  const [items, total] = await Promise.all([
    prisma.gameContent.findMany({
      where,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.gameContent.count({ where }),
  ]);

  return {
    items: items.map(mapContentDto),
    ...paginationMeta(total, params.page, params.pageSize),
  };
}

function mapContentDto(c: {
  id: string; categoryId: string; type: string; difficulty: number; prompt: string;
  premium: boolean; active: boolean; moderationStatus: string; usageCount: number;
  reportCount: number; ageRating: string; qualityScore: number; aiGenerated: boolean; contentVersion: string;
}) {
  return {
    id: c.id,
    categoryId: c.categoryId,
    type: c.type.toLowerCase(),
    difficulty: c.difficulty,
    prompt: c.prompt,
    premium: c.premium,
    active: c.active,
    moderationStatus: c.moderationStatus.toLowerCase(),
    qualityStatus: c.moderationStatus === 'ACTIVE' || c.moderationStatus === 'APPROVED' ? 'active' : c.moderationStatus.toLowerCase(),
    usageCount: c.usageCount,
    completionCount: 0,
    reportCount: c.reportCount,
    ageRating: c.ageRating,
    qualityScore: c.qualityScore,
    aiGenerated: c.aiGenerated,
    contentVersion: c.contentVersion,
  };
}

export async function moderateContent(adminId: string, contentId: string, action: 'approve' | 'reject' | 'hide', requestId: string) {
  const statusMap = { approve: 'APPROVED', reject: 'REJECTED', hide: 'DISABLED' } as const;
  const before = await prisma.gameContent.findUnique({ where: { id: contentId } });
  if (!before) return null;
  const updated = await prisma.gameContent.update({
    where: { id: contentId },
    data: { moderationStatus: statusMap[action], active: action === 'approve' },
  });
  await writeAuditLog({
    adminId,
    action: `content.${action}`,
    targetType: 'content',
    targetId: contentId,
    before: { moderationStatus: before.moderationStatus },
    after: { moderationStatus: updated.moderationStatus },
    requestId,
  });
  return mapContentDto(updated);
}

export async function listRooms(params: { page: number; pageSize: number; status?: string }) {
  const where: Prisma.RoomWhereInput = {};
  if (params.status) where.status = params.status.toUpperCase() as Prisma.EnumRoomStatusFilter['equals'];
  const [rooms, total] = await Promise.all([
    prisma.room.findMany({
      where,
      include: { players: { where: { leftAt: null } }, host: { include: { profile: true } } },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.room.count({ where }),
  ]);
  return {
    items: rooms.map((r) => ({
      id: r.id,
      code: r.code,
      hostUserId: r.hostUserId,
      hostName: r.host.profile?.displayName ?? r.hostUserId,
      state: r.status.toLowerCase(),
      status: r.status.toLowerCase(),
      isPremiumRoom: r.isPremiumRoom,
      playerCount: r.players.length,
      maxPlayers: r.maxPlayers,
      categoryId: r.categoryId,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    })),
    ...paginationMeta(total, params.page, params.pageSize),
  };
}

export async function getRoomDetail(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      players: { where: { leftAt: null } },
      games: { orderBy: { startedAt: 'desc' }, take: 1, include: { scores: true, players: true } },
      category: true,
      host: { include: { profile: true } },
    },
  });
  if (!room) return null;
  return room;
}

export async function listGames(params: { page: number; pageSize: number; status?: string }) {
  const where: Prisma.GameWhereInput = {};
  if (params.status) where.status = params.status.toUpperCase() as Prisma.EnumGameStatusFilter['equals'];
  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      include: { players: true, scores: true, room: true, category: true },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { startedAt: 'desc' },
    }),
    prisma.game.count({ where }),
  ]);
  return {
    items: games.map((g) => ({
      id: g.id,
      roomId: g.roomId,
      roomCode: g.room.code,
      categoryName: g.category.name,
      status: g.status.toLowerCase(),
      playerCount: g.players.length,
      currentStage: g.currentStage,
      totalStages: g.totalStages,
      startedAt: g.startedAt.toISOString(),
      completedAt: g.completedAt?.toISOString(),
      scores: g.scores.map((s) => ({
        userId: g.players.find((p) => p.playerId === s.playerId)?.userId ?? s.playerId,
        name: g.players.find((p) => p.playerId === s.playerId)?.displayName ?? s.playerId.slice(0, 8),
        score: s.score,
        rank: s.rank,
      })),
    })),
    ...paginationMeta(total, params.page, params.pageSize),
  };
}

export async function getGameDetail(gameId: string) {
  return prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
      scores: { orderBy: { rank: 'asc' } },
      rounds: { include: { questions: { include: { content: true } }, answers: true }, orderBy: { roundNum: 'asc' } },
      room: true,
      category: true,
    },
  });
}

export async function listReports(params: { page: number; pageSize: number; status?: string; priority?: string }) {
  const where: Prisma.ReportWhereInput = {};
  if (params.status) where.status = params.status.toUpperCase() as Prisma.EnumReportStatusFilter['equals'];
  if (params.priority) where.priority = params.priority.toUpperCase() as Prisma.EnumReportPriorityFilter['equals'];
  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: { reporter: { include: { profile: true } } },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.report.count({ where }),
  ]);
  return {
    items: items.map((r) => ({
      id: r.id,
      type: r.targetType,
      reporterId: r.reporterId,
      reporterName: r.reporter.profile?.displayName ?? r.reporterId,
      targetId: r.targetId,
      reason: r.reason,
      status: r.status.toLowerCase(),
      priority: r.priority.toLowerCase(),
      createdAt: r.createdAt.toISOString(),
    })),
    ...paginationMeta(total, params.page, params.pageSize),
  };
}

export async function listPurchases(params: { page: number; pageSize: number; state?: string }) {
  const where: Prisma.PurchaseWhereInput = {};
  if (params.state) where.state = params.state.toUpperCase() as Prisma.EnumPurchaseStateFilter['equals'];
  const [items, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: { user: { include: { profile: true } } },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.purchase.count({ where }),
  ]);
  return {
    items: items.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.profile?.displayName ?? p.userId,
      productId: p.productId,
      platform: p.platform,
      transactionId: p.transactionId,
      state: p.state.toLowerCase(),
      createdAt: p.createdAt.toISOString(),
    })),
    ...paginationMeta(total, params.page, params.pageSize),
  };
}

export async function listSubscriptions(params: { page: number; pageSize: number; status?: string }) {
  const where: Prisma.SubscriptionWhereInput = {};
  if (params.status) where.status = params.status.toUpperCase() as Prisma.EnumSubscriptionStatusFilter['equals'];
  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: { user: { include: { profile: true } } },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subscription.count({ where }),
  ]);
  return {
    items: items.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user.profile?.displayName ?? s.userId,
      productId: s.productId,
      provider: s.provider,
      status: s.status.toLowerCase(),
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    })),
    ...paginationMeta(total, params.page, params.pageSize),
  };
}

export async function getRevenueStats() {
  const [activePremium, weekly, monthly, expired, purchases, restores] = await Promise.all([
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', productId: { contains: 'weekly' } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', productId: { contains: 'monthly' } } }),
    prisma.subscription.count({ where: { status: 'EXPIRED' } }),
    prisma.purchase.count({ where: { state: 'COMPLETED' } }),
    prisma.purchase.count({ where: { state: 'DUPLICATE' } }),
  ]);
  const totalUsers = await prisma.user.count({ where: { status: { not: 'DELETED' } } });
  return {
    activePremium,
    weeklySubscribers: weekly,
    monthlySubscribers: monthly,
    expired,
    conversionRate: totalUsers > 0 ? Math.round((activePremium / totalUsers) * 1000) / 10 : 0,
    purchases,
    restoreCount: restores,
    adImpressions: 0,
    rewardedCompletions: 0,
    weeklyProductActive: true,
    monthlyProductActive: true,
    adsEnabled: (await prisma.featureFlag.findUnique({ where: { key: 'ads' } }))?.enabled ?? false,
    rewardedEnabled: true,
  };
}

export async function listNotifications(params: { page: number; pageSize: number }) {
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      include: { user: { include: { profile: true } } },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count(),
  ]);
  return {
    items: items.map((n) => ({
      id: n.id,
      userId: n.userId,
      userName: n.user.profile?.displayName ?? n.userId,
      type: n.type.toLowerCase(),
      title: n.title,
      body: n.body,
      readAt: n.readAt?.toISOString(),
      createdAt: n.createdAt.toISOString(),
    })),
    ...paginationMeta(total, params.page, params.pageSize),
  };
}

export async function getAnalytics(range: 'today' | '7d' | '30d' | '90d' = '7d') {
  const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const since = new Date(Date.now() - days * 86400000);
  const [events, rooms, games, signups, premiumConversions] = await Promise.all([
    prisma.analyticsEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.room.count({ where: { createdAt: { gte: since } } }),
    prisma.game.count({ where: { startedAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.subscription.count({ where: { createdAt: { gte: since }, status: 'ACTIVE' } }),
  ]);
  return {
    range,
    events,
    roomsCreated: rooms,
    gamesPlayed: games,
    newUsers: signups,
    premiumConversions,
    retention7d: 0,
    retention30d: 0,
  };
}

export async function listSupportTickets(params: { page: number; pageSize: number; status?: string }) {
  const where: Prisma.SupportTicketWhereInput = {};
  if (params.status) where.status = params.status.toUpperCase() as Prisma.EnumSupportStatusFilter['equals'];
  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: { user: { include: { profile: true } } },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supportTicket.count({ where }),
  ]);
  return {
    items: items.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: t.user.profile?.displayName ?? t.userId,
      category: t.category,
      message: t.message,
      status: t.status.toLowerCase(),
      priority: t.priority.toLowerCase(),
      createdAt: t.createdAt.toISOString(),
    })),
    ...paginationMeta(total, params.page, params.pageSize),
  };
}

export async function listFeatureFlags() {
  return prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
}

export async function getSystemHealth() {
  const checkedAt = new Date().toISOString();
  const checks: Array<{ service: string; status: 'PASS' | 'WARNING' | 'FAIL'; message: string; checkedAt: string }> = [];
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - dbStart;
    checks.push({
      service: 'database',
      status: latency > 500 ? 'WARNING' : 'PASS',
      message: `PostgreSQL OK (${latency}ms)`,
      checkedAt,
    });
  } catch {
    checks.push({ service: 'database', status: 'FAIL', message: 'PostgreSQL unreachable', checkedAt });
  }
  return checks;
}

export async function listQuizzes(params: { page: number; pageSize: number; search?: string; status?: string }) {
  const where: Prisma.QuizWhereInput = { status: { not: 'DELETED' } };
  if (params.status) where.status = params.status.toUpperCase() as Prisma.EnumQuizStatusFilter['equals'];
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { owner: { profile: { displayName: { contains: params.search, mode: 'insensitive' } } } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.quiz.findMany({
      where,
      include: {
        owner: { include: { profile: true } },
        _count: { select: { questions: true, results: true } },
      },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quiz.count({ where }),
  ]);
  return {
    items: items.map((q) => ({
      id: q.id,
      ownerId: q.ownerId,
      ownerName: q.owner.profile?.displayName ?? q.ownerId,
      title: q.title,
      status: q.status.toLowerCase(),
      visibility: q.visibility.toLowerCase(),
      questionCount: q._count.questions,
      completionCount: q._count.results,
      createdAt: q.createdAt.toISOString(),
    })),
    ...paginationMeta(total, params.page, params.pageSize),
  };
}

export async function getSocialStats() {
  const since = new Date(Date.now() - 86400000);
  const [
    dailyFriendRequests,
    acceptedFriendships,
    totalFriendRequests,
    totalFriendships,
    blockedUsers,
    pendingReports,
    activeSocialUsers,
    notificationsSent,
    notificationsRead,
  ] = await Promise.all([
    prisma.friendship.count({ where: { createdAt: { gte: since } } }),
    prisma.friendship.count({ where: { status: 'ACCEPTED' } }),
    prisma.friendship.count(),
    prisma.friendship.count({ where: { status: 'ACCEPTED' } }),
    prisma.friendBlock.count(),
    prisma.report.count({ where: { status: { in: ['OPEN', 'INVESTIGATING'] } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: since }, status: { not: 'DELETED' } } }),
    prisma.notification.count({ where: { createdAt: { gte: since } } }),
    prisma.notification.count({ where: { readAt: { not: null }, createdAt: { gte: since } } }),
  ]);
  return {
    dailyFriendRequests,
    acceptanceRate: totalFriendRequests > 0 ? acceptedFriendships / totalFriendRequests : 0,
    inviteConversion: 0,
    roomInviteConversion: 0,
    quizShareConversion: 0,
    activeSocialUsers,
    viralCoefficient: totalFriendships > 0 ? dailyFriendRequests / totalFriendships : 0,
    notificationOpenRate: notificationsSent > 0 ? notificationsRead / notificationsSent : 0,
    totalFriendships,
    pendingInvitations: await prisma.friendship.count({ where: { status: 'PENDING' } }),
    blockedUsers,
    pendingReports,
  };
}

export async function getContentAnalytics() {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  const stats = await prisma.gameContent.groupBy({
    by: ['categoryId'],
    _count: { id: true },
    _avg: { qualityScore: true, usageCount: true, reportCount: true },
  });
  const map = new Map(stats.map((s) => [s.categoryId, s]));
  return categories.map((cat) => {
    const s = map.get(cat.id);
    const contentCount = s?._count.id ?? 0;
    const avgUsage = s?._avg.usageCount ?? 0;
    const avgReports = s?._avg.reportCount ?? 0;
    return {
      categoryId: cat.id,
      name: cat.name,
      contentCount,
      completionRate: avgUsage > 0 ? 0.65 : 0,
      skipRate: 0.1,
      reportRate: contentCount > 0 ? avgReports / contentCount : 0,
      quality: Math.round(s?._avg.qualityScore ?? 0),
    };
  });
}

export async function listContentBatches() {
  return prisma.contentBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
}

export async function listModerationQueue() {
  const [reports, customCategories] = await Promise.all([
    prisma.report.findMany({
      where: { status: { in: ['OPEN', 'INVESTIGATING'] } },
      include: { reporter: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.customCategory.findMany({ where: { status: 'REVIEW' }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  return {
    reports: reports.map((r) => ({
      id: r.id,
      reporterId: r.reporterId,
      reporterName: r.reporter.profile?.displayName ?? r.reporterId,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      description: r.description ?? '',
      status: r.status.toLowerCase(),
      priority: r.priority.toLowerCase(),
      createdAt: r.createdAt.toISOString(),
    })),
    customCategories: customCategories.map((c) => ({
      id: c.id,
      ownerId: c.ownerId,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function moderateCustomCategory(adminId: string, id: string, action: 'approve' | 'reject', requestId: string) {
  const status = action === 'approve' ? 'APPROVED' : 'DISABLED';
  const updated = await prisma.customCategory.update({ where: { id }, data: { status } });
  await writeAuditLog({
    adminId,
    action: `custom_category.${action}`,
    targetType: 'custom_category',
    targetId: id,
    after: { status },
    requestId,
  });
  return updated;
}
