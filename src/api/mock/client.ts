import type { ApiClient, LoginRequest, RegisterRequest, AuthResponse } from '@/api/types';
import type { Quiz, Question, QuizAttempt } from '@/types';
import { MOCK_USER, MOCK_QUIZZES, MOCK_INCOMING, MOCK_LEADERBOARD, MOCK_ATTEMPTS, delay } from './data';
import { v4 as uuidv4 } from 'uuid';

let quizzes = [...MOCK_QUIZZES];
let attempts = [...MOCK_ATTEMPTS];
let currentUser = { ...MOCK_USER };
let isAuthenticated = false;

const scoreQuiz = (quiz: Quiz, answers: Record<string, string>) => {
  let correct = 0;
  quiz.questions.forEach((q) => {
    if (q.type === 'multiple_choice') {
      const correctOpt = q.options?.find((o) => o.isCorrect);
      if (correctOpt && answers[q.id] === correctOpt.id) correct++;
    } else if (q.correctAnswer && answers[q.id]?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
      correct++;
    }
  });
  return correct;
};

export const mockApiClient: ApiClient = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    await delay();
    if (!data.username || !data.password) throw new Error('Kullanıcı adı ve şifre gerekli');
    isAuthenticated = true;
    return { user: currentUser, accessToken: 'mock-token', refreshToken: 'mock-refresh' };
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    await delay();
    currentUser = {
      ...MOCK_USER,
      name: data.username,
      username: data.username,
      id: uuidv4(),
    };
    isAuthenticated = true;
    return { user: currentUser, accessToken: 'mock-token', refreshToken: 'mock-refresh' };
  },

  async logout() {
    await delay(200);
    isAuthenticated = false;
  },

  async getCurrentUser() {
    await delay();
    if (!isAuthenticated) throw new Error('Unauthorized');
    return currentUser;
  },

  async updateProfile(data) {
    await delay();
    currentUser = { ...currentUser, ...data };
    return currentUser;
  },

  async deleteAccount() {
    await delay();
    isAuthenticated = false;
    currentUser = { ...MOCK_USER };
  },

  async getQuizzes() {
    await delay();
    return quizzes.filter((q) => q.creatorId === currentUser.id || q.status === 'published');
  },

  async getQuiz(id: string) {
    await delay();
    const quiz = quizzes.find((q) => q.id === id);
    if (!quiz) throw new Error('Quiz bulunamadı');
    return quiz;
  },

  async getQuizByShareCode(code: string) {
    await delay();
    const quiz = quizzes.find((q) => q.shareCode === code);
    if (!quiz) throw new Error('Quiz bulunamadı');
    return quiz;
  },

  async createQuiz(data) {
    await delay();
    const quiz: Quiz = {
      ...data,
      id: uuidv4(),
      shareCode: uuidv4().slice(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    quizzes = [quiz, ...quizzes];
    return quiz;
  },

  async updateQuiz(id, data) {
    await delay();
    const idx = quizzes.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Quiz bulunamadı');
    quizzes[idx] = { ...quizzes[idx]!, ...data, updatedAt: new Date().toISOString() };
    return quizzes[idx]!;
  },

  async publishQuiz(id) {
    await delay();
    return this.updateQuiz(id, { status: 'published', publishedAt: new Date().toISOString() });
  },

  async deleteQuiz(id) {
    await delay();
    quizzes = quizzes.filter((q) => q.id !== id);
  },

  async submitAttempt(quizId, answers, solverName) {
    await delay(600);
    const quiz = await this.getQuiz(quizId);
    const correctCount = scoreQuiz(quiz, answers);
    const attempt: QuizAttempt = {
      id: uuidv4(),
      quizId,
      solverName,
      answers,
      score: Math.round((correctCount / quiz.questions.length) * 100),
      totalQuestions: quiz.questions.length,
      correctCount,
      averageTimeSeconds: 12,
      completedAt: new Date().toISOString(),
    };
    attempts = [attempt, ...attempts];
    return attempt;
  },

  async getAttempts(quizId) {
    await delay();
    return attempts.filter((a) => a.quizId === quizId);
  },

  async getIncomingQuizzes() {
    await delay();
    return MOCK_INCOMING;
  },

  async getLeaderboard() {
    await delay();
    return MOCK_LEADERBOARD;
  },

  async getNotifications() {
    await delay();
    return [
      { id: '1', type: 'quiz_solved', title: 'Ahmet testini çözdü!', body: '%90 skor aldı', read: false, createdAt: new Date().toISOString() },
      { id: '2', type: 'quiz_received', title: 'Yeni test geldi', body: 'Zeynep sana bir test gönderdi', read: true, createdAt: new Date().toISOString() },
    ];
  },

  async markNotificationRead(id) {
    await delay(100);
    void id;
  },

  async markAllNotificationsRead() {
    await delay(100);
  },

  async generateQuestions(prompt, count) {
    await delay(1200);
    const friendshipQuestions = [
      'En sevdiğim renk hangisi?',
      'Hangi mevsimi tercih ederim?',
      'En sevdiğim yemek nedir?',
      'Boş zamanlarımda ne yaparım?',
      'En sevdiğim film türü hangisi?',
      'Sabah mı gece insanı mıyım?',
      'En büyük korkum nedir?',
      'Hangi müzik türünü dinlerim?',
      'Tatil için nereyi tercih ederim?',
      'En sevdiğim içecek hangisi?',
      'En sevdiğim spor hangisi?',
      'Hangi süper kahramanı severim?',
      'En sevdiğim meyve hangisi?',
      'Hangi şehirde yaşamak isterim?',
      'En sevdiğim tatlı nedir?',
      'Hangi hayvanı severim?',
      'En sevdiğim dizi türü hangisi?',
      'Hangi hobim var?',
      'En sevdiğim mevsim aktivitesi nedir?',
      'Hangi çiçeği severim?',
    ];
    const selected = friendshipQuestions.slice(0, count);
    return selected.map((text, i): Question => ({
      id: uuidv4(),
      text: prompt ? `${text} (${prompt.slice(0, 20)})` : text,
      type: 'multiple_choice',
      order: i,
      options: [
        { id: uuidv4(), text: 'Seçenek A', isCorrect: true },
        { id: uuidv4(), text: 'Seçenek B' },
        { id: uuidv4(), text: 'Seçenek C' },
        { id: uuidv4(), text: 'Seçenek D' },
      ],
    }));
  },

  async verifyPremium() {
    await delay();
    return { isPremium: currentUser.isPremium, expiresAt: currentUser.premiumExpiresAt };
  },
};

export const setMockAuthenticated = (value: boolean) => {
  isAuthenticated = value;
};

export const setMockUser = (user: typeof MOCK_USER) => {
  currentUser = user;
};
