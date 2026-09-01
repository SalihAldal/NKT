import { v4 as uuidv4 } from 'uuid';
import type { GameContent } from '@/domain/models/content';
import { CONTENT_QUALITY_STATUS } from '@/domain/constants/content';
import { MODERATION_STATUS, ANSWER_TYPE } from '@/domain/constants/enums';
import { getCategoryById } from '@/domain/constants/categories';
import { CONTENT_DATASET_VERSION } from '@/domain/constants/content-version';
import { computeTypeCounts } from './content-dataset-generator';
import { normalizeContentText } from './content-normalizer';
import { computeQualityScore } from './content-quality-score';

export type BatchStatus = 'pending' | 'generating' | 'generated' | 'validating' | 'completed' | 'failed';

export interface BatchTypeDistribution {
  question: number;
  challenge: number;
  performance: number;
}

export interface BatchDifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export interface ContentGenerationBatch {
  id: string;
  categoryId: string;
  requestedCount: number;
  typeDistribution: BatchTypeDistribution;
  difficultyDistribution: BatchDifficultyDistribution;
  status: BatchStatus;
  generatedContentIds: string[];
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

const AI_PROMPT_TEMPLATES: Record<string, string[]> = {
  question: [
    'Arkadaş grubunda konuşurken en çok hangi konuyu açarsın?',
    'Gece yalnızken aklına gelen ilk düşünce ne olur?',
    'En son ne zaman gerçekten güldün ve neden?',
  ],
  challenge: [
    'Gruba 10 saniye boyunca komik bir dans yap.',
    'Sevdiğin bir şarkının nakaratını mırıldan.',
    'En komik yüz ifadeni 5 saniye göster.',
  ],
  performance: [
    'Mutlu olduğun anı mimiklerinle canlandır.',
    'Ünlü bir karakterin konuşma tarzını taklit et.',
    'En utandığın anındaki halini göster.',
  ],
};

class ContentGenerationBatchService {
  private batches = new Map<string, ContentGenerationBatch>();

  list(): ContentGenerationBatch[] {
    return [...this.batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): ContentGenerationBatch | undefined {
    return this.batches.get(id);
  }

  create(params: {
    categoryId: string;
    count: number;
    typeDistribution?: Partial<BatchTypeDistribution>;
    difficultyDistribution?: Partial<BatchDifficultyDistribution>;
  }): ContentGenerationBatch {
    if (!getCategoryById(params.categoryId)) throw new Error('Invalid category');
    const typeCounts = params.typeDistribution
      ? { question: params.typeDistribution.question ?? 0, challenge: params.typeDistribution.challenge ?? 0, performance: params.typeDistribution.performance ?? 0 }
      : computeTypeCounts(params.categoryId, params.count);
    const diff: BatchDifficultyDistribution = {
      easy: params.difficultyDistribution?.easy ?? Math.floor(params.count / 3),
      medium: params.difficultyDistribution?.medium ?? Math.floor(params.count / 3),
      hard: params.difficultyDistribution?.hard ?? params.count - Math.floor(params.count / 3) * 2,
    };
    const batch: ContentGenerationBatch = {
      id: uuidv4(),
      categoryId: params.categoryId,
      requestedCount: params.count,
      typeDistribution: typeCounts,
      difficultyDistribution: diff,
      status: 'pending',
      generatedContentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.batches.set(batch.id, batch);
    return batch;
  }

  async generate(
    batchId: string,
    existingPrompts: string[],
    onContent: (content: Omit<GameContent, 'id'>) => GameContent,
  ): Promise<ContentGenerationBatch> {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error('Batch not found');
    if (batch.status === 'completed') return batch;

    batch.status = 'generating';
    batch.updatedAt = new Date().toISOString();
    const seen = new Set(existingPrompts.map(normalizeContentText));
    const cat = getCategoryById(batch.categoryId)!;
    let index = 0;
    const failures: string[] = [];

    const types = [
      { type: 'question' as const, count: batch.typeDistribution.question },
      { type: 'challenge' as const, count: batch.typeDistribution.challenge },
      { type: 'performance' as const, count: batch.typeDistribution.performance },
    ].filter((t) => t.count > 0 && cat.supportedContentTypes.includes(t.type));

    try {
      for (const { type, count } of types) {
        for (let i = 0; i < count; i++) {
          const templates = AI_PROMPT_TEMPLATES[type] ?? AI_PROMPT_TEMPLATES.question!;
          const base = templates[index % templates.length]!;
          const prompt = `${base} [AI-${batch.id.slice(0, 6)}-${index}]`;
          const norm = normalizeContentText(prompt);
          if (seen.has(norm)) {
            index++;
            continue;
          }
          seen.add(norm);
          const diff = (Math.floor(i / Math.ceil(count / 3)) + 1) as 1 | 2 | 3;
          const content = onContent({
            categoryId: batch.categoryId,
            type,
            difficulty: diff,
            prompt,
            answerType: type === 'question' ? ANSWER_TYPE.TEXT : ANSWER_TYPE.ACTION,
            tags: ['ai-generated', type],
            ageRating: cat.ageRating === '18+' ? '18+' : cat.ageRating === '16+' ? '16+' : 'all',
            premium: !cat.isFree,
            active: false,
            moderationStatus: MODERATION_STATUS.PENDING,
            qualityStatus: CONTENT_QUALITY_STATUS.DRAFT,
            locale: 'tr-TR',
            contentVersion: CONTENT_DATASET_VERSION,
            normalizedIdentity: norm,
            aiGenerated: true,
            safetyFlags: [],
            diversityTheme: 'ai',
            usageCount: 0,
            completionCount: 0,
            skipCount: 0,
            timeoutCount: 0,
            reportCount: 0,
            averageResponseTimeMs: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            qualityScore: 70,
          });
          batch.generatedContentIds.push(content.id);
          index++;
        }
      }
      batch.status = 'validating';
      batch.updatedAt = new Date().toISOString();
      batch.status = 'completed';
    } catch (e) {
      batch.status = 'failed';
      batch.failureReason = e instanceof Error ? e.message : 'Generation failed';
      failures.push(batch.failureReason);
    }

    batch.updatedAt = new Date().toISOString();
    return batch;
  }

  retry(
    batchId: string,
    existingPrompts: string[],
    onContent: (content: Omit<GameContent, 'id'>) => GameContent,
  ): Promise<ContentGenerationBatch> {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error('Batch not found');
    batch.status = 'pending';
    batch.failureReason = undefined;
    return this.generate(batchId, existingPrompts, onContent);
  }

  _reset(): void {
    this.batches.clear();
  }
}

export const contentGenerationBatchService = new ContentGenerationBatchService();

export const computeContentQualityLabel = (score: number): string => {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Review';
  return 'Poor';
};
