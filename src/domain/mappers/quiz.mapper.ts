import type { Quiz as DomainQuiz, QuizQuestion, QuizResult } from '../models/quiz';
import type { Quiz as UiQuiz, Question, QuizAttempt } from '@/types';

export const mapDomainQuestionToUi = (q: QuizQuestion): Question => ({
  id: q.id,
  text: q.text,
  type: q.type,
  options: q.options,
  correctAnswer: q.correctAnswer,
  order: q.order,
});

export const mapUiQuestionToDomain = (q: Question, quizId: string): QuizQuestion => ({
  id: q.id,
  quizId,
  text: q.text,
  type: q.type,
  options: q.options,
  correctAnswer: q.correctAnswer,
  order: q.order,
});

export const mapDomainQuizToUi = (
  quiz: DomainQuiz,
  questions: QuizQuestion[],
  creatorName: string,
  creatorAvatar?: string,
): UiQuiz => ({
  id: quiz.id,
  title: quiz.title,
  description: quiz.description,
  categoryId: quiz.categoryId,
  creatorId: quiz.creatorId,
  creatorName,
  creatorAvatar,
  questions: questions.map(mapDomainQuestionToUi).sort((a, b) => a.order - b.order),
  status: quiz.status,
  visibility: quiz.visibility,
  timeLimit: quiz.timeLimit,
  coverImage: quiz.coverImageUrl,
  theme: quiz.theme,
  shareCode: quiz.shareCode,
  createdAt: quiz.createdAt,
  updatedAt: quiz.updatedAt,
  publishedAt: quiz.publishedAt,
});

export const mapQuizResultToUiAttempt = (result: QuizResult): QuizAttempt => ({
  id: result.id,
  quizId: result.quizId,
  solverId: result.solverId,
  solverName: result.solverDisplayName,
  answers: Object.fromEntries(result.answers.map((a) => [a.questionId, a.value])),
  score: result.score,
  totalQuestions: result.totalQuestions,
  correctCount: result.correctCount,
  averageTimeSeconds: result.averageTimeSeconds,
  completedAt: result.completedAt,
});
