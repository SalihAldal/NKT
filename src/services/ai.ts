import { api } from '@/api/client';
import { logger } from '@/utils/logger';
import type { Question } from '@/types';

export interface AIService {
  generateQuestions(prompt: string, count: number): Promise<Question[]>;
}

class AIServiceImpl implements AIService {
  async generateQuestions(prompt: string, count: number): Promise<Question[]> {
    try {
      return await api.generateQuestions(prompt, count);
    } catch (error) {
      logger.error('AI generation failed', error);
      throw new Error('AI soru üretimi şu an kullanılamıyor. Lütfen manuel ekleyin.');
    }
  }
}

export const aiService = new AIServiceImpl();
