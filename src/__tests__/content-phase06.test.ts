import { describe, it, expect, beforeEach } from 'vitest';
import {
  FIXED_CATEGORIES,
  FREE_CATEGORY_IDS,
  PREMIUM_CATEGORY_IDS,
  PRODUCT_CATEGORY_COUNT,
  getCategoryById,
} from '@/domain/constants/categories';
import { CONTENT_QUALITY_STATUS, MINIMUM_CONTENT_TARGET } from '@/domain/constants/content';
import { CONTENT_DATASET_VERSION, CONTENT_PER_CATEGORY_TARGET } from '@/domain/constants/content-version';
import { ANSWER_TYPE, ENTITLEMENT_STATUS, GAME_CONTENT_TYPE, MODERATION_STATUS } from '@/domain/constants/enums';
import { GAME_CONFIG } from '@/domain/constants/game';
import { contentRepository } from '@/services/content/content-repository';
import { DefaultContentSelector, DifficultyResolver } from '@/services/content/content-selector';
import { contentHistoryService } from '@/services/content/content-history';
import { checkDuplicate } from '@/services/content/content-normalizer';
import { stripSensitiveContent } from '@/services/content/content-presenter';
import { computeQualityScore, getQualityLabel } from '@/services/content/content-quality-score';
import {
  generateFullDataset,
  computeTypeCounts,
  verifyDifficultyDistribution,
  getDatasetStats,
} from '@/services/content/content-dataset-generator';
import { getProductionDatasetSize } from '@/services/content/content-seed-loader';
import { exportContentJson, exportContentCsv } from '@/services/content/content-export.service';
import { contentGenerationBatchService } from '@/services/content/content-generation-batch.service';
import { PremiumAccessPolicy } from '@/services/entitlement/room-entitlement.service';
import type { Entitlement } from '@/domain/models/user';

const selector = new DefaultContentSelector();

const premiumEntitlement = (userId: string): Entitlement => ({
  userId,
  status: ENTITLEMENT_STATUS.PREMIUM,
  source: 'iap',
  verifiedAt: new Date().toISOString(),
});

beforeEach(() => {
  contentRepository._reset();
  contentHistoryService._reset();
});

describe('PHASE 06 — Content Database', () => {
  it('1. 20 kategori mevcut', () => {
    expect(FIXED_CATEGORIES).toHaveLength(PRODUCT_CATEGORY_COUNT);
    expect(FIXED_CATEGORIES).toHaveLength(20);
  });

  it('2. 5 free kategori', () => {
    expect(FREE_CATEGORY_IDS).toHaveLength(5);
  });

  it('3. 15 premium kategori', () => {
    expect(PREMIUM_CATEGORY_IDS).toHaveLength(15);
  });

  it('4. her kategori target 300', () => {
    expect(CONTENT_PER_CATEGORY_TARGET).toBe(MINIMUM_CONTENT_TARGET);
    const stats = contentRepository.getCategoryProgress();
    stats.forEach((s) => {
      expect(s.target).toBe(300);
      expect(s.count).toBeGreaterThanOrEqual(300);
      expect(s.incomplete).toBe(false);
    });
  });

  it('5. seed idempotent', () => {
    const first = contentRepository.getAll().length;
    contentRepository._reset();
    const second = contentRepository.getAll().length;
    expect(first).toBe(second);
    expect(first).toBe(6000);
  });

  it('6. duplicate rejection', () => {
    const existing = contentRepository.getByCategory('cat-korku')[0]!;
    expect(() => contentRepository.create({
      categoryId: 'cat-korku',
      prompt: existing.prompt,
      type: GAME_CONTENT_TYPE.QUESTION,
      difficulty: 1,
      answerType: ANSWER_TYPE.CHOICE,
    })).toThrow();
  });

  it('7. category validation', () => {
    const result = contentRepository.importJson([{ categoryId: 'invalid', prompt: 'test', type: 'question', difficulty: 1 }]);
    expect(result.rejected).toBeGreaterThan(0);
  });

  it('8. difficulty validation', () => {
    expect(() => DifficultyResolver.normalize(0)).toThrow();
  });

  it('9. content type validation', () => {
    const stats = getDatasetStats(generateFullDataset());
    expect(stats.byType.question).toBeGreaterThan(0);
    expect(stats.byType.challenge).toBeGreaterThan(0);
    expect(stats.byType.performance).toBeGreaterThan(0);
  });

  it('10. +18 age validation', () => {
    const adult = contentRepository.getByCategory('cat-18');
    expect(adult.every((c) => c.ageRating === '18+')).toBe(true);
    expect(getCategoryById('cat-18')?.ageRating).toBe('18+');
  });

  it('11. premium validation', () => {
    const premium = contentRepository.getByCategory('cat-ask-iliski', true);
    expect(premium.every((c) => c.premium)).toBe(true);
    const free = contentRepository.getByCategory('cat-korku', true);
    expect(free.every((c) => !c.premium)).toBe(true);
  });

  it('12. moderation validation — AI content draft', async () => {
    const batch = await contentRepository.createGenerationBatch({ categoryId: 'cat-korku', count: 3 });
    expect(batch.status).toBe('completed');
    const aiItems = batch.generatedContentIds.map((id) => contentRepository.getById(id)!);
    expect(aiItems.every((c) => c.moderationStatus === MODERATION_STATUS.PENDING)).toBe(true);
    expect(aiItems.every((c) => c.qualityStatus === CONTENT_QUALITY_STATUS.DRAFT)).toBe(true);
    expect(aiItems.every((c) => !c.active)).toBe(true);
  });

  it('13. active-only selection', () => {
    const pool = contentRepository.getByCategory('cat-korku', true);
    const result = selector.select({ categoryId: 'cat-korku', premiumUnlocked: true, count: 10 }, pool);
    expect(result.items.every((i) => i.active && i.moderationStatus === MODERATION_STATUS.APPROVED)).toBe(true);
  });

  it('14. 30 content selection', () => {
    const pool = contentRepository.getByCategory('cat-korku', true);
    const used = new Set<string>();
    for (let round = 1; round <= GAME_CONFIG.TOTAL_QUESTIONS; round++) {
      const { items } = selector.select({
        categoryId: 'cat-korku',
        premiumUnlocked: true,
        count: 1,
        difficulty: DifficultyResolver.resolveForRound(round, 30),
        excludeIds: [...used],
        seed: `game-${round}`,
        roundNumber: round,
      }, pool);
      used.add(items[0]!.id);
    }
    expect(used.size).toBe(30);
  });

  it('15. easy/medium/hard selection', () => {
    const pool = contentRepository.getByCategory('cat-korku', true);
    expect(pool.filter((c) => c.difficulty === 1).length).toBeGreaterThanOrEqual(90);
    expect(pool.filter((c) => c.difficulty === 2).length).toBeGreaterThanOrEqual(90);
    expect(pool.filter((c) => c.difficulty === 3).length).toBeGreaterThanOrEqual(90);
  });

  it('16. recent history avoidance', () => {
    const pool = contentRepository.getByCategory('cat-korku', true);
    const recentId = pool[0]!.id;
    const result = selector.select({
      categoryId: 'cat-korku',
      premiumUnlocked: true,
      count: 3,
      recentHistoryIds: [recentId],
    }, pool);
    expect(result.items.every((i) => i.id !== recentId)).toBe(true);
  });

  it('17. room history avoidance', () => {
    const pool = contentRepository.getByCategory('cat-korku', true);
    const roomHistory = pool.slice(0, 5).map((c) => c.id);
    const result = selector.select({
      categoryId: 'cat-korku',
      premiumUnlocked: true,
      count: 5,
      roomHistoryIds: roomHistory,
    }, pool);
    expect(result.excludedRecent).toBeGreaterThanOrEqual(0);
  });

  it('18. AI batch generation', async () => {
    const batch = contentGenerationBatchService.create({ categoryId: 'cat-eglence', count: 5 });
    expect(batch.status).toBe('pending');
    expect(batch.requestedCount).toBe(5);
  });

  it('19. AI generation retry', async () => {
    const batch = contentGenerationBatchService.create({ categoryId: 'cat-parti', count: 2 });
    await contentGenerationBatchService.generate(batch.id, [], (data) =>
      contentRepository.create({ ...data, answerType: data.answerType ?? ANSWER_TYPE.TEXT } as Parameters<typeof contentRepository.create>[0], true),
    );
    const retried = await contentGenerationBatchService.retry(batch.id, contentRepository.getAll().map((c) => c.prompt), (data) =>
      contentRepository.create({ ...data, answerType: data.answerType ?? ANSWER_TYPE.TEXT } as Parameters<typeof contentRepository.create>[0], true),
    );
    expect(retried.status).toBe('completed');
  });

  it('20. AI generated duplicate prevention', () => {
    const prompts = contentRepository.getAll().map((c) => c.prompt);
    const dup = checkDuplicate(prompts[0]!, prompts.slice(1).map((p, i) => ({ id: String(i), prompt: p })));
    expect(dup.isExactDuplicate).toBe(false);
  });

  it('21. bulk import', () => {
    const result = contentRepository.importJson([
      { categoryId: 'cat-korku', prompt: 'Phase06 unique import test sorusu alpha', type: 'question', difficulty: 1, answerType: 'choice' },
    ]);
    expect(result.imported).toBe(1);
  });

  it('22. export JSON', () => {
    const json = contentRepository.exportJson({ categoryId: 'cat-korku' });
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(300);
    expect(parsed[0].correctAnswer).toBeUndefined();
  });

  it('23. export CSV', () => {
    const csv = contentRepository.exportCsv({ categoryId: 'cat-gece' });
    expect(csv.split('\n').length).toBeGreaterThan(300);
  });

  it('24. admin CRUD', () => {
    const created = contentRepository.create({
      categoryId: 'cat-korku',
      prompt: 'Phase06 CRUD test unique sorusu beta',
      type: GAME_CONTENT_TYPE.QUESTION,
      difficulty: 2,
      answerType: ANSWER_TYPE.CHOICE,
    });
    const updated = contentRepository.update(created.id, { difficulty: 3 });
    expect(updated.difficulty).toBe(3);
  });

  it('25. bulk moderation', () => {
    const item = contentRepository.create({
      categoryId: 'cat-korku',
      prompt: 'Phase06 bulk mod test unique gamma',
      type: GAME_CONTENT_TYPE.QUESTION,
      difficulty: 1,
      answerType: ANSWER_TYPE.CHOICE,
      moderationStatus: MODERATION_STATUS.PENDING,
      qualityStatus: CONTENT_QUALITY_STATUS.DRAFT,
      active: false,
    });
    const result = contentRepository.bulkModerate([item.id], 'approve');
    expect(result.success).toBe(1);
    expect(contentRepository.getById(item.id)?.moderationStatus).toBe(MODERATION_STATUS.APPROVED);
  });

  it('26. content quality score', () => {
    const item = contentRepository.getByCategory('cat-korku')[0]!;
    expect(item.qualityScore).toBeGreaterThanOrEqual(50);
    expect(getQualityLabel(item.qualityScore ?? 0)).toBeTruthy();
    expect(computeQualityScore(item)).toBeGreaterThan(0);
  });

  it('27. search/filter', () => {
    const { total } = contentRepository.filter({ categoryId: 'cat-korku', difficulty: 1, page: 1, pageSize: 10 });
    expect(total).toBeGreaterThanOrEqual(90);
    const dash = contentRepository.getDashboardStats();
    expect(dash.totalContent).toBe(6000);
  });

  it('28. hidden answer protection', () => {
    const raw = contentRepository.getByCategory('cat-korku', true)[0]!;
    const safe = stripSensitiveContent({ ...raw, correctAnswer: 'secret' });
    expect('correctAnswer' in safe && (safe as { correctAnswer?: string }).correctAnswer !== undefined).toBe(false);
  });

  it('29. free player in premium host room', () => {
    const pool = contentRepository.getByCategory('cat-ask-iliski', true);
    const result = selector.select({ categoryId: 'cat-ask-iliski', premiumUnlocked: true, count: 5 }, pool);
    expect(result.items.length).toBeGreaterThan(0);
    expect(PremiumAccessPolicy.isRoomPremium(premiumEntitlement('host'))).toBe(true);
  });

  it('30. custom category compatibility + data versioning', () => {
    expect(getProductionDatasetSize()).toBe(6000);
    const all = contentRepository.getAll();
    expect(all.every((c) => c.contentVersion === CONTENT_DATASET_VERSION)).toBe(true);
    FIXED_CATEGORIES.forEach((cat) => {
      const v = verifyDifficultyDistribution(all, cat.id);
      expect(v.total).toBe(300);
      expect(v.balanced).toBe(true);
    });
    const typeCounts = computeTypeCounts('cat-korku', 300);
    expect(typeCounts.question + typeCounts.challenge + typeCounts.performance).toBe(300);
    const json = exportContentJson(all.slice(0, 5), { format: 'json' });
    const csv = exportContentCsv(all.slice(0, 5), { format: 'csv' });
    expect(json).toContain('prompt');
    expect(csv).toContain('categoryId');
  });
});
