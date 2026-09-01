import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { QuizDraft, Question, QuizCategoryId, Quiz, QuizAttempt } from '@/types';
import { QUIZ_LIMITS } from '@/constants';
import { api } from '@/api/client';
import { aiService } from '@/services/ai';
import { analytics } from '@/services/analytics';

const emptyDraft = (): QuizDraft => ({
  categoryId: null,
  title: '',
  description: '',
  visibility: 'public',
  questions: [],
  step: 1,
});

interface QuizStore {
  draft: QuizDraft;
  currentQuiz: Quiz | null;
  currentAttempt: QuizAttempt | null;
  solvingAnswers: Record<string, string>;
  solvingIndex: number;
  isPublishing: boolean;
  isGeneratingAI: boolean;
  aiError: string | null;

  resetDraft: () => void;
  setCategory: (categoryId: QuizCategoryId) => void;
  setStep: (step: 1 | 2 | 3 | 4) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setVisibility: (visibility: QuizDraft['visibility']) => void;
  addQuestion: (question?: Partial<Question>) => void;
  updateQuestion: (id: string, data: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  reorderQuestions: (questions: Question[]) => void;
  generateWithAI: (prompt: string, count: number, isPremium: boolean) => Promise<void>;
  publishDraft: (creatorId: string, creatorName: string) => Promise<Quiz>;
  loadQuiz: (quizId: string) => Promise<void>;
  startSolving: (quiz: Quiz) => void;
  setAnswer: (questionId: string, answer: string) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  submitQuiz: (solverName: string) => Promise<QuizAttempt>;
  setCurrentAttempt: (attempt: QuizAttempt | null) => void;
  validateDraft: () => { valid: boolean; errors: string[] };
}

export const useQuizStore = create<QuizStore>((set, get) => ({
  draft: emptyDraft(),
  currentQuiz: null,
  currentAttempt: null,
  solvingAnswers: {},
  solvingIndex: 0,
  isPublishing: false,
  isGeneratingAI: false,
  aiError: null,

  resetDraft: () => set({ draft: emptyDraft(), aiError: null }),

  setCategory: (categoryId) => {
    const labels: Record<string, string> = {
      'know-me': 'Beni ne kadar tanıyorsun?',
      partner: 'Sevgilimi ne kadar tanıyorsun?',
      friend: 'Arkadaşımı ne kadar tanıyorsun?',
      family: 'Ailemi ne kadar tanıyorsun?',
      fun: 'Eğlenceli test',
      custom: 'Özel test',
    };
    set((s) => ({
      draft: { ...s.draft, categoryId, title: labels[categoryId] ?? '' },
    }));
  },

  setStep: (step) => set((s) => ({ draft: { ...s.draft, step } })),
  setTitle: (title) => set((s) => ({ draft: { ...s.draft, title } })),
  setDescription: (description) => set((s) => ({ draft: { ...s.draft, description } })),
  setVisibility: (visibility) => set((s) => ({ draft: { ...s.draft, visibility } })),

  addQuestion: (partial) => {
    const q: Question = {
      id: uuidv4(),
      text: partial?.text ?? '',
      type: partial?.type ?? 'multiple_choice',
      order: get().draft.questions.length,
      options: partial?.options ?? [
        { id: uuidv4(), text: 'Seçenek A', isCorrect: true },
        { id: uuidv4(), text: 'Seçenek B' },
        { id: uuidv4(), text: 'Seçenek C' },
        { id: uuidv4(), text: 'Seçenek D' },
      ],
    };
    set((s) => ({ draft: { ...s.draft, questions: [...s.draft.questions, q] } }));
  },

  updateQuestion: (id, data) =>
    set((s) => ({
      draft: {
        ...s.draft,
        questions: s.draft.questions.map((q) => (q.id === id ? { ...q, ...data } : q)),
      },
    })),

  removeQuestion: (id) =>
    set((s) => ({
      draft: {
        ...s.draft,
        questions: s.draft.questions.filter((q) => q.id !== id).map((q, i) => ({ ...q, order: i })),
      },
    })),

  reorderQuestions: (questions) => set((s) => ({ draft: { ...s.draft, questions } })),

  generateWithAI: async (prompt, count, isPremium) => {
    if (!isPremium) {
      set({ aiError: 'AI soru üretimi Premium özelliğidir.' });
      return;
    }
    set({ isGeneratingAI: true, aiError: null });
    try {
      const questions = await aiService.generateQuestions(prompt, count);
      set((s) => ({ draft: { ...s.draft, questions }, isGeneratingAI: false }));
    } catch (e) {
      set({ isGeneratingAI: false, aiError: e instanceof Error ? e.message : 'AI hatası' });
    }
  },

  validateDraft: () => {
    const { draft } = get();
    const errors: string[] = [];
    if (!draft.categoryId) errors.push('Test türü seçmelisin');
    if (!draft.title.trim()) errors.push('Başlık gerekli');
    if (draft.questions.length < QUIZ_LIMITS.MIN_QUESTIONS) {
      errors.push(`En az ${QUIZ_LIMITS.MIN_QUESTIONS} soru eklemelisin`);
    }
    draft.questions.forEach((q, i) => {
      if (!q.text.trim()) errors.push(`Soru ${i + 1}: metin gerekli`);
      if (q.type === 'multiple_choice' && !q.options?.some((o) => o.isCorrect)) {
        errors.push(`Soru ${i + 1}: doğru cevap seçilmeli`);
      }
    });
    return { valid: errors.length === 0, errors };
  },

  publishDraft: async (creatorId, creatorName) => {
    const { draft, validateDraft } = get();
    const validation = validateDraft();
    if (!validation.valid) throw new Error(validation.errors[0]);

    set({ isPublishing: true });
    try {
      const quiz = await api.createQuiz({
        title: draft.title,
        description: draft.description,
        categoryId: draft.categoryId!,
        creatorId,
        creatorName,
        questions: draft.questions,
        status: 'draft',
        visibility: draft.visibility,
        timeLimit: draft.timeLimit,
      });
      const published = await api.publishQuiz(quiz.id);
      analytics.track({ name: 'quiz_created', params: { categoryId: draft.categoryId!, questionCount: draft.questions.length } });
      analytics.track({ name: 'quiz_published', params: { quizId: published.id } });
      set({ currentQuiz: published, isPublishing: false });
      return published;
    } catch (e) {
      set({ isPublishing: false });
      throw e;
    }
  },

  loadQuiz: async (quizId) => {
    const quiz = await api.getQuiz(quizId);
    set({ currentQuiz: quiz });
    analytics.track({ name: 'quiz_opened', params: { quizId, source: 'direct' } });
  },

  startSolving: (quiz) => {
    set({ currentQuiz: quiz, solvingAnswers: {}, solvingIndex: 0 });
    analytics.track({ name: 'quiz_started', params: { quizId: quiz.id } });
  },

  setAnswer: (questionId, answer) =>
    set((s) => ({ solvingAnswers: { ...s.solvingAnswers, [questionId]: answer } })),

  nextQuestion: () => {
    const { currentQuiz, solvingIndex } = get();
    if (!currentQuiz) return;
    if (solvingIndex < currentQuiz.questions.length - 1) {
      set({ solvingIndex: solvingIndex + 1 });
    }
  },

  prevQuestion: () => {
    const { solvingIndex } = get();
    if (solvingIndex > 0) set({ solvingIndex: solvingIndex - 1 });
  },

  submitQuiz: async (solverName) => {
    const { currentQuiz, solvingAnswers } = get();
    if (!currentQuiz) throw new Error('Quiz bulunamadı');
    const attempt = await api.submitAttempt(currentQuiz.id, solvingAnswers, solverName);
    analytics.track({ name: 'quiz_completed', params: { quizId: currentQuiz.id, score: attempt.score } });
    set({ currentAttempt: attempt });
    return attempt;
  },

  setCurrentAttempt: (attempt) => set({ currentAttempt: attempt }),
}));
