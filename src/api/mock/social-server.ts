/**
 * In-memory social graph server — source of truth for friendships, invites, activities.
 * Production would be a backend service; client never authorizes social actions alone.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  FRIENDSHIP_STATUS,
  INVITATION_STATUS,
  INVITATION_TYPE,
  NOTIFICATION_TYPE,
  PROFILE_VISIBILITY,
  ACTIVITY_TYPE,
} from '@/domain/constants/enums';
import type {
  Friendship,
  Invitation,
  SocialActivity,
  PrivacySettings,
  FriendProfile,
  FriendSuggestion,
  UserSearchResult,
} from '@/domain/models/social';
import { SOCIAL_CONFIG } from '@config/social';
import { moderationService } from '@/services/moderation/moderation.service';
import type { Notification } from '@/domain/models/moderation';

// ─── Seed users ───────────────────────────────────────────────────────────────

interface SeedUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  quizzesCompleted: number;
  gamesPlayed: number;
  winRate: number;
}

const SEED_USERS: SeedUser[] = [
  { id: 'user-1', displayName: 'Salih Aydın', username: 'salihaydin', quizzesCompleted: 28, gamesPlayed: 12, winRate: 0.65 },
  { id: 'user-2', displayName: 'Ahmet Yılmaz', username: 'ahmet', quizzesCompleted: 15, gamesPlayed: 8, winRate: 0.72 },
  { id: 'user-3', displayName: 'Zeynep Kaya', username: 'zeynep', quizzesCompleted: 22, gamesPlayed: 10, winRate: 0.58 },
  { id: 'user-4', displayName: 'Mehmet Demir', username: 'mehmet', quizzesCompleted: 18, gamesPlayed: 15, winRate: 0.81 },
  { id: 'user-5', displayName: 'Ayşe Çelik', username: 'ayse', quizzesCompleted: 10, gamesPlayed: 5, winRate: 0.45 },
  { id: 'user-6', displayName: 'Can Öztürk', username: 'can', quizzesCompleted: 30, gamesPlayed: 20, winRate: 0.55 },
  { id: 'user-7', displayName: 'Elif Arslan', username: 'elif', quizzesCompleted: 8, gamesPlayed: 3, winRate: 0.40 },
  { id: 'user-8', displayName: 'Burak Şahin', username: 'burak', quizzesCompleted: 12, gamesPlayed: 7, winRate: 0.60 },
];

// ─── State ────────────────────────────────────────────────────────────────────

const friendships: Friendship[] = [];
const invitations: Invitation[] = [];
const activities: SocialActivity[] = [];
const privacySettings = new Map<string, PrivacySettings>();
const notifications: Notification[] = [];
const hiddenSuggestions = new Map<string, Set<string>>();
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

// ─── Rate limiting ────────────────────────────────────────────────────────────

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUser(userId: string): SeedUser | undefined {
  return SEED_USERS.find((u) => u.id === userId);
}

function getPrivacy(userId: string): PrivacySettings {
  const existing = privacySettings.get(userId);
  if (existing) return existing;
  const defaults: PrivacySettings = {
    userId,
    profileVisibility: SOCIAL_CONFIG.defaultProfileVisibility,
    activitySharing: SOCIAL_CONFIG.defaultActivitySharing,
    discoverable: SOCIAL_CONFIG.defaultDiscoverable,
    showOnlineStatus: false,
    updatedAt: new Date().toISOString(),
  };
  privacySettings.set(userId, defaults);
  return defaults;
}

function findFriendship(a: string, b: string): Friendship | undefined {
  return friendships.find(
    (f) =>
      (f.requesterId === a && f.receiverId === b) ||
      (f.requesterId === b && f.receiverId === a),
  );
}

function isBlocked(a: string, b: string): boolean {
  return moderationService.isBlocked(a, b) || moderationService.isBlocked(b, a);
}

function getFriendshipStatus(viewerId: string, targetId: string): Friendship['status'] | 'none' {
  const f = findFriendship(viewerId, targetId);
  if (!f) return 'none';
  if (f.status === FRIENDSHIP_STATUS.REMOVED) return 'none';
  if (f.status === FRIENDSHIP_STATUS.DECLINED) return 'none';
  return f.status;
}

function areFriends(a: string, b: string): boolean {
  const f = findFriendship(a, b);
  return f?.status === FRIENDSHIP_STATUS.ACCEPTED;
}

function canViewProfile(viewerId: string, targetId: string): boolean {
  if (viewerId === targetId) return true;
  const privacy = getPrivacy(targetId);
  if (privacy.profileVisibility === PROFILE_VISIBILITY.PUBLIC) return true;
  if (privacy.profileVisibility === PROFILE_VISIBILITY.PRIVATE) return false;
  return areFriends(viewerId, targetId);
}

function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Notification {
  const n: Notification = {
    id: uuidv4(),
    userId,
    type: type as Notification['type'],
    title,
    body,
    data,
    read: false,
    createdAt: new Date().toISOString(),
  };
  notifications.push(n);
  return n;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

// ─── Social Server API ────────────────────────────────────────────────────────

export const socialServer = {
  _reset() {
    friendships.length = 0;
    invitations.length = 0;
    activities.length = 0;
    notifications.length = 0;
    privacySettings.clear();
    hiddenSuggestions.clear();
    rateLimitBuckets.clear();
  },

  // ── Friend requests ───────────────────────────────────────────────────────

  sendFriendRequest(requesterId: string, receiverId: string): Friendship {
    if (requesterId === receiverId) throw new Error('Kendine arkadaşlık isteği gönderemezsin.');
    if (!getUser(receiverId)) throw new Error('Kullanıcı bulunamadı.');
    if (isBlocked(requesterId, receiverId)) throw new Error('Bu kullanıcıya istek gönderilemez.');

    const rateKey = `friend_req:${requesterId}`;
    if (!checkRateLimit(rateKey, SOCIAL_CONFIG.friendRequestLimitPerHour, 3600000)) {
      throw new Error('Çok fazla arkadaşlık isteği gönderdin. Lütfen bekleyin.');
    }

    const existing = findFriendship(requesterId, receiverId);
    if (existing) {
      if (existing.status === FRIENDSHIP_STATUS.ACCEPTED) throw new Error('Zaten arkadaşsınız.');
      if (existing.status === FRIENDSHIP_STATUS.PENDING) throw new Error('İstek zaten gönderildi.');
      if (existing.status === FRIENDSHIP_STATUS.BLOCKED) throw new Error('Bu kullanıcıya istek gönderilemez.');
    }

    const friendship: Friendship = {
      id: uuidv4(),
      requesterId,
      receiverId,
      status: FRIENDSHIP_STATUS.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    friendships.push(friendship);

    const requester = getUser(requesterId);
    createNotification(
      receiverId,
      NOTIFICATION_TYPE.FRIEND_REQUEST,
      'Yeni arkadaşlık isteği',
      `${requester?.displayName ?? 'Birisi'} sana arkadaşlık isteği gönderdi.`,
      { friendshipId: friendship.id, requesterId },
    );

    return friendship;
  },

  acceptFriendRequest(friendshipId: string, userId: string): Friendship {
    const f = friendships.find((x) => x.id === friendshipId);
    if (!f) throw new Error('İstek bulunamadı.');
    if (f.receiverId !== userId) throw new Error('Bu isteği kabul edemezsin.');
    if (f.status !== FRIENDSHIP_STATUS.PENDING) throw new Error('İstek artık geçerli değil.');

    f.status = FRIENDSHIP_STATUS.ACCEPTED;
    f.updatedAt = new Date().toISOString();

    const accepter = getUser(userId);
    createNotification(
      f.requesterId,
      NOTIFICATION_TYPE.FRIEND_ACCEPTED,
      'Arkadaşlık isteği kabul edildi',
      `${accepter?.displayName ?? 'Birisi'} isteğini kabul etti.`,
      { friendshipId: f.id, userId },
    );

    return f;
  },

  declineFriendRequest(friendshipId: string, userId: string): Friendship {
    const f = friendships.find((x) => x.id === friendshipId);
    if (!f) throw new Error('İstek bulunamadı.');
    if (f.receiverId !== userId) throw new Error('Bu isteği reddedemezsin.');
    f.status = FRIENDSHIP_STATUS.DECLINED;
    f.updatedAt = new Date().toISOString();
    return f;
  },

  cancelFriendRequest(friendshipId: string, userId: string): void {
    const f = friendships.find((x) => x.id === friendshipId);
    if (!f) throw new Error('İstek bulunamadı.');
    if (f.requesterId !== userId) throw new Error('Bu isteği iptal edemezsin.');
    if (f.status !== FRIENDSHIP_STATUS.PENDING) throw new Error('İstek iptal edilemez.');
    f.status = FRIENDSHIP_STATUS.REMOVED;
    f.updatedAt = new Date().toISOString();
  },

  removeFriend(userId: string, friendUserId: string): void {
    const f = findFriendship(userId, friendUserId);
    if (!f || f.status !== FRIENDSHIP_STATUS.ACCEPTED) throw new Error('Arkadaş bulunamadı.');
    f.status = FRIENDSHIP_STATUS.REMOVED;
    f.updatedAt = new Date().toISOString();
  },

  listFriends(userId: string, page = 1, pageSize = SOCIAL_CONFIG.pageSize): { data: FriendProfile[]; hasMore: boolean } {
    const accepted = friendships.filter(
      (f) =>
        f.status === FRIENDSHIP_STATUS.ACCEPTED &&
        (f.requesterId === userId || f.receiverId === userId),
    );
    const start = (page - 1) * pageSize;
    const slice = accepted.slice(start, start + pageSize);

    const data = slice
      .map((f) => {
        const friendId = f.requesterId === userId ? f.receiverId : f.requesterId;
        if (isBlocked(userId, friendId)) return null;
        return this.getFriendProfile(userId, friendId);
      })
      .filter((p): p is FriendProfile => p !== null);

    return { data, hasMore: start + pageSize < accepted.length };
  },

  listPendingRequests(userId: string): Friendship[] {
    return friendships.filter(
      (f) => f.receiverId === userId && f.status === FRIENDSHIP_STATUS.PENDING,
    );
  },

  getFriendProfile(viewerId: string, targetId: string): FriendProfile | null {
    const user = getUser(targetId);
    if (!user) return null;
    if (isBlocked(viewerId, targetId)) return null;
    if (!canViewProfile(viewerId, targetId)) return null;

    const status = getFriendshipStatus(viewerId, targetId);
    return {
      userId: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      badges: [],
      quizzesCompleted: user.quizzesCompleted,
      gamesPlayed: user.gamesPlayed,
      winRate: user.winRate,
      friendshipStatus: status,
      isFriend: status === FRIENDSHIP_STATUS.ACCEPTED,
      isBlocked: false,
    };
  },

  // ── Search ────────────────────────────────────────────────────────────────

  searchUsers(query: string, searcherId: string, page = 1, pageSize = SOCIAL_CONFIG.pageSize): {
    data: UserSearchResult[];
    hasMore: boolean;
    total: number;
  } {
    const rateKey = `search:${searcherId}`;
    if (!checkRateLimit(rateKey, SOCIAL_CONFIG.searchLimitPerMinute, 60000)) {
      throw new Error('Çok fazla arama yaptın. Lütfen bekleyin.');
    }

    const q = query.toLowerCase().trim();
    if (q.length < 2) return { data: [], hasMore: false, total: 0 };

    const matches = SEED_USERS.filter((u) => {
      if (u.id === searcherId) return false;
      const privacy = getPrivacy(u.id);
      if (!privacy.discoverable) return false;
      if (isBlocked(searcherId, u.id)) return false;
      return u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    });

    const start = (page - 1) * pageSize;
    const slice = matches.slice(start, start + pageSize);

    return {
      data: slice.map((u) => ({
        userId: u.id,
        displayName: u.displayName,
        username: u.username,
        avatarUrl: u.avatarUrl,
        friendshipStatus: getFriendshipStatus(searcherId, u.id),
      })),
      hasMore: start + pageSize < matches.length,
      total: matches.length,
    };
  },

  // ── Invitations ───────────────────────────────────────────────────────────

  sendInvitation(
    senderId: string,
    receiverId: string,
    type: Invitation['type'],
    referenceId: string,
    expiryMs?: number,
  ): Invitation {
    if (isBlocked(senderId, receiverId)) throw new Error('Bu kullanıcıya davet gönderilemez.');

    const rateKey = `invite:${senderId}`;
    if (!checkRateLimit(rateKey, SOCIAL_CONFIG.inviteLimitPerHour, 3600000)) {
      throw new Error('Çok fazla davet gönderdin. Lütfen bekleyin.');
    }

    const cooldownKey = `invite_cooldown:${senderId}:${receiverId}:${type}`;
    const cooldownBucket = rateLimitBuckets.get(cooldownKey);
    if (cooldownBucket && Date.now() < cooldownBucket.resetAt) {
      throw new Error('Bu kullanıcıya kısa süre önce davet gönderdin.');
    }
    rateLimitBuckets.set(cooldownKey, { count: 1, resetAt: Date.now() + SOCIAL_CONFIG.inviteCooldownMs });

    const defaultExpiry =
      type === INVITATION_TYPE.ROOM
        ? SOCIAL_CONFIG.roomInviteExpiryMs
        : type === INVITATION_TYPE.QUIZ
          ? SOCIAL_CONFIG.quizInviteExpiryMs
          : SOCIAL_CONFIG.friendRequestExpiryMs;

    const invitation: Invitation = {
      id: uuidv4(),
      senderId,
      receiverId,
      type,
      referenceId,
      status: INVITATION_STATUS.PENDING,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (expiryMs ?? defaultExpiry)).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    invitations.push(invitation);

    const sender = getUser(senderId);
    if (type === INVITATION_TYPE.ROOM) {
      createNotification(
        receiverId,
        NOTIFICATION_TYPE.ROOM_INVITE,
        'Oda daveti',
        `${sender?.displayName ?? 'Birisi'} seni NKT odasına davet etti.`,
        { invitationId: invitation.id, code: referenceId, senderId },
      );
    } else if (type === INVITATION_TYPE.QUIZ) {
      createNotification(
        receiverId,
        NOTIFICATION_TYPE.QUIZ_RECEIVED,
        'Yeni test geldi',
        `${sender?.displayName ?? 'Birisi'} sana bir test gönderdi.`,
        { invitationId: invitation.id, quizId: referenceId, senderId },
      );
    }

    return invitation;
  },

  acceptInvitation(invitationId: string, userId: string): Invitation {
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) throw new Error('Davet bulunamadı.');
    if (inv.receiverId !== userId) throw new Error('Bu daveti kabul edemezsin.');
    if (inv.status !== INVITATION_STATUS.PENDING) throw new Error('Davet artık geçerli değil.');
    if (new Date(inv.expiresAt) < new Date()) {
      inv.status = INVITATION_STATUS.EXPIRED;
      throw new Error('Davet süresi dolmuş.');
    }
    inv.status = INVITATION_STATUS.ACCEPTED;
    inv.updatedAt = new Date().toISOString();
    return inv;
  },

  rejectInvitation(invitationId: string, userId: string): Invitation {
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) throw new Error('Davet bulunamadı.');
    if (inv.receiverId !== userId) throw new Error('Bu daveti reddedemezsin.');
    inv.status = INVITATION_STATUS.REJECTED;
    inv.updatedAt = new Date().toISOString();
    return inv;
  },

  getInvitation(invitationId: string): Invitation | undefined {
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) return undefined;
    if (inv.status === INVITATION_STATUS.PENDING && new Date(inv.expiresAt) < new Date()) {
      inv.status = INVITATION_STATUS.EXPIRED;
    }
    return inv;
  },

  listInvitations(userId: string, type?: Invitation['type']): Invitation[] {
    return invitations.filter((i) => {
      if (i.receiverId !== userId && i.senderId !== userId) return false;
      if (type && i.type !== type) return false;
      if (i.status === INVITATION_STATUS.PENDING && new Date(i.expiresAt) < new Date()) {
        i.status = INVITATION_STATUS.EXPIRED;
      }
      return true;
    });
  },

  // ── Activity ──────────────────────────────────────────────────────────────

  recordActivity(
    userId: string,
    type: SocialActivity['type'],
    title: string,
    body?: string,
    referenceId?: string,
    referenceType?: SocialActivity['referenceType'],
  ): SocialActivity | null {
    const privacy = getPrivacy(userId);
    if (!privacy.activitySharing) return null;

    const activity: SocialActivity = {
      id: uuidv4(),
      userId,
      type,
      title,
      body,
      referenceId,
      referenceType,
      createdAt: new Date().toISOString(),
      isPublic: privacy.profileVisibility === PROFILE_VISIBILITY.PUBLIC,
    };
    activities.push(activity);
    return activity;
  },

  getActivityFeed(viewerId: string, page = 1, pageSize = SOCIAL_CONFIG.pageSize): {
    data: SocialActivity[];
    hasMore: boolean;
  } {
    const friendIds = friendships
      .filter(
        (f) =>
          f.status === FRIENDSHIP_STATUS.ACCEPTED &&
          (f.requesterId === viewerId || f.receiverId === viewerId),
      )
      .map((f) => (f.requesterId === viewerId ? f.receiverId : f.requesterId))
      .filter((id) => !isBlocked(viewerId, id));

    const feed = activities
      .filter((a) => friendIds.includes(a.userId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const start = (page - 1) * pageSize;
    return {
      data: feed.slice(start, start + pageSize),
      hasMore: start + pageSize < feed.length,
    };
  },

  // ── Privacy ───────────────────────────────────────────────────────────────

  getPrivacySettings(userId: string): PrivacySettings {
    return getPrivacy(userId);
  },

  updatePrivacySettings(userId: string, patch: Partial<PrivacySettings>): PrivacySettings {
    const current = getPrivacy(userId);
    const updated: PrivacySettings = { ...current, ...patch, userId, updatedAt: new Date().toISOString() };
    privacySettings.set(userId, updated);
    return updated;
  },

  // ── Suggestions ───────────────────────────────────────────────────────────

  getSuggestions(userId: string): FriendSuggestion[] {
    const hidden = hiddenSuggestions.get(userId) ?? new Set();
    const existingFriendIds = new Set(
      friendships
        .filter(
          (f) =>
            f.status === FRIENDSHIP_STATUS.ACCEPTED &&
            (f.requesterId === userId || f.receiverId === userId),
        )
        .map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId)),
    );

    return SEED_USERS.filter((u) => {
      if (u.id === userId) return false;
      if (existingFriendIds.has(u.id)) return false;
      if (hidden.has(u.id)) return false;
      if (isBlocked(userId, u.id)) return false;
      const privacy = getPrivacy(u.id);
      return privacy.discoverable;
    })
      .slice(0, 5)
      .map((u, i) => ({
        id: `sug-${u.id}`,
        userId: u.id,
        displayName: u.displayName,
        username: u.username,
        avatarUrl: u.avatarUrl,
        source: (['mutual_friends', 'shared_room', 'quiz_interaction'] as const)[i % 3]!,
        mutualFriendsCount: i % 2 === 0 ? 2 : undefined,
      }));
  },

  hideSuggestion(userId: string, targetUserId: string): void {
    const hidden = hiddenSuggestions.get(userId) ?? new Set();
    hidden.add(targetUserId);
    hiddenSuggestions.set(userId, hidden);
  },

  // ── Notifications ───────────────────────────────────────────────────────────

  listNotifications(userId: string, page = 1, pageSize = SOCIAL_CONFIG.pageSize): {
    data: Notification[];
    hasMore: boolean;
    unreadCount: number;
  } {
    const userNotifs = notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const unreadCount = userNotifs.filter((n) => !n.read).length;
    const start = (page - 1) * pageSize;
    return {
      data: userNotifs.slice(start, start + pageSize),
      hasMore: start + pageSize < userNotifs.length,
      unreadCount,
    };
  },

  markNotificationRead(id: string): void {
    const n = notifications.find((x) => x.id === id);
    if (n) n.read = true;
  },

  markAllNotificationsRead(userId: string): void {
    notifications.filter((n) => n.userId === userId).forEach((n) => { n.read = true; });
  },

  // ── Leaderboard friends filter ────────────────────────────────────────────

  getFriendUserIds(userId: string): string[] {
    return friendships
      .filter(
        (f) =>
          f.status === FRIENDSHIP_STATUS.ACCEPTED &&
          (f.requesterId === userId || f.receiverId === userId),
      )
      .map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId))
      .filter((id) => !isBlocked(userId, id));
  },

  // ── Account deletion ──────────────────────────────────────────────────────

  deleteUserData(userId: string): void {
    for (let i = friendships.length - 1; i >= 0; i--) {
      const f = friendships[i]!;
      if (f.requesterId === userId || f.receiverId === userId) friendships.splice(i, 1);
    }
    for (let i = invitations.length - 1; i >= 0; i--) {
      const inv = invitations[i]!;
      if (inv.senderId === userId || inv.receiverId === userId) invitations.splice(i, 1);
    }
    for (let i = activities.length - 1; i >= 0; i--) {
      if (activities[i]!.userId === userId) activities.splice(i, 1);
    }
    for (let i = notifications.length - 1; i >= 0; i--) {
      if (notifications[i]!.userId === userId) notifications.splice(i, 1);
    }
    privacySettings.delete(userId);
    hiddenSuggestions.delete(userId);
  },

  // ── Admin ─────────────────────────────────────────────────────────────────

  adminListFriendships(): Friendship[] {
    return [...friendships];
  },

  adminListInvitations(): Invitation[] {
    return [...invitations];
  },

  adminListActivities(): SocialActivity[] {
    return [...activities];
  },

  getSeedUsers(): SeedUser[] {
    return [...SEED_USERS];
  },
};
