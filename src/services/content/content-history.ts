import type { ContentUsageRecord } from '@/domain/models/content';
import { v4 as uuidv4 } from 'uuid';

export interface ContentHistoryService {
  getRecentContentIds(userId: string, categoryId: string): Promise<string[]>;
  getRoomContentIds(roomId: string): Promise<string[]>;
  getPlayerGameContentIds(playerId: string, gameId: string): Promise<string[]>;
  recordUsage(record: Omit<ContentUsageRecord, 'id' | 'usedAt'>): Promise<void>;
  listByContent(contentId: string): Promise<ContentUsageRecord[]>;
}

class InMemoryContentHistoryService implements ContentHistoryService {
  private records: ContentUsageRecord[] = [];

  private key(userId: string, categoryId: string): string {
    return `${userId}:${categoryId}`;
  }

  async getRecentContentIds(userId: string, categoryId: string): Promise<string[]> {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.records
      .filter(
        (r) =>
          r.playerId === userId &&
          r.categoryId === categoryId &&
          new Date(r.usedAt).getTime() > cutoff,
      )
      .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
      .map((r) => r.contentId)
      .slice(0, 100);
  }

  async getRoomContentIds(roomId: string): Promise<string[]> {
    return this.records.filter((r) => r.roomId === roomId).map((r) => r.contentId);
  }

  async getPlayerGameContentIds(playerId: string, gameId: string): Promise<string[]> {
    return this.records
      .filter((r) => r.playerId === playerId && r.gameId === gameId)
      .map((r) => r.contentId);
  }

  async recordUsage(record: Omit<ContentUsageRecord, 'id' | 'usedAt'>): Promise<void> {
    this.records.push({
      ...record,
      id: uuidv4(),
      usedAt: new Date().toISOString(),
    });
  }

  async listByContent(contentId: string): Promise<ContentUsageRecord[]> {
    return this.records.filter((r) => r.contentId === contentId);
  }

  _reset(): void {
    this.records = [];
  }
}

export const contentHistoryService = new InMemoryContentHistoryService();
