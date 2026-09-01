import type { Question, Quiz, User, IncomingQuiz, LeaderboardEntry, QuizAttempt } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const now = () => new Date().toISOString();
const futurePremium = () => new Date(Date.now() + 365 * 86400000).toISOString();

export const MOCK_USER: User = {
  id: 'user-1',
  email: 'salih@nkt.app',
  name: 'Salih Aydın',
  username: 'salihaydin',
  avatar: undefined,
  isPremium: true,
  premiumExpiresAt: futurePremium(),
  stats: {
    quizzesCreated: 12,
    quizzesCompleted: 28,
    averageScore: 87,
    friendsCount: 45,
    badgesCount: 6,
  },
  createdAt: '2025-01-15T00:00:00.000Z',
};

const createQuestions = (categoryId: string): Question[] => {
  const templates: Record<string, string[]> = {
    'know-me': [
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
    ],
    partner: [
      'İlk buluşmamız nerede oldu?',
      'En sevdiğim hediye neydi?',
      'Birlikte en çok nereye gitmek isterim?',
      'En sevdiğim özelliğim hangisi?',
      'Hangi şarkı bizi hatırlatır?',
    ],
    friend: [
      'En sevdiğim aktivite hangisi?',
      'Hangi takımı tutarım?',
      'En komik anımız hangisi?',
      'Hangi oyunu oynamayı severim?',
      'En sevdiğim atıştırmalık nedir?',
    ],
    family: [
      'Ailede en yakın olduğum kişi kim?',
      'Çocukken en sevdiğim yemek neydi?',
      'Aile geleneğimiz hangisi?',
      'En sevdiğim aile anısı hangisi?',
      'Bayramda ne yaparız?',
    ],
    fun: [
      'Süper gücüm olsa ne olurdu?',
      'Hangi ünlüyle kahve içmek isterim?',
      'Zombi kıyametinde ne yaparım?',
      'Hangi hayvan olmak isterdim?',
      'Para kazansam ilk ne alırım?',
    ],
    custom: [
      'Soru 1',
      'Soru 2',
      'Soru 3',
    ],
  };

  const texts = templates[categoryId] ?? templates['know-me']!;
  return texts.map((text, i) => ({
    id: uuidv4(),
    text,
    type: 'multiple_choice' as const,
    order: i,
    options: [
      { id: uuidv4(), text: 'Seçenek A', isCorrect: i % 4 === 0 },
      { id: uuidv4(), text: 'Seçenek B', isCorrect: i % 4 === 1 },
      { id: uuidv4(), text: 'Seçenek C', isCorrect: i % 4 === 2 },
      { id: uuidv4(), text: 'Seçenek D', isCorrect: i % 4 === 3 },
    ],
  }));
};

export const MOCK_QUIZZES: Quiz[] = [
  {
    id: 'quiz-1',
    title: "Salih'i ne kadar tanıyorsun?",
    description: 'Arkadaşlık testi',
    categoryId: 'know-me',
    creatorId: MOCK_USER.id,
    creatorName: MOCK_USER.name,
    questions: createQuestions('know-me'),
    status: 'published',
    visibility: 'public',
    shareCode: 'salih2024',
    createdAt: now(),
    updatedAt: now(),
    publishedAt: now(),
  },
  {
    id: 'quiz-2',
    title: 'Eğlenceli Test',
    categoryId: 'fun',
    creatorId: 'user-2',
    creatorName: 'Ahmet Yılmaz',
    questions: createQuestions('fun').slice(0, 5),
    status: 'published',
    visibility: 'public',
    shareCode: 'ahmet-fun',
    createdAt: now(),
    updatedAt: now(),
    publishedAt: now(),
  },
];

export const MOCK_INCOMING: IncomingQuiz[] = [
  {
    id: 'incoming-1',
    quiz: MOCK_QUIZZES[0]!,
    senderId: MOCK_USER.id,
    senderName: MOCK_USER.name,
    isNew: true,
    receivedAt: now(),
  },
  {
    id: 'incoming-2',
    quiz: MOCK_QUIZZES[1]!,
    senderId: 'user-2',
    senderName: 'Ahmet Yılmaz',
    isNew: false,
    receivedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: 'u2', name: 'Ahmet', username: 'ahmet', score: 10, percentage: 100, totalQuestions: 10 },
  { rank: 2, userId: 'u3', name: 'Zeynep', username: 'zeynep', score: 9, percentage: 90, totalQuestions: 10 },
  { rank: 3, userId: 'u4', name: 'Mehmet', username: 'mehmet', score: 8, percentage: 80, totalQuestions: 10 },
  { rank: 4, userId: 'u5', name: 'Ayşe', username: 'ayse', score: 8, percentage: 80, totalQuestions: 10 },
  { rank: 5, userId: MOCK_USER.id, name: 'Salih', username: 'salihaydin', score: 7, percentage: 70, totalQuestions: 10, isCurrentUser: true },
  { rank: 6, userId: 'u6', name: 'Can', username: 'can', score: 7, percentage: 70, totalQuestions: 10 },
  { rank: 7, userId: 'u7', name: 'Elif', username: 'elif', score: 6, percentage: 60, totalQuestions: 10 },
  { rank: 8, userId: 'u8', name: 'Burak', username: 'burak', score: 5, percentage: 50, totalQuestions: 10 },
];

export const MOCK_ATTEMPTS: QuizAttempt[] = [];

export const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));
