import type { CategoryApi, ContentApi } from '../contracts/content.api';
import { FIXED_CATEGORIES } from '@/domain/constants/categories';
import type { Category } from '@/domain/models/category';
import { contentSelector } from '@/services/content/content-selector';
import { contentRepository } from '@/services/content/content-repository';
import { checkDuplicate } from '@/services/content/content-normalizer';
import { stripSensitiveContent } from '@/services/content/content-presenter';
import { entitlementService } from '@/services/entitlement/entitlement.service';
import { delay } from './data';

const toCategory = (c: typeof FIXED_CATEGORIES[number]): Category => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  description: c.description,
  icon: c.icon,
  order: c.order,
  isFree: c.isFree,
  isActive: c.isActive,
  minimumContentTarget: c.minimumContentTarget,
  supportedContentTypes: [...c.supportedContentTypes],
  ageRating: c.ageRating,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

export const createMockCategoryApi = (): CategoryApi => ({
  async list() {
    await delay(50);
    return contentRepository.getCategoryStats().map((s) => toCategory(s));
  },
  async getById(id) {
    const cat = FIXED_CATEGORIES.find((c) => c.id === id);
    if (!cat) throw new Error('Category not found');
    return toCategory(cat);
  },
  async getBySlug(slug) {
    const cat = FIXED_CATEGORIES.find((c) => c.slug === slug);
    if (!cat) throw new Error('Category not found');
    return toCategory(cat);
  },
  async getStats() {
    return contentRepository.getCategoryStats().map((s) => ({
      ...toCategory(s),
      contentCount: s.contentCount,
      warning: s.warning,
    }));
  },
  async update(categoryId, patch) {
    contentRepository.updateCategoryOverride(categoryId, patch);
    const cat = FIXED_CATEGORIES.find((c) => c.id === categoryId)!;
    return { ...toCategory(cat), ...patch };
  },
});

export const createMockContentApi = (): ContentApi => ({
  async listByCategory(categoryId, authorized = false) {
    await delay();
    const items = contentRepository.getByCategory(categoryId, true);
    return authorized ? items : items.map(stripSensitiveContent) as typeof items;
  },
  async getById(id, requesterId) {
    const content = contentRepository.getById(id);
    if (!content) throw new Error('Content not found');
    if (!content.active || content.moderationStatus !== 'approved') {
      if (!requesterId) throw new Error('Unauthorized');
      const isPremium = await entitlementService.isPremium(requesterId);
      if (!isPremium) throw new Error('Unauthorized');
    }
    return stripSensitiveContent(content) as typeof content;
  },
  async select(criteria) {
    await delay();
    const pool = contentRepository.getByCategory(criteria.categoryId, true);
    return contentSelector.select(criteria, pool).items;
  },
  async filter(criteria) {
    return contentRepository.filter(criteria);
  },
  async create(data) {
    return contentRepository.create(data, data.overrideDuplicate);
  },
  async update(id, patch) {
    return contentRepository.update(id, patch);
  },
  async duplicate(id) {
    return contentRepository.duplicate(id);
  },
  async delete(id) {
    contentRepository.delete(id);
  },
  async setActive(id, active) {
    return contentRepository.setActive(id, active);
  },
  async moderate(id, action) {
    return contentRepository.moderate(id, action);
  },
  async importJson(rows, overrideDuplicate) {
    return contentRepository.importJson(rows, overrideDuplicate);
  },
  async importCsv(text, overrideDuplicate) {
    return contentRepository.importCsv(text, overrideDuplicate);
  },
  async checkDuplicate(prompt, categoryId) {
    const existing = contentRepository.getByCategory(categoryId);
    const result = checkDuplicate(prompt, existing);
    return { isExactDuplicate: result.isExactDuplicate, similar: result.similarItems.length };
  },
});
