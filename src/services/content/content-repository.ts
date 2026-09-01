import { v4 as uuidv4 } from 'uuid';
import type { GameContent } from '@/domain/models/content';
import { CONTENT_QUALITY_STATUS, isPlayableContent } from '@/domain/constants/content';
import { FIXED_CATEGORIES, getCategoryById, MIN_FREE_CATEGORIES } from '@/domain/constants/categories';
import { CONTENT_DATASET_VERSION } from '@/domain/constants/content-version';
import { MODERATION_STATUS } from '@/domain/constants/enums';
import { checkDuplicate, normalizeContentText } from './content-normalizer';
import { validateContentRow } from './content-quality-validator';
import { DifficultyResolver } from './content-selector';
import { getProductionDataset, clearProductionCache } from './content-seed-loader';
import { exportContentCsv, exportContentJson } from './content-export.service';
import { computeAverageQualityScore, computeQualityScore } from './content-quality-score';
import { contentGenerationBatchService } from './content-generation-batch.service';

export interface ContentFilter {
  categoryId?: string;
  type?: string;
  difficulty?: number;
  premium?: boolean;
  active?: boolean;
  moderationStatus?: string;
  qualityStatus?: string;
  ageRating?: string;
  qualityScoreMin?: number;
  qualityScoreMax?: number;
  aiGenerated?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ImportRowResult {
  row: number;
  status: 'imported' | 'rejected' | 'duplicate';
  reason?: string;
  contentId?: string;
}

export interface ImportResult {
  imported: number;
  rejected: number;
  duplicate: number;
  rows: ImportRowResult[];
}

export interface ContentDashboardStats {
  totalContent: number;
  active: number;
  draft: number;
  review: number;
  rejected: number;
  premium: number;
  free: number;
  adult18: number;
  averageQualityScore: number;
  duplicateRate: number;
  reportRate: number;
  reviewQueueCount: number;
  contentVersion: string;
}

export interface CategoryProgressStat {
  categoryId: string;
  name: string;
  count: number;
  target: number;
  progress: number;
  incomplete: boolean;
  qualityScore: number;
  reviewQueue: number;
  diversityThemes: number;
}

const defaultContent = (partial: Partial<GameContent> & Pick<GameContent, 'categoryId' | 'prompt' | 'type' | 'difficulty' | 'answerType'>): GameContent => {
  const cat = getCategoryById(partial.categoryId);
  const now = new Date().toISOString();
  const defaults: GameContent = {
    id: uuidv4(),
    locale: 'tr-TR',
    tags: [],
    ageRating: cat?.ageRating === '18+' ? '18+' : cat?.ageRating === '16+' ? '16+' : 'all',
    premium: !cat?.isFree,
    active: true,
    moderationStatus: MODERATION_STATUS.APPROVED,
    qualityStatus: CONTENT_QUALITY_STATUS.ACTIVE,
    contentVersion: CONTENT_DATASET_VERSION,
    normalizedIdentity: normalizeContentText(partial.prompt),
    aiGenerated: false,
    safetyFlags: [],
    usageCount: 0,
    completionCount: 0,
    skipCount: 0,
    timeoutCount: 0,
    reportCount: 0,
    averageResponseTimeMs: 0,
    createdAt: now,
    updatedAt: now,
    categoryId: partial.categoryId,
    type: partial.type,
    difficulty: partial.difficulty,
    prompt: partial.prompt,
    answerType: partial.answerType,
  };
  const merged = { ...defaults, ...partial, updatedAt: partial.updatedAt ?? now, createdAt: partial.createdAt ?? now };
  merged.qualityScore = computeQualityScore(merged);
  return merged;
};

class ContentRepository {
  private store = new Map<string, GameContent>();
  private categoryOverrides = new Map<string, Partial<typeof FIXED_CATEGORIES[number]>>();

  constructor() {
    this.loadProductionSeed();
  }

  private loadProductionSeed() {
    this.store.clear();
    for (const c of getProductionDataset()) {
      this.store.set(c.id, { ...c });
    }
  }

  getAll(): GameContent[] {
    return [...this.store.values()];
  }

  getById(id: string): GameContent | undefined {
    return this.store.get(id);
  }

  getByCategory(categoryId: string, playableOnly = false): GameContent[] {
    return [...this.store.values()].filter((c) => {
      if (c.categoryId !== categoryId) return false;
      if (playableOnly && !isPlayableContent(c.active, c.moderationStatus, c.qualityStatus)) return false;
      return true;
    });
  }

  countByCategory(categoryId: string, activeOnly = true): number {
    return this.getByCategory(categoryId).filter((c) => !activeOnly || (c.active && c.moderationStatus === MODERATION_STATUS.APPROVED)).length;
  }

  getCategoryStats() {
    return FIXED_CATEGORIES.map((cat) => {
      const override = this.categoryOverrides.get(cat.id);
      const active = this.countByCategory(cat.id, true);
      return {
        ...cat,
        ...override,
        contentCount: active,
        warning: active < cat.minimumContentTarget,
      };
    });
  }

  getCategoryProgress(): CategoryProgressStat[] {
    return FIXED_CATEGORIES.map((cat) => {
      const items = this.getByCategory(cat.id).filter((c) => c.active && c.moderationStatus === MODERATION_STATUS.APPROVED);
      const themes = new Set(items.map((i) => i.diversityTheme).filter(Boolean));
      const reviewQueue = items.filter((c) => c.moderationStatus === MODERATION_STATUS.PENDING || c.qualityStatus === CONTENT_QUALITY_STATUS.DRAFT).length;
      const count = items.length;
      return {
        categoryId: cat.id,
        name: cat.name,
        count,
        target: cat.minimumContentTarget,
        progress: Math.min(100, Math.round((count / cat.minimumContentTarget) * 100)),
        incomplete: count < cat.minimumContentTarget,
        qualityScore: computeAverageQualityScore(items),
        reviewQueue,
        diversityThemes: themes.size,
      };
    });
  }

  getDashboardStats(): ContentDashboardStats {
    const all = this.getAll();
    const active = all.filter((c) => c.active && c.qualityStatus === CONTENT_QUALITY_STATUS.ACTIVE);
    const review = all.filter((c) => c.moderationStatus === MODERATION_STATUS.PENDING || c.qualityStatus === CONTENT_QUALITY_STATUS.DRAFT);
    const totalUsage = all.reduce((s, c) => s + c.usageCount, 0);
    const totalReports = all.reduce((s, c) => s + c.reportCount, 0);
    const norms = new Set<string>();
    let dupes = 0;
    for (const c of all) {
      const n = c.normalizedIdentity ?? normalizeContentText(c.prompt);
      if (norms.has(n)) dupes++;
      norms.add(n);
    }
    return {
      totalContent: all.length,
      active: active.length,
      draft: all.filter((c) => c.qualityStatus === CONTENT_QUALITY_STATUS.DRAFT).length,
      review: review.length,
      rejected: all.filter((c) => c.moderationStatus === MODERATION_STATUS.REJECTED).length,
      premium: all.filter((c) => c.premium).length,
      free: all.filter((c) => !c.premium).length,
      adult18: all.filter((c) => c.ageRating === '18+').length,
      averageQualityScore: computeAverageQualityScore(all),
      duplicateRate: all.length ? Math.round((dupes / all.length) * 10000) / 100 : 0,
      reportRate: totalUsage ? Math.round((totalReports / totalUsage) * 10000) / 100 : 0,
      reviewQueueCount: review.length,
      contentVersion: CONTENT_DATASET_VERSION,
    };
  }

  getReviewQueue(filters?: { categoryId?: string; page?: number; pageSize?: number }) {
    return this.filter({
      moderationStatus: MODERATION_STATUS.PENDING,
      page: filters?.page,
      pageSize: filters?.pageSize ?? 50,
      categoryId: filters?.categoryId,
    });
  }

  filter(f: ContentFilter): { items: GameContent[]; total: number } {
    let items = this.getAll();
    if (f.categoryId) items = items.filter((c) => c.categoryId === f.categoryId);
    if (f.type) items = items.filter((c) => c.type === f.type);
    if (f.difficulty) items = items.filter((c) => c.difficulty === f.difficulty);
    if (f.premium !== undefined) items = items.filter((c) => c.premium === f.premium);
    if (f.active !== undefined) items = items.filter((c) => c.active === f.active);
    if (f.moderationStatus) items = items.filter((c) => c.moderationStatus === f.moderationStatus);
    if (f.qualityStatus) items = items.filter((c) => c.qualityStatus === f.qualityStatus);
    if (f.ageRating) items = items.filter((c) => c.ageRating === f.ageRating);
    if (f.aiGenerated !== undefined) items = items.filter((c) => Boolean(c.aiGenerated) === f.aiGenerated);
    if (f.qualityScoreMin !== undefined) items = items.filter((c) => (c.qualityScore ?? 0) >= f.qualityScoreMin!);
    if (f.qualityScoreMax !== undefined) items = items.filter((c) => (c.qualityScore ?? 100) <= f.qualityScoreMax!);
    if (f.search) {
      const q = f.search.toLowerCase();
      items = items.filter((c) => c.prompt.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q)));
    }
    const total = items.length;
    const page = f.page ?? 1;
    const pageSize = f.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total };
  }

  create(data: Partial<GameContent> & Pick<GameContent, 'categoryId' | 'prompt' | 'type' | 'difficulty' | 'answerType'>, overrideDuplicate = false): GameContent {
    if (!getCategoryById(data.categoryId)) throw new Error('Invalid category');
    DifficultyResolver.normalize(data.difficulty);
    const existing = this.getByCategory(data.categoryId);
    const dup = checkDuplicate(data.prompt, existing);
    if (!overrideDuplicate && (dup.isExactDuplicate || dup.similarItems.length > 0)) {
      throw new Error(dup.isExactDuplicate ? 'Exact duplicate' : 'Similar content found');
    }
    const content = defaultContent({ ...data, id: uuidv4() });
    this.store.set(content.id, content);
    return content;
  }

  update(id: string, patch: Partial<GameContent>): GameContent {
    const existing = this.store.get(id);
    if (!existing) throw new Error('Content not found');
    if (patch.difficulty !== undefined) DifficultyResolver.normalize(patch.difficulty);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    if (patch.prompt) updated.normalizedIdentity = normalizeContentText(patch.prompt);
    updated.qualityScore = computeQualityScore(updated);
    this.store.set(id, updated);
    return updated;
  }

  duplicate(id: string): GameContent {
    const src = this.store.get(id);
    if (!src) throw new Error('Content not found');
    return this.create({ ...src, id: undefined, prompt: `${src.prompt} (kopya)` }, true);
  }

  delete(id: string): void {
    this.store.delete(id);
  }

  setActive(id: string, active: boolean): GameContent {
    return this.update(id, { active });
  }

  moderate(id: string, action: 'approve' | 'reject' | 'hide'): GameContent {
    if (action === 'approve') {
      return this.update(id, { moderationStatus: MODERATION_STATUS.APPROVED, qualityStatus: CONTENT_QUALITY_STATUS.ACTIVE, active: true });
    }
    if (action === 'reject') {
      return this.update(id, { moderationStatus: MODERATION_STATUS.REJECTED, qualityStatus: CONTENT_QUALITY_STATUS.REJECTED, active: false });
    }
    return this.update(id, { moderationStatus: MODERATION_STATUS.HIDDEN, qualityStatus: CONTENT_QUALITY_STATUS.DISABLED, active: false });
  }

  bulkModerate(ids: string[], action: 'approve' | 'reject' | 'hide', options?: { requireAdultConfirm?: boolean }): { success: number; skipped: number } {
    let success = 0;
    let skipped = 0;
    for (const id of ids) {
      const item = this.store.get(id);
      if (!item) { skipped++; continue; }
      if (action === 'approve' && item.ageRating === '18+' && options?.requireAdultConfirm) {
        skipped++;
        continue;
      }
      this.moderate(id, action);
      success++;
    }
    return { success, skipped };
  }

  incrementUsage(id: string, field: 'usageCount' | 'completionCount' | 'skipCount' | 'timeoutCount' | 'reportCount'): void {
    const c = this.store.get(id);
    if (!c) return;
    c[field] += 1;
    c.updatedAt = new Date().toISOString();
    c.qualityScore = computeQualityScore(c);
  }

  exportJson(options: { categoryId?: string; includeInternal?: boolean } = {}): string {
    return exportContentJson(this.getAll(), { format: 'json', ...options });
  }

  exportCsv(options: { categoryId?: string } = {}): string {
    return exportContentCsv(this.getAll(), { format: 'csv', ...options });
  }

  async createGenerationBatch(params: Parameters<typeof contentGenerationBatchService.create>[0]) {
    const batch = contentGenerationBatchService.create(params);
    await contentGenerationBatchService.generate(
      batch.id,
      this.getAll().map((c) => c.prompt),
      (data) => this.create(data as Parameters<typeof this.create>[0], true),
    );
    return contentGenerationBatchService.get(batch.id)!;
  }

  listGenerationBatches() {
    return contentGenerationBatchService.list();
  }

  async retryGenerationBatch(batchId: string) {
    return contentGenerationBatchService.retry(
      batchId,
      this.getAll().map((c) => c.prompt),
      (data) => this.create(data as Parameters<typeof this.create>[0], true),
    );
  }

  updateCategoryOverride(categoryId: string, patch: { isActive?: boolean; order?: number; description?: string; icon?: string }) {
    const cat = getCategoryById(categoryId);
    if (!cat) throw new Error('Category not found');

    if (patch.isActive === false && cat.isFree) {
      const stats = this.getCategoryStats();
      const activeFree = stats.filter((s) => s.isFree && s.isActive).length;
      if (activeFree <= MIN_FREE_CATEGORIES) {
        throw new Error('Cannot deactivate: minimum 5 active free categories required');
      }
    }

    const existing = this.categoryOverrides.get(categoryId) ?? {};
    this.categoryOverrides.set(categoryId, { ...existing, ...patch });
  }

  importJson(rows: unknown[], overrideDuplicate = false): ImportResult {
    return this.importRows(rows.map((r, i) => ({ row: i + 1, data: r })), overrideDuplicate);
  }

  importCsv(text: string, overrideDuplicate = false): ImportResult {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { imported: 0, rejected: 0, duplicate: 0, rows: [] };
    const headers = lines[0]!.split(',').map((h) => h.trim());
    const rows = lines.slice(1).map((line, i) => {
      const vals = line.split(',');
      const data: Record<string, string> = {};
      headers.forEach((h, j) => { data[h] = vals[j]?.trim() ?? ''; });
      return { row: i + 2, data };
    });
    return this.importRows(rows, overrideDuplicate);
  }

  private importRows(rows: Array<{ row: number; data: unknown }>, overrideDuplicate: boolean): ImportResult {
    const result: ImportResult = { imported: 0, rejected: 0, duplicate: 0, rows: [] };

    for (const { row, data } of rows) {
      try {
        const d = data as Record<string, unknown>;
        const categoryId = String(d.categoryId ?? '');
        const prompt = String(d.prompt ?? '');
        const type = String(d.type ?? 'question');
        const difficulty = Number(d.difficulty ?? 1);
        const answerType = String(d.answerType ?? (type === 'question' ? 'text' : 'action'));

        if (!categoryId || !prompt) throw new Error('categoryId and prompt required');
        if (!getCategoryById(categoryId)) throw new Error('Invalid category');
        DifficultyResolver.normalize(difficulty);

        const existing = this.getByCategory(categoryId);
        const validation = validateContentRow(d as Record<string, unknown>, existing.map((e) => e.prompt));
        if (!validation.valid) {
          result.rejected++;
          result.rows.push({ row, status: 'rejected', reason: validation.issues.map((i) => i.message).join('; ') });
          continue;
        }

        const dup = checkDuplicate(prompt, existing);
        if (!overrideDuplicate && dup.isExactDuplicate) {
          result.duplicate++;
          result.rows.push({ row, status: 'duplicate', reason: 'Exact duplicate' });
          continue;
        }

        const content = this.create({
          categoryId,
          prompt,
          type: type as GameContent['type'],
          difficulty: difficulty as 1 | 2 | 3,
          answerType: answerType as GameContent['answerType'],
          tags: String(d.tags ?? '').split(';').filter(Boolean),
          premium: d.premium === true || d.premium === 'true',
          active: d.active !== false && d.active !== 'false',
          moderationStatus: d.moderationStatus as GameContent['moderationStatus'] ?? MODERATION_STATUS.APPROVED,
          qualityStatus: d.qualityStatus as GameContent['qualityStatus'] ?? CONTENT_QUALITY_STATUS.ACTIVE,
        }, overrideDuplicate);

        result.imported++;
        result.rows.push({ row, status: 'imported', contentId: content.id });
      } catch (e) {
        result.rejected++;
        result.rows.push({ row, status: 'rejected', reason: e instanceof Error ? e.message : 'Unknown error' });
      }
    }
    return result;
  }

  _reset(): void {
    this.store.clear();
    this.categoryOverrides.clear();
    contentGenerationBatchService._reset();
    clearProductionCache();
    this.loadProductionSeed();
  }
}

export const contentRepository = new ContentRepository();
