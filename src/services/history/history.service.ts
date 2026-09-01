import type { Quiz, QuizAttempt } from '@/types';

export interface GameHistoryEntry {
  id: string;
  date: string;
  categoryId: string;
  categoryName: string;
  score: number;
  rank: number;
  playerCount: number;
  status: 'completed' | 'abandoned' | 'in_progress';
  roomId: string;
}

export interface QuizHistoryEntry {
  id: string;
  quiz: Quiz;
  type: 'created' | 'completed' | 'shared' | 'draft';
  score?: number;
  date: string;
}

// In-memory mock history — production would be server-backed
const gameHistoryStore = new Map<string, GameHistoryEntry[]>();
const quizHistoryStore = new Map<string, QuizHistoryEntry[]>();

const seedGameHistory = (userId: string): GameHistoryEntry[] => [
  { id: 'gh-1', date: new Date(Date.now() - 86400000).toISOString(), categoryId: 'party', categoryName: 'Parti', score: 120, rank: 1, playerCount: 4, status: 'completed', roomId: 'room-1' },
  { id: 'gh-2', date: new Date(Date.now() - 172800000).toISOString(), categoryId: 'know-me', categoryName: 'Ne Kadar Tanıyorsun?', score: 85, rank: 2, playerCount: 3, status: 'completed', roomId: 'room-2' },
];

class HistoryServiceImpl {
  _reset() {
    gameHistoryStore.clear();
    quizHistoryStore.clear();
  }

  async getGameHistory(userId: string, page = 1, pageSize = 20): Promise<{ data: GameHistoryEntry[]; hasMore: boolean }> {
    if (!gameHistoryStore.has(userId)) {
      gameHistoryStore.set(userId, seedGameHistory(userId));
    }
    const all = gameHistoryStore.get(userId) ?? [];
    const start = (page - 1) * pageSize;
    return { data: all.slice(start, start + pageSize), hasMore: start + pageSize < all.length };
  }

  async getQuizHistory(userId: string, filter?: QuizHistoryEntry['type'], page = 1, pageSize = 20): Promise<{ data: QuizHistoryEntry[]; hasMore: boolean }> {
    if (!quizHistoryStore.has(userId)) {
      quizHistoryStore.set(userId, []);
    }
    let all = quizHistoryStore.get(userId) ?? [];
    if (filter) all = all.filter((e) => e.type === filter);
    const start = (page - 1) * pageSize;
    return { data: all.slice(start, start + pageSize), hasMore: start + pageSize < all.length };
  }

  async addGameEntry(userId: string, entry: GameHistoryEntry): Promise<void> {
    const existing = gameHistoryStore.get(userId) ?? [];
    gameHistoryStore.set(userId, [entry, ...existing]);
  }

  async addQuizEntry(userId: string, entry: QuizHistoryEntry): Promise<void> {
    const existing = quizHistoryStore.get(userId) ?? [];
    quizHistoryStore.set(userId, [entry, ...existing]);
  }
}

export const historyService = new HistoryServiceImpl();
