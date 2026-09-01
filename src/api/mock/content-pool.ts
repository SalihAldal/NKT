import { contentRepository } from '@/services/content/content-repository';
import type { GameContent } from '@/domain/models/content';

export const getContentPool = (): GameContent[] => contentRepository.getAll();

export const getContentById = (id: string): GameContent | undefined =>
  contentRepository.getById(id);

export const getContentByCategory = (categoryId: string, playableOnly = false): GameContent[] =>
  contentRepository.getByCategory(categoryId, playableOnly);

export const getCategoryContentCounts = () => contentRepository.getCategoryStats();

export const resetContentPool = (): void => {
  contentRepository._reset();
};
