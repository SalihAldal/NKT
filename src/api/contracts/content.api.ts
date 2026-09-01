import type { Category } from '@/domain/models/category';
import type { GameContent, ContentSelectionCriteria } from '@/domain/models/content';
import type { ContentFilter, ImportResult } from '@/services/content/content-repository';

export interface CategoryApi {
  list(): Promise<Category[]>;
  getById(id: string): Promise<Category>;
  getBySlug(slug: string): Promise<Category>;
  getStats(): Promise<Array<Category & { contentCount: number; warning: boolean }>>;
  update(categoryId: string, patch: { isActive?: boolean; order?: number; description?: string; icon?: string }): Promise<Category>;
}

export interface CreateContentDto {
  categoryId: string;
  type: GameContent['type'];
  difficulty: GameContent['difficulty'];
  prompt: string;
  answerType: GameContent['answerType'];
  options?: GameContent['options'];
  correctAnswer?: string;
  timeLimit?: number;
  tags?: string[];
  ageRating?: GameContent['ageRating'];
  premium?: boolean;
  active?: boolean;
  locale?: string;
  overrideDuplicate?: boolean;
}

export interface ContentApi {
  listByCategory(categoryId: string, authorized?: boolean): Promise<GameContent[]>;
  getById(id: string, requesterId?: string): Promise<GameContent>;
  select(criteria: ContentSelectionCriteria): Promise<GameContent[]>;
  filter(criteria: ContentFilter): Promise<{ items: GameContent[]; total: number }>;
  create(data: CreateContentDto): Promise<GameContent>;
  update(id: string, patch: Partial<GameContent>): Promise<GameContent>;
  duplicate(id: string): Promise<GameContent>;
  delete(id: string): Promise<void>;
  setActive(id: string, active: boolean): Promise<GameContent>;
  moderate(id: string, action: 'approve' | 'reject' | 'hide'): Promise<GameContent>;
  importJson(rows: unknown[], overrideDuplicate?: boolean): Promise<ImportResult>;
  importCsv(text: string, overrideDuplicate?: boolean): Promise<ImportResult>;
  checkDuplicate(prompt: string, categoryId: string): Promise<{ isExactDuplicate: boolean; similar: number }>;
}
