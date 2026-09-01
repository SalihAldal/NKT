/**
 * Admin panel API contracts — independent from mobile UI models.
 */

export interface AdminCategoryDto {
  id: string;
  slug: string;
  name: string;
  order: number;
  isFree: boolean;
  isActive: boolean;
  contentCount: number;
  minimumContentTarget: number;
  ageRating: string;
  warning: boolean;
  progress?: number;
  incomplete?: boolean;
  qualityScore?: number;
  reviewQueue?: number;
}

export interface AdminContentDto {
  id: string;
  categoryId: string;
  type: string;
  difficulty: number;
  prompt: string;
  premium: boolean;
  active: boolean;
  moderationStatus: string;
  qualityStatus: string;
  usageCount: number;
  completionCount: number;
  reportCount: number;
  skipCount?: number;
  ageRating?: string;
  qualityScore?: number;
  aiGenerated?: boolean;
  contentVersion?: string;
  diversityTheme?: string;
  tags?: string[];
}

export interface AdminUserDto {
  id: string;
  displayName: string;
  email: string;
  username: string;
  status: string;
  isPremium: boolean;
  quizzesCreated: number;
  joinedAt: string;
}

export interface AdminRoomDto {
  id: string;
  code: string;
  hostUserId: string;
  state: string;
  isPremiumRoom: boolean;
  playerCount: number;
  createdAt: string;
}

export interface AdminReportDto {
  id: string;
  type: string;
  reporterId: string;
  targetId: string;
  status: string;
  createdAt: string;
}

export interface AdminDashboardStats {
  totalUsers: number;
  dau: number;
  quizzesCreated: number;
  quizzesSolved: number;
  roomsActive: number;
  premiumUsers: number;
  aiUsage: number;
  reportsPending: number;
  totalContent: number;
  categoriesBelowTarget: number;
  activeContent?: number;
  draftContent?: number;
  reviewContent?: number;
  rejectedContent?: number;
  premiumContent?: number;
  freeContent?: number;
  adult18Content?: number;
  averageQualityScore?: number;
  duplicateRate?: number;
  reportRate?: number;
  reviewQueueCount?: number;
  contentVersion?: string;
}

export interface AdminRevenueStats {
  activePremium: number;
  weeklySubscribers: number;
  monthlySubscribers: number;
  expired: number;
  conversionRate: number;
  purchases: number;
  restoreCount: number;
  adImpressions: number;
  rewardedCompletions: number;
  weeklyProductActive: boolean;
  monthlyProductActive: boolean;
  adsEnabled: boolean;
  rewardedEnabled: boolean;
}

export interface AdminImportResultDto {
  imported: number;
  rejected: number;
  duplicate: number;
  rows: Array<{ row: number; status: string; reason?: string }>;
}

export interface AdminGenerationBatchDto {
  id: string;
  categoryId: string;
  requestedCount: number;
  status: string;
  generatedCount: number;
  failureReason?: string;
  createdAt: string;
}

import type { AdminSocialStats } from '../contracts/social-api';

export interface AdminApiContract {
  getDashboard(): Promise<AdminDashboardStats>;
  listCategories(): Promise<AdminCategoryDto[]>;
  updateCategory(categoryId: string, patch: { isActive?: boolean; order?: number }): Promise<AdminCategoryDto>;
  listContent(filters: {
    categoryId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    type?: string;
    difficulty?: number;
    premium?: boolean;
    active?: boolean;
    moderationStatus?: string;
    qualityStatus?: string;
    ageRating?: string;
    qualityScoreMin?: number;
    aiGenerated?: boolean;
    reviewQueue?: boolean;
  }): Promise<{ items: AdminContentDto[]; total: number }>;
  createContent(data: Record<string, unknown>): Promise<AdminContentDto>;
  updateContent(id: string, patch: Record<string, unknown>): Promise<AdminContentDto>;
  deleteContent(id: string): Promise<void>;
  moderateContent(contentId: string, action: 'approve' | 'reject' | 'hide'): Promise<void>;
  bulkModerateContent(ids: string[], action: 'approve' | 'reject' | 'hide'): Promise<{ success: number; skipped: number }>;
  importContentJson(rows: unknown[]): Promise<AdminImportResultDto>;
  importContentCsv(text: string): Promise<AdminImportResultDto>;
  exportContentJson(categoryId?: string): Promise<string>;
  exportContentCsv(categoryId?: string): Promise<string>;
  listReviewQueue(filters?: { categoryId?: string; page?: number }): Promise<{ items: AdminContentDto[]; total: number }>;
  createGenerationBatch(params: { categoryId: string; count: number }): Promise<AdminGenerationBatchDto>;
  listGenerationBatches(): Promise<AdminGenerationBatchDto[]>;
  retryGenerationBatch(batchId: string): Promise<AdminGenerationBatchDto>;
  getRevenueStats(): Promise<AdminRevenueStats>;
  listUsers(page: number, search?: string): Promise<AdminUserDto[]>;
  listRooms(page: number): Promise<AdminRoomDto[]>;
  listReports(page: number): Promise<AdminReportDto[]>;
  suspendUser(userId: string): Promise<void>;
  getSocialStats(): Promise<AdminSocialStats>;
}
