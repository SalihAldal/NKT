export type QuestionType = 'multiple_choice' | 'open_ended';

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  correctAnswer?: string;
  order: number;
}

export type QuizVisibility = 'public' | 'friends' | 'private';
export type QuizStatus = 'draft' | 'published' | 'archived';

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  questions: Question[];
  status: QuizStatus;
  visibility: QuizVisibility;
  timeLimit?: number;
  coverImage?: string;
  theme?: string;
  shareCode: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  solverId?: string;
  solverName: string;
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  correctCount: number;
  averageTimeSeconds: number;
  completedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar?: string;
  isPremium: boolean;
  premiumExpiresAt?: string;
  stats: UserStats;
  createdAt: string;
}

export interface UserStats {
  quizzesCreated: number;
  quizzesCompleted: number;
  averageScore: number;
  friendsCount: number;
  badgesCount: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  username: string;
  avatar?: string;
  score: number;
  percentage: number;
  totalQuestions: number;
  isCurrentUser?: boolean;
}

export type LeaderboardScope = 'friends' | 'global';
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';

export interface NotificationItem {
  id: string;
  type: 'quiz_solved' | 'quiz_received' | 'friend_invite' | 'result_revealed';
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
}

export interface AppSettings {
  language: 'tr' | 'en';
  theme: 'dark' | 'system';
  soundEffects: boolean;
  vibration: boolean;
  dataSaving: boolean;
  notifications: {
    quizSolved: boolean;
    newQuiz: boolean;
    friendInvite: boolean;
    results: boolean;
  };
}

export interface PremiumEntitlement {
  isPremium: boolean;
  expiresAt?: string;
  productId?: string;
  verified: boolean;
}

export interface IncomingQuiz {
  id: string;
  quiz: Quiz;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  isNew: boolean;
  receivedAt: string;
}

export type QuizCategoryId =
  | 'know-me'
  | 'partner'
  | 'friend'
  | 'family'
  | 'fun'
  | 'custom';

export interface QuizDraft {
  categoryId: QuizCategoryId | null;
  title: string;
  description: string;
  visibility: QuizVisibility;
  timeLimit?: number;
  questions: Question[];
  step: 1 | 2 | 3 | 4;
}
