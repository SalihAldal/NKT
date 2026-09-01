import { getCategoryById } from '@/domain/constants/categories';
import { DifficultyResolver } from '@/services/content/content-selector';
import { checkDuplicate } from '@/services/content/content-normalizer';
import { moderationService } from '@/services/moderation/moderation.service';

export interface ContentValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ContentValidationResult {
  valid: boolean;
  issues: ContentValidationIssue[];
  safetyFlags: string[];
}

const MIN_PROMPT_LENGTH = 8;

export const validateContentRow = (
  row: Record<string, unknown>,
  existingPrompts: string[] = [],
): ContentValidationResult => {
  const issues: ContentValidationIssue[] = [];
  const safetyFlags: string[] = [];

  const prompt = String(row.prompt ?? '').trim();
  const categoryId = String(row.categoryId ?? '');
  const difficulty = Number(row.difficulty ?? 1);
  const type = String(row.type ?? 'question');
  const ageRating = String(row.ageRating ?? 'all');
  const premium = row.premium === true || row.premium === 'true';

  if (!prompt) issues.push({ field: 'prompt', message: 'Empty prompt', severity: 'error' });
  else if (prompt.length < MIN_PROMPT_LENGTH) {
    issues.push({ field: 'prompt', message: 'Prompt too short', severity: 'error' });
  }

  if (!categoryId) issues.push({ field: 'categoryId', message: 'Missing category', severity: 'error' });
  else if (!getCategoryById(categoryId)) {
    issues.push({ field: 'categoryId', message: 'Invalid category', severity: 'error' });
  } else {
    const cat = getCategoryById(categoryId)!;
    if (premium && cat.isFree) {
      issues.push({ field: 'premium', message: 'Premium mismatch for free category', severity: 'warning' });
    }
    if (cat.ageRating === '18+' && ageRating !== '18+') {
      issues.push({ field: 'ageRating', message: '+18 category requires ageRating 18+', severity: 'error' });
    }
  }

  try { DifficultyResolver.normalize(difficulty); } catch {
    issues.push({ field: 'difficulty', message: 'Invalid difficulty (1-3)', severity: 'error' });
  }

  if (!['question', 'challenge', 'performance'].includes(type)) {
    issues.push({ field: 'type', message: 'Invalid content type', severity: 'error' });
  }

  if (!['all', '13+', '16+', '18+'].includes(ageRating)) {
    issues.push({ field: 'ageRating', message: 'Invalid age rating', severity: 'error' });
  }

  if (type === 'question' && (row.answerType === 'choice' || (!row.answerType && row.options))) {
    const opts = row.options;
    if (opts && typeof opts === 'string' && !opts.trim()) {
      issues.push({ field: 'options', message: 'Malformed options for choice question', severity: 'error' });
    }
  }

  const dup = checkDuplicate(prompt, existingPrompts.map((p, i) => ({ id: String(i), prompt: p })));
  if (dup.isExactDuplicate) issues.push({ field: 'prompt', message: 'Exact duplicate', severity: 'error' });
  else if (dup.similarItems.length > 0) {
    issues.push({ field: 'prompt', message: 'Similar content detected', severity: 'warning' });
  }

  if (moderationService.filter.containsProfanity(prompt)) {
    safetyFlags.push('profanity');
    issues.push({ field: 'prompt', message: 'Profanity detected', severity: 'error' });
  }

  const riskyPatterns = [
    { pattern: /intihar|kendine zarar/i, flag: 'self_harm' },
    { pattern: /öldür|tehdit/i, flag: 'threat' },
    { pattern: /nefret|ırkçı/i, flag: 'hate' },
  ];
  riskyPatterns.forEach(({ pattern, flag }) => {
    if (pattern.test(prompt)) {
      safetyFlags.push(flag);
      issues.push({ field: 'prompt', message: `Safety flag: ${flag}`, severity: 'warning' });
    }
  });

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
    safetyFlags,
  };
};
