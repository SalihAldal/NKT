import type { ModerationApi } from '../contracts/moderation.api';
import { moderationService } from '@/services/moderation/moderation.service';

export const createMockModerationApi = (): ModerationApi => ({
  createReport: (data) => moderationService.createReport(data),
  blockUser: (blockerId, blockedUserId) => moderationService.blockUser(blockerId, blockedUserId),
  unblockUser: (blockerId, blockedUserId) => moderationService.unblockUser(blockerId, blockedUserId),
  listReports: () => moderationService.listReports(),
  moderateContent: async () => {},
});
