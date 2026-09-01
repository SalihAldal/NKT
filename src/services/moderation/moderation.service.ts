import type { ProfanityFilter } from '@/api/contracts/moderation.api';
import type { CreateReportDto } from '@/api/contracts/moderation.api';
import type { Block, Report } from '@/domain/models/moderation';
import { MODERATION_STATUS } from '@/domain/constants/enums';
import { v4 as uuidv4 } from 'uuid';

const BLOCKED_WORDS = ['spam', 'abuse'];

class BasicProfanityFilter implements ProfanityFilter {
  containsProfanity(text: string): boolean {
    const lower = text.toLowerCase();
    return BLOCKED_WORDS.some((w) => lower.includes(w));
  }

  sanitize(text: string): string {
    let result = text;
    BLOCKED_WORDS.forEach((w) => {
      result = result.replace(new RegExp(w, 'gi'), '***');
    });
    return result;
  }
}

class ModerationServiceImpl {
  private reports: Report[] = [];
  private blocks: Block[] = [];
  private profanityFilter = new BasicProfanityFilter();

  get filter(): ProfanityFilter {
    return this.profanityFilter;
  }

  async createReport(data: CreateReportDto): Promise<Report> {
    const report: Report = {
      id: uuidv4(),
      type: data.type,
      reporterId: data.reporterId,
      targetId: data.targetId,
      targetType: data.targetType,
      reason: data.reason,
      description: data.description,
      status: MODERATION_STATUS.PENDING,
      createdAt: new Date().toISOString(),
    };
    this.reports.push(report);
    return report;
  }

  async blockUser(blockerId: string, blockedUserId: string): Promise<Block> {
    const block: Block = {
      id: uuidv4(),
      blockerId,
      blockedUserId,
      createdAt: new Date().toISOString(),
    };
    this.blocks.push(block);
    return block;
  }

  async unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
    this.blocks = this.blocks.filter(
      (b) => !(b.blockerId === blockerId && b.blockedUserId === blockedUserId),
    );
  }

  isBlocked(userA: string, userB: string): boolean {
    return this.blocks.some(
      (b) =>
        (b.blockerId === userA && b.blockedUserId === userB) ||
        (b.blockerId === userB && b.blockedUserId === userA),
    );
  }

  listBlocks(blockerId: string): Block[] {
    return this.blocks.filter((b) => b.blockerId === blockerId);
  }

  async listReports(): Promise<Report[]> {
    return [...this.reports];
  }

  _reset(): void {
    this.reports = [];
    this.blocks = [];
  }
}

export const moderationService = new ModerationServiceImpl();
