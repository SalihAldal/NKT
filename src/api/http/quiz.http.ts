import type { QuizApi, CreateQuizDto } from '../contracts/quiz.api';
import type { Quiz, QuizQuestion, QuizResult, QuizSession } from '@/domain/models/quiz';

type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export function createHttpQuizApi(request: RequestFn): QuizApi {
  return {
    list: () => request<Quiz[]>('/api/v1/quizzes'),
    getById: async (id) => {
      const quiz = await request<Quiz & { questions: QuizQuestion[] }>(`/api/v1/quizzes/${id}`);
      return { quiz, questions: quiz.questions ?? [], creatorName: 'User' };
    },
    getByShareCode: (code) => request(`/api/v1/quizzes/share/${code}`),
    create: async (data: CreateQuizDto) => {
      const result = await request<Quiz & { questions: QuizQuestion[] }>('/api/v1/quizzes', { method: 'POST', body: JSON.stringify(data) });
      return { quiz: result, questions: result.questions ?? [] };
    },
    update: (id, data) => request<Quiz>(`/api/v1/quizzes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    publish: (id) => request<Quiz>(`/api/v1/quizzes/${id}/publish`, { method: 'POST' }),
    delete: (id) => request(`/api/v1/quizzes/${id}`, { method: 'DELETE' }),
    startSession: (quizId, solverDisplayName) =>
      request<QuizSession>(`/api/v1/quizzes/${quizId}/sessions`, { method: 'POST', body: JSON.stringify({ solverName: solverDisplayName }) }),
    submitResult: (sessionId, answers) =>
      request<QuizResult>(`/api/v1/quizzes/sessions/${sessionId}/result`, { method: 'POST', body: JSON.stringify({ answers }) }),
    getResults: (quizId) => request<QuizResult[]>(`/api/v1/quizzes/${quizId}/results`),
    generateQuestions: (prompt, count) => request<QuizQuestion[]>('/api/v1/ai/generate', { method: 'POST', body: JSON.stringify({ prompt, count }) }),
  };
}
