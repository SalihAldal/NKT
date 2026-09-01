import type {
  AdminApiContract,
  AdminCategoryDto,
  AdminContentDto,
  AdminDashboardStats,
  AdminGenerationBatchDto,
  AdminImportResultDto,
  AdminRevenueStats,
} from '../contracts/admin-api';
import type { AdminSocialStats } from '../contracts/social-api';
import { http } from './http-client';

type Paginated<T> = { items: T[]; total: number; page?: number; pageSize?: number; totalPages?: number };

export const adminApiHttp: AdminApiContract = {
  async getDashboard(): Promise<AdminDashboardStats> {
    return http.get<AdminDashboardStats>('/admin/dashboard');
  },

  async listCategories(): Promise<AdminCategoryDto[]> {
    return http.get<AdminCategoryDto[]>('/admin/categories');
  },

  async updateCategory(categoryId: string, patch: { isActive?: boolean; order?: number }): Promise<AdminCategoryDto> {
    return http.patch<AdminCategoryDto>(`/admin/categories/${categoryId}`, patch);
  },

  async listContent(filters): Promise<{ items: AdminContentDto[]; total: number }> {
    const res = await http.get<Paginated<AdminContentDto>>('/admin/content', filters as Record<string, string | number | boolean | undefined>);
    return { items: res.items, total: res.total };
  },

  async createContent(data: Record<string, unknown>): Promise<AdminContentDto> {
    return http.post<AdminContentDto>('/admin/content', data);
  },

  async updateContent(id: string, patch: Record<string, unknown>): Promise<AdminContentDto> {
    return http.patch<AdminContentDto>(`/admin/content/${id}`, patch);
  },

  async deleteContent(id: string): Promise<void> {
    await http.delete(`/admin/content/${id}`);
  },

  async moderateContent(contentId: string, action: 'approve' | 'reject' | 'hide'): Promise<void> {
    await http.patch(`/admin/content/${contentId}/moderate`, { action });
  },

  async bulkModerateContent(ids: string[], action: 'approve' | 'reject' | 'hide') {
    return http.post<{ success: number; skipped: number }>('/admin/content/bulk-moderate', { ids, action });
  },

  async importContentJson(): Promise<AdminImportResultDto> {
    return { imported: 0, rejected: 0, duplicate: 0, rows: [] };
  },

  async importContentCsv(): Promise<AdminImportResultDto> {
    return { imported: 0, rejected: 0, duplicate: 0, rows: [] };
  },

  async exportContentJson(): Promise<string> {
    const res = await http.get<Paginated<AdminContentDto>>('/admin/content', { page: 1, pageSize: 100 });
    return JSON.stringify(res.items, null, 2);
  },

  async exportContentCsv(): Promise<string> {
    const res = await http.get<Paginated<AdminContentDto>>('/admin/content', { page: 1, pageSize: 100 });
    const header = 'id,categoryId,type,difficulty,prompt,premium,active,moderationStatus';
    const rows = res.items.map((c) =>
      [c.id, c.categoryId, c.type, c.difficulty, `"${c.prompt.replace(/"/g, '""')}"`, c.premium, c.active, c.moderationStatus].join(','),
    );
    return [header, ...rows].join('\n');
  },

  async listReviewQueue(filters) {
    const res = await http.get<Paginated<AdminContentDto>>('/admin/content/review-queue', filters as Record<string, string | number | undefined>);
    return { items: res.items, total: res.total };
  },

  async createGenerationBatch(params: { categoryId: string; count: number }): Promise<AdminGenerationBatchDto> {
    return http.post<AdminGenerationBatchDto>('/admin/content/batches', params);
  },

  async listGenerationBatches(): Promise<AdminGenerationBatchDto[]> {
    return http.get<AdminGenerationBatchDto[]>('/admin/content/batches');
  },

  async retryGenerationBatch(batchId: string): Promise<AdminGenerationBatchDto> {
    return http.post<AdminGenerationBatchDto>(`/admin/content/batches/${batchId}/retry`);
  },

  async getRevenueStats(): Promise<AdminRevenueStats> {
    return http.get<AdminRevenueStats>('/admin/revenue');
  },

  async listUsers(page: number, search?: string) {
    const res = await http.get<Paginated<{ id: string; displayName: string; email: string; username: string; status: string; isPremium: boolean; quizzesCreated: number; joinedAt: string }>>(
      '/admin/users',
      { page, pageSize: 25, search },
    );
    return res.items;
  },

  async listRooms(page: number) {
    const res = await http.get<Paginated<{ id: string; code: string; hostUserId: string; state: string; isPremiumRoom: boolean; playerCount: number; createdAt: string }>>(
      '/admin/rooms',
      { page, pageSize: 25 },
    );
    return res.items;
  },

  async listReports(page: number) {
    const res = await http.get<Paginated<{ id: string; type: string; reporterId: string; targetId: string; status: string; createdAt: string }>>(
      '/admin/reports',
      { page, pageSize: 25 },
    );
    return res.items;
  },

  async suspendUser(userId: string): Promise<void> {
    await http.post(`/admin/users/${userId}/suspend`, { reason: 'Admin action' });
  },

  async getSocialStats(): Promise<AdminSocialStats> {
    return http.get<AdminSocialStats>('/admin/social/stats');
  },
};
