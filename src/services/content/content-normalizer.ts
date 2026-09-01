/** Normalize text for duplicate detection */
export const normalizeContentText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const textsAreExactDuplicate = (a: string, b: string): boolean =>
  normalizeContentText(a) === normalizeContentText(b);

/** Simple Jaccard similarity on word tokens */
export const textSimilarity = (a: string, b: string): number => {
  const wordsA = new Set(normalizeContentText(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalizeContentText(b).split(' ').filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
};

export const SIMILARITY_THRESHOLD = 0.85;

export interface DuplicateCheckResult {
  isExactDuplicate: boolean;
  similarItems: Array<{ id: string; prompt: string; similarity: number }>;
}

export const checkDuplicate = (
  prompt: string,
  existing: Array<{ id: string; prompt: string }>,
): DuplicateCheckResult => {
  const similarItems: DuplicateCheckResult['similarItems'] = [];
  let isExactDuplicate = false;

  for (const item of existing) {
    if (textsAreExactDuplicate(prompt, item.prompt)) {
      isExactDuplicate = true;
      similarItems.push({ id: item.id, prompt: item.prompt, similarity: 1 });
      continue;
    }
    const sim = textSimilarity(prompt, item.prompt);
    if (sim >= SIMILARITY_THRESHOLD) {
      similarItems.push({ id: item.id, prompt: item.prompt, similarity: sim });
    }
  }

  return { isExactDuplicate, similarItems };
};
