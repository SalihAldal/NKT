import { describe, it, expect, beforeEach } from 'vitest';
import { socialServer } from '@/api/mock/social-server';
import { moderationService } from '@/services/moderation/moderation.service';
import {
  FRIENDSHIP_STATUS,
  INVITATION_STATUS,
  INVITATION_TYPE,
  NOTIFICATION_TYPE,
  PROFILE_VISIBILITY,
  ACTIVITY_TYPE,
  REPORT_REASON,
} from '@/domain/constants/enums';
import { resolveNotificationRoute } from '@/services/notifications/notification-router';
import { parseSecureDeepLink } from '@/services/security/validation';
import {
  buildResultShareMessage,
  buildGameResultShareMessage,
} from '@/services/sharing/share-messages';

beforeEach(() => {
  socialServer._reset();
  moderationService._reset?.();
});

describe('PHASE 08 — Social Graph', () => {
  it('1. send friend request', () => {
    const f = socialServer.sendFriendRequest('user-1', 'user-2');
    expect(f.status).toBe(FRIENDSHIP_STATUS.PENDING);
    expect(f.requesterId).toBe('user-1');
  });

  it('2. accept friend request', () => {
    const f = socialServer.sendFriendRequest('user-1', 'user-2');
    const accepted = socialServer.acceptFriendRequest(f.id, 'user-2');
    expect(accepted.status).toBe(FRIENDSHIP_STATUS.ACCEPTED);
  });

  it('3. decline friend request', () => {
    const f = socialServer.sendFriendRequest('user-1', 'user-3');
    const declined = socialServer.declineFriendRequest(f.id, 'user-3');
    expect(declined.status).toBe(FRIENDSHIP_STATUS.DECLINED);
  });

  it('4. cancel friend request', () => {
    const f = socialServer.sendFriendRequest('user-1', 'user-4');
    socialServer.cancelFriendRequest(f.id, 'user-1');
    const pending = socialServer.listPendingRequests('user-4');
    expect(pending.find((p) => p.id === f.id)).toBeUndefined();
  });

  it('5. remove friend', () => {
    const f = socialServer.sendFriendRequest('user-1', 'user-2');
    socialServer.acceptFriendRequest(f.id, 'user-2');
    socialServer.removeFriend('user-1', 'user-2');
    const friends = socialServer.listFriends('user-1');
    expect(friends.data.length).toBe(0);
  });

  it('6. block user', async () => {
    await moderationService.blockUser('user-1', 'user-2');
    expect(moderationService.isBlocked('user-1', 'user-2')).toBe(true);
  });

  it('7. block prevents request', async () => {
    await moderationService.blockUser('user-1', 'user-2');
    expect(() => socialServer.sendFriendRequest('user-2', 'user-1')).toThrow();
  });

  it('8. user search', () => {
    const result = socialServer.searchUsers('ahmet', 'user-1');
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]?.displayName).toContain('Ahmet');
  });

  it('9. search privacy — hidden user', () => {
    socialServer.updatePrivacySettings('user-2', { discoverable: false });
    const result = socialServer.searchUsers('ahmet', 'user-1');
    expect(result.data.find((u) => u.userId === 'user-2')).toBeUndefined();
  });

  it('10. room invite', () => {
    const inv = socialServer.sendInvitation('user-1', 'user-2', INVITATION_TYPE.ROOM, 'ABC123');
    expect(inv.type).toBe(INVITATION_TYPE.ROOM);
    expect(inv.status).toBe(INVITATION_STATUS.PENDING);
  });

  it('11. quiz invite', () => {
    const inv = socialServer.sendInvitation('user-1', 'user-3', INVITATION_TYPE.QUIZ, 'quiz-1');
    expect(inv.type).toBe(INVITATION_TYPE.QUIZ);
    const notifs = socialServer.listNotifications('user-3');
    expect(notifs.data.some((n) => n.type === NOTIFICATION_TYPE.QUIZ_RECEIVED)).toBe(true);
  });

  it('12. invite expiration', () => {
    const inv = socialServer.sendInvitation('user-1', 'user-2', INVITATION_TYPE.ROOM, 'XYZ999', -1000);
    expect(() => socialServer.acceptInvitation(inv.id, 'user-2')).toThrow('süresi dolmuş');
  });

  it('13. notification inbox', () => {
    socialServer.sendFriendRequest('user-2', 'user-1');
    const result = socialServer.listNotifications('user-1');
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.unreadCount).toBeGreaterThan(0);
  });

  it('14. push notification data created', () => {
    socialServer.sendInvitation('user-1', 'user-2', INVITATION_TYPE.ROOM, 'ROOM01');
    const notifs = socialServer.listNotifications('user-2');
    const roomNotif = notifs.data.find((n) => n.type === NOTIFICATION_TYPE.ROOM_INVITE);
    expect(roomNotif?.body).toContain('davet');
  });

  it('15. notification routing — friend request', () => {
    const route = resolveNotificationRoute(NOTIFICATION_TYPE.FRIEND_REQUEST, { friendshipId: 'f1' });
    expect(route.screen).toBe('Friends');
  });

  it('15b. notification routing — room invite', () => {
    const route = resolveNotificationRoute(NOTIFICATION_TYPE.ROOM_INVITE, { code: 'ABC123' });
    expect(route.screen).toBe('JoinRoom');
    expect(route.params?.code).toBe('ABC123');
  });

  it('16. result share message', () => {
    const msg = buildResultShareMessage({ title: 'Test', score: 85, correctCount: 8, total: 10 });
    expect(msg).toContain('%85');
    expect(msg).not.toContain('@');
    expect(msg).not.toContain('salih@');
  });

  it('17. game result share message', () => {
    const msg = buildGameResultShareMessage({ rank: 1, score: 120, categoryName: 'Parti', playerCount: 4 });
    expect(msg).toContain('1. oldum');
    expect(msg).not.toMatch(/ROOM\d{6}/);
  });

  it('18. friend leaderboard filter', () => {
    const f = socialServer.sendFriendRequest('user-1', 'user-2');
    socialServer.acceptFriendRequest(f.id, 'user-2');
    const friendIds = socialServer.getFriendUserIds('user-1');
    expect(friendIds).toContain('user-2');
  });

  it('19. private quiz privacy — activity no details', () => {
    socialServer.updatePrivacySettings('user-1', { activitySharing: false });
    const activity = socialServer.recordActivity('user-1', ACTIVITY_TYPE.QUIZ_CREATED, 'Test oluşturdu');
    expect(activity).toBeNull();
  });

  it('20. private profile privacy', () => {
    socialServer.updatePrivacySettings('user-2', { profileVisibility: PROFILE_VISIBILITY.PRIVATE });
    const profile = socialServer.getFriendProfile('user-1', 'user-2');
    expect(profile).toBeNull();
  });

  it('21. private activity privacy — feed filtered', () => {
    socialServer.updatePrivacySettings('user-2', { activitySharing: false });
    socialServer.recordActivity('user-2', ACTIVITY_TYPE.GAME_WON, 'Oyunu kazandı');
    const feed = socialServer.getActivityFeed('user-1');
    expect(feed.data.every((a) => a.userId !== 'user-2')).toBe(true);
  });

  it('22. deep link quiz', () => {
    const parsed = parseSecureDeepLink('nkt://test/salih2024');
    expect(parsed?.type).toBe('quiz');
    expect(parsed?.id).toBe('salih2024');
  });

  it('23. deep link room', () => {
    const parsed = parseSecureDeepLink('nkt://room/ABC123');
    expect(parsed?.type).toBe('room');
    expect(parsed?.id).toBe('ABC123');
  });

  it('24. deep link profile', () => {
    const parsed = parseSecureDeepLink('nkt://profile/salihaydin');
    expect(parsed?.type).toBe('profile');
    expect(parsed?.id).toBe('salihaydin');
  });

  it('25. report user', async () => {
    const report = await moderationService.createReport({
      type: 'user',
      reporterId: 'user-1',
      targetId: 'user-2',
      targetType: 'user',
      reason: REPORT_REASON.SPAM,
    });
    expect(report.status).toBe('pending');
  });

  it('26. anti-spam invite cooldown', () => {
    socialServer.sendInvitation('user-1', 'user-2', INVITATION_TYPE.ROOM, 'CODE01');
    expect(() => socialServer.sendInvitation('user-1', 'user-2', INVITATION_TYPE.ROOM, 'CODE02')).toThrow('kısa süre önce');
  });

  it('27. friend suggestion', () => {
    const suggestions = socialServer.getSuggestions('user-1');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.displayName).toBeTruthy();
  });

  it('28. user deletion cleans social data', () => {
    const f = socialServer.sendFriendRequest('user-1', 'user-2');
    socialServer.acceptFriendRequest(f.id, 'user-2');
    socialServer.deleteUserData('user-1');
    const friends = socialServer.listFriends('user-2');
    expect(friends.data.length).toBe(0);
  });

  it('29. admin moderation list', () => {
    socialServer.sendFriendRequest('user-1', 'user-2');
    const friendships = socialServer.adminListFriendships();
    expect(friendships.length).toBeGreaterThan(0);
  });

  it('30. duplicate friendship prevented', () => {
    socialServer.sendFriendRequest('user-1', 'user-2');
    expect(() => socialServer.sendFriendRequest('user-1', 'user-2')).toThrow('zaten gönderildi');
  });

  it('31. friend suggestion hide', () => {
    socialServer.hideSuggestion('user-1', 'user-2');
    const suggestions = socialServer.getSuggestions('user-1');
    expect(suggestions.find((s) => s.userId === 'user-2')).toBeUndefined();
  });

  it('32. mark all notifications read', () => {
    socialServer.sendFriendRequest('user-2', 'user-1');
    socialServer.markAllNotificationsRead('user-1');
    const result = socialServer.listNotifications('user-1');
    expect(result.unreadCount).toBe(0);
  });

  it('33. notification routing premium', () => {
    const route = resolveNotificationRoute(NOTIFICATION_TYPE.PREMIUM, {});
    expect(route.screen).toBe('Premium');
  });

  it('34. deep link friend token', () => {
    const parsed = parseSecureDeepLink('nkt://friend/abc-token-123');
    expect(parsed?.type).toBe('friend');
    expect(parsed?.id).toBe('abc-token-123');
  });
});
