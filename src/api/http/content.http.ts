import type { ContentApi, CategoryApi } from '../contracts/content.api';
import type { Category } from '@/domain/models/category';
import type { GameContent } from '@/domain/models/content';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

const notImpl = (): never => { throw new Error('Admin-only operation'); };

export function createHttpContentApi(request: RequestFn): { content: ContentApi; category: CategoryApi } {
  return {
    content: {
      listByCategory: (categoryId) => request<GameContent[]>(`/api/v1/content?categoryId=${categoryId}`),
      getById: (id) => request<GameContent>(`/api/v1/content/${id}`),
      select: notImpl,
      filter: (criteria) => request(`/api/v1/content?${new URLSearchParams(criteria as Record<string, string>)}`),
      create: notImpl,
      update: notImpl,
      duplicate: notImpl,
      delete: notImpl,
      setActive: notImpl,
      moderate: notImpl,
      importJson: notImpl,
      importCsv: notImpl,
      checkDuplicate: notImpl,
    },
    category: {
      list: () => request<Category[]>('/api/v1/content/categories'),
      getById: (id) => request<Category>(`/api/v1/content/categories/${id}`),
      getBySlug: (slug) => request<Category>(`/api/v1/content/categories/slug/${slug}`),
      getStats: () => request('/api/v1/content/categories/stats'),
      update: notImpl,
    },
  };
}
