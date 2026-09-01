import { describe, it, expect, beforeEach } from 'vitest';
import { badgeService } from '@/services/badges/badge.service';
import { BADGE_DEFINITIONS } from '@/services/badges/badge-definitions';
import { validateProfileInput } from '@/services/profile/profile-validation';
import { historyService } from '@/services/history/history.service';
import { supportService, HELP_ARTICLES } from '@/services/support/support.service';
import { t, getTranslations } from '@/i18n';
import { parseSecureDeepLink } from '@/services/security/validation';
import { advancedStatsService } from '@/services/stats/advanced-stats.service';
import { serverEntitlementService } from '@/services/entitlement/server-entitlement.service';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { ENTITLEMENT_STATUS } from '@/domain/constants/enums';

const baseStats = {
  quizzesCreated: 12,
  quizzesCompleted: 28,
  gamesPlayed: 5,
  averageScore: 87,
  friendsCount: 3,
  badgesCount: 0,
};

beforeEach(() => {
  historyService._reset();
  supportService._reset();
  serverEntitlementService._reset();
});

describe('PHASE 09 — Profile, Home, Settings & UX', () => {
  it('1. badge definitions exist', () => {
    expect(BADGE_DEFINITIONS.length).toBeGreaterThanOrEqual(10);
  });

  it('2. badge unlock — first quiz', () => {
    const badges = badgeService.computeBadges({ stats: { ...baseStats, quizzesCreated: 1 }, gamesWon: 0, bestScore: 50 });
    const first = badges.find((b) => b.badgeId === 'first-quiz');
    expect(first?.isUnlocked).toBe(true);
  });

  it('3. badge progress — not unlocked', () => {
    const badges = badgeService.computeBadges({ stats: { ...baseStats, quizzesCreated: 5 }, gamesWon: 0, bestScore: 50 });
    const quiz10 = badges.find((b) => b.badgeId === 'quiz-10');
    expect(quiz10?.isUnlocked).toBe(false);
    expect(quiz10?.progress).toBe(5);
    expect(quiz10?.target).toBe(10);
  });

  it('4. badge — no fake unlock', () => {
    const badges = badgeService.computeBadges({ stats: { ...baseStats, quizzesCreated: 0 }, gamesWon: 0, bestScore: 0 });
    expect(badges.every((b) => b.isUnlocked === false || b.progress >= b.target)).toBe(true);
  });

  it('5. profile validation — empty name', () => {
    const result = validateProfileInput({ name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeTruthy();
  });

  it('6. profile validation — invalid username', () => {
    const result = validateProfileInput({ username: 'ab' });
    expect(result.valid).toBe(false);
  });

  it('7. profile validation — reserved username', () => {
    const result = validateProfileInput({ username: 'admin' });
    expect(result.valid).toBe(false);
  });

  it('8. profile validation — valid input', () => {
    const result = validateProfileInput({ name: 'Salih', username: 'salihaydin' });
    expect(result.valid).toBe(true);
  });

  it('9. game history', async () => {
    const result = await historyService.getGameHistory('user-1');
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]?.categoryName).toBeTruthy();
  });

  it('10. game history pagination', async () => {
    const result = await historyService.getGameHistory('user-1', 1, 1);
    expect(result.data.length).toBe(1);
    expect(result.hasMore).toBe(true);
  });

  it('11. quiz history empty', async () => {
    const result = await historyService.getQuizHistory('new-user');
    expect(result.data).toEqual([]);
  });

  it('12. help center articles', () => {
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(8);
    expect(HELP_ARTICLES.find((a) => a.id === 'create-quiz')).toBeTruthy();
    expect(HELP_ARTICLES.find((a) => a.id === 'premium')).toBeTruthy();
  });

  it('13. support ticket', async () => {
    const ticket = await supportService.submitTicket('user-1', 'bug', 'Test bug report');
    expect(ticket.category).toBe('bug');
    expect(ticket.id).toBeTruthy();
  });

  it('14. i18n tr', () => {
    expect(t('tr', 'home.greeting')).toBe('Merhaba');
    expect(t('tr', 'empty.quizzes')).toContain('test');
  });

  it('15. i18n en', () => {
    expect(t('en', 'home.greeting')).toBe('Hello');
  });

  it('16. i18n interpolation', () => {
    expect(t('tr', 'home.newQuizzes', { count: 3 })).toContain('3');
  });

  it('17. deep link quiz regression', () => {
    expect(parseSecureDeepLink('nkt://test/salih2024')?.type).toBe('quiz');
  });

  it('18. deep link room regression', () => {
    expect(parseSecureDeepLink('nkt://room/ABC123')?.type).toBe('room');
  });

  it('19. deep link profile regression', () => {
    expect(parseSecureDeepLink('nkt://profile/salihaydin')?.type).toBe('profile');
  });

  it('20. deep link friend regression', () => {
    expect(parseSecureDeepLink('nkt://friend/token123')?.type).toBe('friend');
  });

  it('21. advanced stats — free user blocked', async () => {
    const stats = await advancedStatsService.getAdvancedStats('free-user', baseStats);
    expect(stats).toBeNull();
  });

  it('22. advanced stats — premium user', async () => {
    serverEntitlementService.verifyAndGrant({
      userId: 'prem-user',
      receipt: 'mock-receipt-com.nkt.app.premium.monthly',
      productId: 'com.nkt.app.premium.monthly',
      platform: 'ios',
      transactionId: 'txn-prem',
    });
    await entitlementService.refreshFromServer('prem-user');
    const stats = await advancedStatsService.getAdvancedStats('prem-user', baseStats);
    expect(stats).not.toBeNull();
    expect(stats?.answerAccuracy).toBeGreaterThanOrEqual(0);
  });

  it('23. basic stats', async () => {
    const basic = await advancedStatsService.getBasicStats(baseStats);
    expect(basic.quizzesCreated).toBe(12);
  });

  it('24. badge unlocked count', () => {
    const badges = badgeService.computeBadges({ stats: baseStats, gamesWon: 2, bestScore: 90 });
    const count = badgeService.getUnlockedCount(badges);
    expect(count).toBeGreaterThan(0);
  });

  it('25. badge veteran locked at low games', () => {
    const badges = badgeService.computeBadges({ stats: { ...baseStats, gamesPlayed: 5 }, gamesWon: 1, bestScore: 70 });
    const veteran = badges.find((b) => b.badgeId === 'veteran');
    expect(veteran?.isUnlocked).toBe(false);
  });

  it('26. translations completeness', () => {
    const trKeys = getTranslations('tr');
    const enKeys = getTranslations('en');
    expect(trKeys.home.greeting).toBeTruthy();
    expect(enKeys.profile.title).toBeTruthy();
  });

  it('27. profile bio max length', () => {
    const result = validateProfileInput({ bio: 'x'.repeat(200) });
    expect(result.valid).toBe(false);
  });

  it('28. game history add entry', async () => {
    await historyService.addGameEntry('u1', {
      id: 'gh-new', date: new Date().toISOString(), categoryId: 'fun', categoryName: 'Eğlence',
      score: 100, rank: 1, playerCount: 3, status: 'completed', roomId: 'r1',
    });
    const result = await historyService.getGameHistory('u1');
    expect(result.data[0]?.id).toBe('gh-new');
  });

  it('29. help delete account article', () => {
    const article = HELP_ARTICLES.find((a) => a.id === 'delete-account');
    expect(article?.content).toContain('silinir');
  });

  it('30. badge record breaker', () => {
    const badges = badgeService.computeBadges({ stats: baseStats, gamesWon: 2, bestScore: 95 });
    const record = badges.find((b) => b.badgeId === 'record-breaker');
    expect(record?.isUnlocked).toBe(true);
  });

  it('31. history service reset', async () => {
    historyService._reset();
    const result = await historyService.getGameHistory('user-1');
    expect(result.data.length).toBe(2);
  });

  it('32. premium entitlement unchanged', () => {
    const e = serverEntitlementService.getEntitlement('unknown');
    expect(e.status).toBe(ENTITLEMENT_STATUS.FREE);
  });

  it('33. support categories', async () => {
    const t1 = await supportService.submitTicket('u', 'payment', 'test');
    const t2 = await supportService.submitTicket('u', 'content', 'test');
    expect(t1.category).toBe('payment');
    expect(t2.category).toBe('content');
  });

  it('34. badge friend group progress', () => {
    const badges = badgeService.computeBadges({ stats: { ...baseStats, friendsCount: 3 }, gamesWon: 0, bestScore: 50 });
    const fg = badges.find((b) => b.badgeId === 'friend-group');
    expect(fg?.progress).toBe(3);
    expect(fg?.isUnlocked).toBe(false);
  });
});
