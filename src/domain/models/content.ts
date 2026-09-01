import type {
  AnswerType,
  DifficultyLevel,
  GameContentType,
  ModerationStatus,
} from '../constants/enums';
import type { ContentQualityStatus } from '../constants/content';

export interface GameContentOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface GameContentAnalytics {
  usageCount: number;
  completionCount: number;
  skipCount: number;
  timeoutCount: number;
  reportCount: number;
  averageResponseTimeMs: number;
}

export interface GameContent {
  id: string;
  categoryId: string;
  type: GameContentType;
  difficulty: DifficultyLevel;
  prompt: string;
  options?: GameContentOption[];
  correctAnswer?: string;
  answerType: AnswerType;
  timeLimit?: number;
  tags: string[];
  ageRating: 'all' | '13+' | '16+' | '18+';
  premium: boolean;
  active: boolean;
  moderationStatus: ModerationStatus;
  qualityStatus: ContentQualityStatus;
  locale: string;
  contentVersion?: string;
  normalizedIdentity?: string;
  qualityScore?: number;
  aiGenerated?: boolean;
  safetyFlags?: string[];
  diversityTheme?: string;
  usageCount: number;
  completionCount: number;
  skipCount: number;
  timeoutCount: number;
  reportCount: number;
  averageResponseTimeMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentUsageRecord {
  id: string;
  playerId: string;
  contentId: string;
  categoryId: string;
  gameId: string;
  roomId?: string;
  usedAt: string;
}

export interface ContentSelectionCriteria {
  categoryId: string;
  contentTypes?: GameContentType[];
  difficulty?: DifficultyLevel | DifficultyLevel[];
  excludeIds?: string[];
  recentHistoryIds?: string[];
  roomHistoryIds?: string[];
  playerHistoryIds?: string[];
  premiumUnlocked: boolean;
  count: number;
  ageRatingMax?: GameContent['ageRating'];
  seed?: string;
  roundNumber?: number;
}

export interface ContentSelectionResult {
  items: GameContent[];
  excludedDuplicates: number;
  excludedRecent: number;
  poolWarning?: boolean;
}
