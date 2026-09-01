import type { QuestionType, QuizStatus, QuizVisibility } from '../constants/enums';

export interface QuizQuestion {
  id: string;
  quizId: string;
  text: string;
  type: QuestionType;
  options?: QuizQuestionOption[];
  correctAnswer?: string;
  order: number;
}

export interface QuizQuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  creatorId: string;
  status: QuizStatus;
  visibility: QuizVisibility;
  timeLimit?: number;
  coverImageUrl?: string;
  theme?: string;
  shareCode: string;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface QuizAnswer {
  questionId: string;
  value: string;
}

export interface QuizSession {
  id: string;
  quizId: string;
  solverId?: string;
  solverDisplayName: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
}

export interface QuizResult {
  id: string;
  sessionId: string;
  quizId: string;
  solverId?: string;
  solverDisplayName: string;
  answers: QuizAnswer[];
  score: number;
  totalQuestions: number;
  correctCount: number;
  averageTimeSeconds: number;
  completedAt: string;
}
