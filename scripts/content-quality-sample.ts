/**
 * Content quality sampling — 5 items per category for manual review.
 * Run: npx tsx scripts/content-quality-sample.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const SAMPLES_PER_CATEGORY = 5;
const OUT = join(process.cwd(), 'release', 'content-quality-sample.json');

interface ContentItem {
  id: string;
  categoryId: string;
  categorySlug?: string;
  prompt: string;
  type?: string;
  difficulty?: number;
  ageRating?: string;
  premium?: boolean;
}

function main() {
  const path = join(process.cwd(), 'admin', 'src', 'data', 'content-dataset.json');
  if (!existsSync(path)) {
    console.error('content-dataset.json not found');
    process.exit(1);
  }
  const items = JSON.parse(readFileSync(path, 'utf-8')) as ContentItem[];
  const byCategory = new Map<string, ContentItem[]>();
  for (const item of items) {
    const key = item.categoryId;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(item);
  }

  const sample: Record<string, ContentItem[]> = {};
  for (const [cat, list] of byCategory) {
    const step = Math.max(1, Math.floor(list.length / SAMPLES_PER_CATEGORY));
    sample[cat] = [];
    for (let i = 0; i < SAMPLES_PER_CATEGORY && i * step < list.length; i++) {
      sample[cat].push(list[i * step]!);
    }
  }

  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), samplesPerCategory: SAMPLES_PER_CATEGORY, sample }, null, 2));
  console.log(`Quality sample written: ${OUT}`);
  console.log(`Categories sampled: ${Object.keys(sample).length}`);
}

main();
