import { v4 as uuidv4 } from 'uuid';
import type { QuizApi, CreateQuizDto } from '../contracts/quiz.api';
import type { Quiz, QuizQuestion, QuizResult, QuizSession } from '@/domain/models/quiz';
import { QUIZ_STATUS } from '@/domain/constants/enums';
import { MOCK_QUIZZES, MOCK_ATTEMPTS, MOCK_USER, delay } from './data';
import { mapQuizResultToUiAttempt } from '@/domain/mappers/quiz.mapper';

let quizzes = [...MOCK_QUIZZES];
let attempts = [...MOCK_ATTEMPTS];

const toDomainQuiz = (uiQuiz: (typeof MOCK_QUIZZES)[0]): Quiz => ({
  id: uiQuiz.id,
  title: uiQuiz.title,
  description: uiQuiz.description,
  categoryId: uiQuiz.categoryId,
  creatorId: uiQuiz.creatorId,
  status: uiQuiz.status,
  visibility: uiQuiz.visibility,
  timeLimit: uiQuiz.timeLimit,
  coverImageUrl: uiQuiz.coverImage,
  theme: uiQuiz.theme,
  shareCode: uiQuiz.shareCode,
  questionCount: uiQuiz.questions.length,
  createdAt: uiQuiz.createdAt,
  updatedAt: uiQuiz.updatedAt,
  publishedAt: uiQuiz.publishedAt,
});

const toDomainQuestions = (uiQuiz: (typeof MOCK_QUIZZES)[0]): QuizQuestion[] =>
  uiQuiz.questions.map((q) => ({ ...q, quizId: uiQuiz.id }));

export const createMockQuizApi = (): QuizApi => ({
  async list() {
    await delay();
    return quizzes.map(toDomainQuiz);
  },
  async getById(id) {
    await delay();
    const quiz = quizzes.find((q) => q.id === id);
    if (!quiz) throw new Error('Quiz bulunamadı');
    return { quiz: toDomainQuiz(quiz), questions: toDomainQuestions(quiz), creatorName: quiz.creatorName };
  },
  async getByShareCode(code) {
    await delay();
    const quiz = quizzes.find((q) => q.shareCode === code);
    if (!quiz) throw new Error('Quiz bulunamadı');
    return { quiz: toDomainQuiz(quiz), questions: toDomainQuestions(quiz), creatorName: quiz.creatorName };
  },
  async create(data: CreateQuizDto) {
    await delay();
    const id = uuidv4();
    const now = new Date().toISOString();
    const questions: QuizQuestion[] = data.questions.map((q, i) => ({ ...q, id: q.id ?? uuidv4(), quizId: id, order: i }));
    const uiQuiz = {
      id,
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      creatorId: MOCK_USER.id,
      creatorName: MOCK_USER.name,
      questions: questions.map((q) => ({ id: q.id, text: q.text, type: q.type, options: q.options, correctAnswer: q.correctAnswer, order: q.order })),
      status: QUIZ_STATUS.DRAFT,
      visibility: data.visibility,
      timeLimit: data.timeLimit,
      shareCode: uuidv4().slice(0, 8),
      createdAt: now,
      updatedAt: now,
    };
    quizzes = [uiQuiz as (typeof MOCK_QUIZZES)[0], ...quizzes];
    return { quiz: toDomainQuiz(uiQuiz as (typeof MOCK_QUIZZES)[0]), questions };
  },
  async update(id, data) {
    await delay();
    const idx = quizzes.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Quiz bulunamadı');
    const existing = quizzes[idx]!;
    quizzes[idx] = { ...existing, ...data, updatedAt: new Date().toISOString() } as (typeof MOCK_QUIZZES)[0];
    return toDomainQuiz(quizzes[idx]!);
  },
  async publish(id) {
    await delay();
    const idx = quizzes.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Quiz bulunamadı');
    const existing = quizzes[idx]!;
    quizzes[idx] = {
      ...existing,
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { ...toDomainQuiz(quizzes[idx]!), status: QUIZ_STATUS.PUBLISHED, publishedAt: quizzes[idx]!.publishedAt };
  },
  async delete(id) {
    await delay();
    quizzes = quizzes.filter((q) => q.id !== id);
  },
  async startSession(quizId, solverDisplayName) {
    return { id: uuidv4(), quizId, solverDisplayName, startedAt: new Date().toISOString(), status: 'in_progress' as const };
  },
  async submitResult(sessionId, answers) {
    await delay(600);
    const session = { quizId: quizzes[0]!.id } as QuizSession;
    const quiz = quizzes.find((q) => q.id === session.quizId)!;
    let correct = 0;
    quiz.questions.forEach((q) => {
      const correctOpt = q.options?.find((o) => o.isCorrect);
      if (correctOpt && answers[q.id] === correctOpt.id) correct++;
    });
    const result: QuizResult = {
      id: uuidv4(),
      sessionId,
      quizId: quiz.id,
      solverDisplayName: 'Player',
      answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
      score: Math.round((correct / quiz.questions.length) * 100),
      totalQuestions: quiz.questions.length,
      correctCount: correct,
      averageTimeSeconds: 12,
      completedAt: new Date().toISOString(),
    };
    attempts = [mapQuizResultToUiAttempt(result), ...attempts];
    return result;
  },
  async getResults(quizId) {
    await delay();
    return attempts.filter((a) => a.quizId === quizId).map((a) => ({
      id: a.id,
      sessionId: a.id,
      quizId: a.quizId,
      solverDisplayName: a.solverName,
      answers: Object.entries(a.answers).map(([questionId, value]) => ({ questionId, value })),
      score: a.score,
      totalQuestions: a.totalQuestions,
      correctCount: a.correctCount,
      averageTimeSeconds: a.averageTimeSeconds,
      completedAt: a.completedAt,
    }));
  },
  async generateQuestions(prompt, count) {
    await delay(1200);
    const friendshipQuestions = [
      'En sevdiğim renk hangisi?', 'Hangi mevsimi tercih ederim?', 'En sevdiğim yemek nedir?',
      'Boş zamanlarımda ne yaparım?', 'En sevdiğim film türü hangisi?',
    ];
    return friendshipQuestions.slice(0, count).map((text, i) => ({
      id: `q-${i}`,
      quizId: '',
      text: prompt ? `${text}` : text,
      type: 'multiple_choice' as const,
      order: i,
      options: [
        { id: 'a', text: 'Seçenek A', isCorrect: true },
        { id: 'b', text: 'Seçenek B' },
        { id: 'c', text: 'Seçenek C' },
        { id: 'd', text: 'Seçenek D' },
      ],
    }));
  },
});
