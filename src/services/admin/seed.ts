import type {
  AdminAccount,
  AdminGameRecord,
  AdminPurchaseRecord,
  AdminQuizRecord,
  AdminReport,
  AdminRoomRecord,
  AdminSubscriptionRecord,
  AdminUserRecord,
  FeatureFlag,
  SupportTicket,
} from './types';

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

function hashPassword(password: string): string {
  return `hash:${password}`;
}

export const SEED_ADMINS: AdminAccount[] = [
  {
    id: 'admin-super',
    email: 'super@nkt.app',
    displayName: 'Super Admin',
    role: 'SUPER_ADMIN',
    passwordHash: hashPassword('super123'),
    isActive: true,
    createdAt: daysAgo(365),
  },
  {
    id: 'admin-mod',
    email: 'mod@nkt.app',
    displayName: 'Moderator',
    role: 'MODERATOR',
    passwordHash: hashPassword('mod123'),
    isActive: true,
    createdAt: daysAgo(180),
  },
  {
    id: 'admin-support',
    email: 'support@nkt.app',
    displayName: 'Support Agent',
    role: 'SUPPORT',
    passwordHash: hashPassword('support123'),
    isActive: true,
    createdAt: daysAgo(90),
  },
  {
    id: 'admin-analyst',
    email: 'analyst@nkt.app',
    displayName: 'Analyst',
    role: 'ANALYST',
    passwordHash: hashPassword('analyst123'),
    isActive: true,
    createdAt: daysAgo(60),
  },
];

export function seedUsers(count = 120): AdminUserRecord[] {
  const names = ['Salih', 'Ahmet', 'Zeynep', 'Mehmet', 'Ayşe', 'Can', 'Elif', 'Burak'];
  const surnames = ['Aydın', 'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Öztürk'];
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${i + 1}`,
    displayName: `${names[i % names.length]} ${surnames[i % surnames.length]}`,
    username: `user${i + 1}`,
    email: `user${i + 1}@nkt.app`,
    accountType: i % 15 === 0 ? 'guest_linked' : 'registered',
    isPremium: i % 7 === 0,
    status: i % 23 === 0 ? 'suspended' : i % 11 === 0 ? 'warned' : 'active',
    warningCount: i % 11 === 0 ? 1 : 0,
    contentRestricted: i % 31 === 0,
    inviteRestricted: i % 37 === 0,
    roomRestricted: false,
    quizzesCreated: Math.floor(Math.random() * 15),
    quizzesCompleted: Math.floor(Math.random() * 40),
    gamesPlayed: Math.floor(Math.random() * 25),
    friendsCount: Math.floor(Math.random() * 30),
    createdAt: daysAgo(i + 1),
    lastActiveAt: daysAgo(i % 7),
    reportedCount: i % 19 === 0 ? 2 : 0,
  }));
}

export function seedRooms(users: AdminUserRecord[]): AdminRoomRecord[] {
  return Array.from({ length: 15 }, (_, i) => {
    const host = users[i % users.length]!;
    const statuses: AdminRoomRecord['status'][] = ['lobby', 'playing', 'completed', 'expired'];
    return {
      id: `room-${i + 1}`,
      code: `NKT${String(100 + i).slice(-3)}`,
      hostUserId: host.id,
      hostName: host.displayName,
      playerCount: 2 + (i % 5),
      maxPlayers: 8,
      isPremiumRoom: i % 4 === 0,
      categoryId: `cat-${i % 20}`,
      categoryName: ['Korku', 'Parti', '+18', 'Film & Dizi'][i % 4],
      status: statuses[i % statuses.length]!,
      createdAt: daysAgo(i),
      updatedAt: daysAgo(i % 3),
      expiresAt: new Date(Date.now() + (i % 3 === 0 ? -3600000 : 3600000)).toISOString(),
      gameId: i % 2 === 0 ? `game-${i + 1}` : undefined,
    };
  });
}

export function seedGames(rooms: AdminRoomRecord[]): AdminGameRecord[] {
  return rooms.filter((r) => r.gameId).map((r, i) => ({
    id: r.gameId!,
    roomId: r.id,
    categoryId: r.categoryId ?? 'cat-1',
    categoryName: r.categoryName ?? 'Korku',
    status: r.status === 'completed' ? 'completed' : 'active',
    currentStage: r.status === 'completed' ? 5 : 2 + (i % 3),
    totalStages: 5,
    playerCount: r.playerCount,
    scores: Array.from({ length: r.playerCount }, (_, j) => ({
      userId: `user-${j + 1}`,
      name: `Oyuncu ${j + 1}`,
      score: 100 - j * 15,
      rank: j + 1,
    })),
    startedAt: r.createdAt,
    completedAt: r.status === 'completed' ? r.updatedAt : undefined,
  }));
}

export function seedQuizzes(users: AdminUserRecord[]): AdminQuizRecord[] {
  return Array.from({ length: 40 }, (_, i) => {
    const owner = users[i % users.length]!;
    return {
      id: `quiz-${i + 1}`,
      ownerId: owner.id,
      ownerName: owner.displayName,
      title: `Test ${i + 1}: ${owner.displayName} quiz`,
      category: ['Korku', 'Parti', 'Aşk & İlişkiler'][i % 3],
      status: i % 5 === 0 ? 'draft' : i % 7 === 0 ? 'private' : 'published',
      visibility: i % 7 === 0 ? 'private' : 'public',
      completionCount: Math.floor(Math.random() * 80),
      reportCount: i % 13 === 0 ? 1 : 0,
      createdAt: daysAgo(i),
    };
  });
}

export function seedReports(users: AdminUserRecord[]): AdminReport[] {
  const reasons = ['spam', 'abuse', 'inappropriate', 'harassment', 'cheating'];
  const priorities: AdminReport['priority'][] = ['low', 'medium', 'high', 'critical'];
  const statuses: AdminReport['status'][] = ['open', 'investigating', 'resolved', 'rejected'];
  return Array.from({ length: 25 }, (_, i) => ({
    id: `report-${i + 1}`,
    reporterId: users[i % users.length]!.id,
    reporterName: users[i % users.length]!.displayName,
    targetType: (['user', 'quiz', 'content', 'room'] as const)[i % 4]!,
    targetId: `target-${i + 1}`,
    reason: reasons[i % reasons.length]!,
    description: `Rapor açıklaması #${i + 1}`,
    status: statuses[i % statuses.length]!,
    priority: priorities[i % priorities.length]!,
    createdAt: daysAgo(i),
    resolvedAt: i % 4 === 2 ? daysAgo(i - 1) : undefined,
  }));
}

export function seedSupport(users: AdminUserRecord[]): SupportTicket[] {
  const cats: SupportTicket['category'][] = ['account', 'payment', 'premium', 'room', 'bug', 'other'];
  return Array.from({ length: 20 }, (_, i) => ({
    id: `ticket-${i + 1}`,
    userId: users[i % users.length]!.id,
    userName: users[i % users.length]!.displayName,
    category: cats[i % cats.length]!,
    message: `Destek talebi mesajı #${i + 1}`,
    status: (['open', 'pending', 'resolved', 'closed'] as const)[i % 4]!,
    priority: (['low', 'medium', 'high'] as const)[i % 3]!,
    notes: i % 3 === 0 ? ['İlk inceleme yapıldı'] : [],
    createdAt: daysAgo(i),
    updatedAt: daysAgo(i % 2),
  }));
}

export function seedSubscriptions(users: AdminUserRecord[]): AdminSubscriptionRecord[] {
  return users.filter((u) => u.isPremium).slice(0, 30).map((u, i) => ({
    id: `sub-${i + 1}`,
    userId: u.id,
    userName: u.displayName,
    productId: i % 2 === 0 ? 'com.nkt.app.premium.monthly' : 'com.nkt.app.premium.weekly',
    status: (['active', 'expired', 'grace'] as const)[i % 3]!,
    provider: (['ios', 'android'] as const)[i % 2]!,
    expiresAt: new Date(Date.now() + (i % 3 === 1 ? -86400000 : 30 * 86400000)).toISOString(),
    createdAt: daysAgo(i + 10),
  }));
}

export function seedPurchases(users: AdminUserRecord[]): AdminPurchaseRecord[] {
  return Array.from({ length: 50 }, (_, i) => {
    const u = users[i % users.length]!;
    return {
      id: `purchase-${i + 1}`,
      userId: u.id,
      userName: u.displayName,
      productId: i % 2 === 0 ? 'com.nkt.app.premium.monthly' : 'com.nkt.app.premium.weekly',
      platform: (['ios', 'android'] as const)[i % 2]!,
      state: i % 17 === 0 ? 'duplicate' : (['completed', 'pending', 'failed', 'refunded'] as const)[i % 4]!,
      createdAt: daysAgo(i),
      updatedAt: daysAgo(i % 3),
    };
  });
}

export const SEED_FEATURE_FLAGS: FeatureFlag[] = [
  { key: 'friend_room', label: 'Arkadaş Ortamı', enabled: true, environment: 'all', updatedAt: now() },
  { key: 'premium', label: 'Premium', enabled: true, environment: 'all', updatedAt: now() },
  { key: 'ai_generation', label: 'AI İçerik Üretimi', enabled: true, environment: 'all', updatedAt: now() },
  { key: 'ads', label: 'Reklamlar', enabled: true, environment: 'all', updatedAt: now() },
  { key: 'custom_category', label: 'Özel Kategori', enabled: true, environment: 'all', updatedAt: now() },
  { key: 'adult_18', label: '+18 İçerik', enabled: true, environment: 'all', updatedAt: now() },
  { key: 'leaderboard', label: 'Leaderboard', enabled: true, environment: 'all', updatedAt: now() },
  { key: 'notifications', label: 'Bildirimler', enabled: true, environment: 'all', updatedAt: now() },
];

export { hashPassword };
