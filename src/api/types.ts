import type {
  Quiz,
  QuizAttempt,
  User,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
  IncomingQuiz,
  NotificationItem,
  Question,
} from '@/types';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  birthDate: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiClient {
  login(data: LoginRequest): Promise<AuthResponse>;
  register(data: RegisterRequest): Promise<AuthResponse>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User>;
  updateProfile(data: Partial<User>): Promise<User>;
  deleteAccount(): Promise<void>;

  getQuizzes(): Promise<Quiz[]>;
  getQuiz(id: string): Promise<Quiz>;
  getQuizByShareCode(code: string): Promise<Quiz>;
  createQuiz(quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt' | 'shareCode'>): Promise<Quiz>;
  updateQuiz(id: string, quiz: Partial<Quiz>): Promise<Quiz>;
  publishQuiz(id: string): Promise<Quiz>;
  deleteQuiz(id: string): Promise<void>;

  submitAttempt(quizId: string, answers: Record<string, string>, solverName: string): Promise<QuizAttempt>;
  getAttempts(quizId: string): Promise<QuizAttempt[]>;

  getIncomingQuizzes(): Promise<IncomingQuiz[]>;
  getLeaderboard(scope: LeaderboardScope, period: LeaderboardPeriod): Promise<LeaderboardEntry[]>;
  getNotifications(): Promise<NotificationItem[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  generateQuestions(prompt: string, count: number): Promise<Question[]>;
  verifyPremium(receipt: string): Promise<{ isPremium: boolean; expiresAt?: string }>;
}
