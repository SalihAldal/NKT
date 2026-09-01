import type { GameContent } from '@/domain/models/content';
import { stripSensitiveContent } from './content-presenter';

export interface ExportOptions {
  categoryId?: string;
  format: 'json' | 'csv';
  includeInternal?: boolean;
}

const toExportRow = (c: GameContent, includeInternal: boolean) => {
  const base = {
    id: c.id,
    categoryId: c.categoryId,
    type: c.type,
    difficulty: c.difficulty,
    prompt: c.prompt,
    answerType: c.answerType,
    tags: c.tags,
    ageRating: c.ageRating,
    premium: c.premium,
    active: c.active,
    moderationStatus: c.moderationStatus,
    qualityStatus: c.qualityStatus,
    locale: c.locale,
    contentVersion: c.contentVersion,
    qualityScore: c.qualityScore,
    aiGenerated: c.aiGenerated,
    diversityTheme: c.diversityTheme,
    usageCount: c.usageCount,
    completionCount: c.completionCount,
    skipCount: c.skipCount,
    timeoutCount: c.timeoutCount,
    reportCount: c.reportCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
  if (includeInternal) {
    return { ...base, correctAnswer: c.correctAnswer, options: c.options, safetyFlags: c.safetyFlags };
  }
  return stripSensitiveContent({ ...base, options: c.options?.map((o) => ({ id: o.id, text: o.text })) } as GameContent);
};

export const exportContentJson = (items: GameContent[], options: ExportOptions): string => {
  const filtered = options.categoryId ? items.filter((i) => i.categoryId === options.categoryId) : items;
  const rows = filtered.map((c) => toExportRow(c, options.includeInternal ?? false));
  return JSON.stringify(rows, null, 2);
};

export const exportContentCsv = (items: GameContent[], options: ExportOptions): string => {
  const filtered = options.categoryId ? items.filter((i) => i.categoryId === options.categoryId) : items;
  const headers = [
    'id', 'categoryId', 'type', 'difficulty', 'prompt', 'answerType',
    'premium', 'active', 'moderationStatus', 'qualityStatus', 'ageRating',
    'locale', 'contentVersion', 'qualityScore', 'aiGenerated', 'tags',
  ];
  const lines = [headers.join(',')];
  for (const c of filtered) {
    const row = toExportRow(c, false) as Record<string, unknown>;
    lines.push(headers.map((h) => {
      const val = row[h];
      const str = Array.isArray(val) ? val.join(';') : String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    }).join(','));
  }
  return lines.join('\n');
};
