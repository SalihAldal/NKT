/**
 * Audit content dataset difficulty distribution per category.
 * Run: npm run test:content-difficulty
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { FIXED_CATEGORIES } from '../src/domain/constants/categories';
import { verifyDifficultyDistribution } from '../src/services/content/content-dataset-generator';

const datasetPath = join(process.cwd(), 'admin', 'src', 'data', 'content-dataset.json');

if (!existsSync(datasetPath)) {
  console.error('Dataset not found:', datasetPath);
  console.error('Run: npm run content:generate');
  process.exit(1);
}

const items = JSON.parse(readFileSync(datasetPath, 'utf-8')) as Array<{ categoryId: string; difficulty: number }>;
let failed = 0;

console.log('Content difficulty audit —', datasetPath);
console.log('Total items:', items.length);

for (const cat of FIXED_CATEGORIES) {
  const v = verifyDifficultyDistribution(items as never, cat.id);
  const status = v.balanced ? 'PASS' : 'FAIL';
  if (!v.balanced) failed++;
  console.log(`  ${status} ${cat.name}: d1=${v.d1} d2=${v.d2} d3=${v.d3} (need >=90 each)`);
}

process.exit(failed > 0 ? 1 : 0);
