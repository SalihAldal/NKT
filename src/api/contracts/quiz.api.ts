import type { Quiz, QuizQuestion, QuizResult, QuizSession } from '@/domain/models/quiz';

export interface CreateQuizDto {
  title: string;
  description?: string;
  categoryId: string;
  visibility: Quiz['visibility'];
  timeLimit?: number;
  questions: Omit<QuizQuestion, 'quizId'>[];
}

export interface QuizApi {
  list(): Promise<Quiz[]>;
  getById(id: string): Promise<{ quiz: Quiz; questions: QuizQuestion[]; creatorName: string }>;
  getByShareCode(code: string): Promise<{ quiz: Quiz; questions: QuizQuestion[]; creatorName: string }>;
  create(data: CreateQuizDto): Promise<{ quiz: Quiz; questions: QuizQuestion[] }>;
  update(id: string, data: Partial<CreateQuizDto>): Promise<Quiz>;
  publish(id: string): Promise<Quiz>;
  delete(id: string): Promise<void>;
  startSession(quizId: string, solverDisplayName: string): Promise<QuizSession>;
  submitResult(sessionId: string, answers: Record<string, string>): Promise<QuizResult>;
  getResults(quizId: string): Promise<QuizResult[]>;
  generateQuestions(prompt: string, count: number): Promise<QuizQuestion[]>;
}
