import type { Block, Report } from '@/domain/models/moderation';
import type { ReportType } from '@/domain/constants/enums';

export interface CreateReportDto {
  type: ReportType;
  reporterId: string;
  targetId: string;
  targetType: Report['targetType'];
  reason: string;
  description?: string;
}

export interface ModerationApi {
  createReport(data: CreateReportDto): Promise<Report>;
  blockUser(blockerId: string, blockedUserId: string): Promise<Block>;
  unblockUser(blockerId: string, blockedUserId: string): Promise<void>;
  listReports(page?: number): Promise<Report[]>;
  moderateContent(contentId: string, status: 'approved' | 'rejected' | 'hidden'): Promise<void>;
}

export interface ProfanityFilter {
  containsProfanity(text: string): boolean;
  sanitize(text: string): string;
}
