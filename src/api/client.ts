/**
 * Legacy ApiClient adapter — maintains backward compatibility with existing screens.
 * New code should use `apiServices` from this module.
 */
import { env } from '@config/environment';
import type { ApiClient, AuthResponse, LoginRequest, RegisterRequest } from '@/api/types';
import type { User, IncomingQuiz, LeaderboardEntry, LeaderboardPeriod, LeaderboardScope, NotificationItem, Question } from '@/types';
import { mapProfileToUiUser } from '@/domain/mappers/user.mapper';
import { mapDomainQuizToUi, mapQuizResultToUiAttempt } from '@/domain/mappers/quiz.mapper';
import { mapNotificationToUi } from '@/domain/mappers/notification.mapper';
import { MOCK_INCOMING, MOCK_LEADERBOARD } from './mock/data';
import { createMockApiServices, setMockAuthenticated } from './mock/index';
import { createHttpApiServices } from './http';
import { secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';
import { logger } from '@/utils/logger';

export { setMockAuthenticated };

const mockServices = createMockApiServices();

const legacyMockClient: ApiClient = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const session = await mockServices.auth.login(data);
    await secureStorage.set(STORAGE_KEYS.authToken, session.tokens.accessToken);
    await secureStorage.set(STORAGE_KEYS.refreshToken, session.tokens.refreshToken);
    const user = mapProfileToUiUser(session.user, session.profile, session.entitlement);
    return { user, accessToken: session.tokens.accessToken, refreshToken: session.tokens.refreshToken };
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const session = await mockServices.auth.register(data);
    await secureStorage.set(STORAGE_KEYS.authToken, session.tokens.accessToken);
    await secureStorage.set(STORAGE_KEYS.refreshToken, session.tokens.refreshToken);
    const user = mapProfileToUiUser(session.user, session.profile, session.entitlement);
    return { user, accessToken: session.tokens.accessToken, refreshToken: session.tokens.refreshToken };
  },

  async logout() {
    await mockServices.auth.logout();
  },

  async getCurrentUser(): Promise<User> {
    const session = await mockServices.auth.getSession();
    if (!session) throw new Error('Unauthorized');
    return mapProfileToUiUser(session.user, session.profile, session.entitlement);
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const session = await mockServices.auth.getSession();
    if (!session) throw new Error('Unauthorized');
    const profile = await mockServices.user.updateProfile(session.user.id, {
      displayName: data.name,
      username: data.username,
      avatarUrl: data.avatar,
    });
    return mapProfileToUiUser(session.user, profile, session.entitlement);
  },

  async deleteAccount() {
    const session = await mockServices.auth.getSession();
    if (session) await mockServices.user.deleteAccount(session.user.id);
    await mockServices.auth.logout();
  },

  async getQuizzes() {
    return (await mockServices.quiz.list()).map((q) => {
      const full = MOCK_INCOMING.find((i) => i.quiz.id === q.id);
      return full ? full.quiz : mapDomainQuizToUi(q, [], 'Unknown');
    });
  },

  async getQuiz(id: string) {
    const { quiz, questions, creatorName } = await mockServices.quiz.getById(id);
    return mapDomainQuizToUi(quiz, questions, creatorName);
  },

  async getQuizByShareCode(code: string) {
    const { quiz, questions, creatorName } = await mockServices.quiz.getByShareCode(code);
    return mapDomainQuizToUi(quiz, questions, creatorName);
  },

  async createQuiz(data) {
    const { quiz, questions } = await mockServices.quiz.create({
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      visibility: data.visibility,
      timeLimit: data.timeLimit,
      questions: data.questions.map((q) => ({ ...q, quizId: '' })),
    });
    return mapDomainQuizToUi(quiz, questions, data.creatorName);
  },

  async updateQuiz(id, data) {
    const quiz = await mockServices.quiz.update(id, data as Parameters<typeof mockServices.quiz.update>[1]);
    const { questions, creatorName } = await mockServices.quiz.getById(id);
    return mapDomainQuizToUi(quiz, questions, creatorName);
  },

  async publishQuiz(id) {
    const quiz = await mockServices.quiz.publish(id);
    const { questions, creatorName } = await mockServices.quiz.getById(id);
    return mapDomainQuizToUi(quiz, questions, creatorName);
  },

  async deleteQuiz(id) {
    await mockServices.quiz.delete(id);
  },

  async submitAttempt(quizId, answers, solverName) {
    const session = await mockServices.quiz.startSession(quizId, solverName);
    const result = await mockServices.quiz.submitResult(session.id, answers);
    return mapQuizResultToUiAttempt(result);
  },

  async getAttempts(quizId) {
    const results = await mockServices.quiz.getResults(quizId);
    return results.map(mapQuizResultToUiAttempt);
  },

  async getIncomingQuizzes(): Promise<IncomingQuiz[]> {
    return MOCK_INCOMING;
  },

  async getLeaderboard(scope: LeaderboardScope, _period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
    if (scope === 'friends') {
      const session = await mockServices.auth.getSession();
      const userId = session?.user.id ?? 'user-1';
      const friendIds = await mockServices.friend.getFriendIds(userId);
      const friendSet = new Set([...friendIds, userId]);
      return MOCK_LEADERBOARD.filter((e) => friendSet.has(e.userId));
    }
    return MOCK_LEADERBOARD;
  },

  async getNotifications(): Promise<NotificationItem[]> {
    const session = await mockServices.auth.getSession();
    const userId = session?.user.id ?? 'user-1';
    const result = await mockServices.notification.list(userId);
    return result.data.map(mapNotificationToUi);
  },

  async markNotificationRead(id) {
    await mockServices.notification.markRead(id);
  },

  async markAllNotificationsRead() {
    const session = await mockServices.auth.getSession();
    const userId = session?.user.id ?? 'user-1';
    await mockServices.notification.markAllRead(userId);
  },

  async generateQuestions(prompt, count): Promise<Question[]> {
    const questions = await mockServices.quiz.generateQuestions(prompt, count);
    return questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options,
      correctAnswer: q.correctAnswer,
      order: q.order,
    }));
  },

  async verifyPremium(receipt) {
    const result = await mockServices.subscription.verifyPurchase('user-1', receipt, 'ios');
    return {
      isPremium: result.entitlement?.status === 'premium',
      expiresAt: result.entitlement?.expiresAt,
    };
  },
};

class HttpApiClient implements ApiClient {
  private baseUrl: string;
  constructor(baseUrl: string) { this.baseUrl = baseUrl; }
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await secureStorage.get(STORAGE_KEYS.authToken);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Bir hata oluştu' }));
      throw new Error((error as { message?: string }).message ?? `HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
  login: ApiClient['login'] = (data) => this.request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
  register: ApiClient['register'] = (data) => this.request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
  logout: ApiClient['logout'] = () => this.request('/auth/logout', { method: 'POST' });
  getCurrentUser: ApiClient['getCurrentUser'] = () => this.request('/users/me');
  updateProfile: ApiClient['updateProfile'] = (data) => this.request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
  deleteAccount: ApiClient['deleteAccount'] = () => this.request('/users/me', { method: 'DELETE' });
  getQuizzes: ApiClient['getQuizzes'] = () => this.request('/quizzes');
  getQuiz: ApiClient['getQuiz'] = (id) => this.request(`/quizzes/${id}`);
  getQuizByShareCode: ApiClient['getQuizByShareCode'] = (code) => this.request(`/quizzes/share/${code}`);
  createQuiz: ApiClient['createQuiz'] = (data) => this.request('/quizzes', { method: 'POST', body: JSON.stringify(data) });
  updateQuiz: ApiClient['updateQuiz'] = (id, data) => this.request(`/quizzes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  publishQuiz: ApiClient['publishQuiz'] = (id) => this.request(`/quizzes/${id}/publish`, { method: 'POST' });
  deleteQuiz: ApiClient['deleteQuiz'] = (id) => this.request(`/quizzes/${id}`, { method: 'DELETE' });
  submitAttempt: ApiClient['submitAttempt'] = (quizId, answers, solverName) => this.request(`/quizzes/${quizId}/attempts`, { method: 'POST', body: JSON.stringify({ answers, solverName }) });
  getAttempts: ApiClient['getAttempts'] = (quizId) => this.request(`/quizzes/${quizId}/attempts`);
  getIncomingQuizzes: ApiClient['getIncomingQuizzes'] = () => this.request('/quizzes/incoming');
  getLeaderboard: ApiClient['getLeaderboard'] = (scope, period) => this.request(`/leaderboard?scope=${scope}&period=${period}`);
  getNotifications: ApiClient['getNotifications'] = () => this.request('/notifications');
  markNotificationRead: ApiClient['markNotificationRead'] = (id) => this.request(`/notifications/${id}/read`, { method: 'POST' });
  markAllNotificationsRead: ApiClient['markAllNotificationsRead'] = () => this.request('/notifications/read-all', { method: 'POST' });
  generateQuestions: ApiClient['generateQuestions'] = (prompt, count) => this.request('/ai/generate-questions', { method: 'POST', body: JSON.stringify({ prompt, count }) });
  verifyPremium: ApiClient['verifyPremium'] = (receipt) => this.request('/premium/verify', { method: 'POST', body: JSON.stringify({ receipt }) });
}

export const apiServices = env.useMockApi ? mockServices : createHttpApiServices();

export const createApiClient = (): ApiClient => {
  if (env.useMockApi) {
    logger.info('Using legacy mock API adapter');
    return legacyMockClient;
  }
  return new HttpApiClient(env.apiUrl);
};

export const api = createApiClient();
