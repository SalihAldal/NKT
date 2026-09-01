/**
 * Generate production content dataset JSON files.
 * Run: npx tsx scripts/generate-content-dataset.ts
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { generateFullDataset, getDatasetStats, verifyDifficultyDistribution } from '../src/services/content/content-dataset-generator';
import { FIXED_CATEGORIES } from '../src/domain/constants/categories';
import { CONTENT_DATASET_VERSION } from '../src/domain/constants/content-version';

const outDir = join(process.cwd(), 'src', 'data', 'content', `v${CONTENT_DATASET_VERSION}`);

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

console.log('Generating production dataset...');
const dataset = generateFullDataset();
const stats = getDatasetStats(dataset);

writeFileSync(join(outDir, 'dataset.json'), JSON.stringify(dataset), 'utf-8');

const adminDir = join(process.cwd(), 'admin', 'src', 'data');
if (!existsSync(adminDir)) mkdirSync(adminDir, { recursive: true });
writeFileSync(join(adminDir, 'content-dataset.json'), JSON.stringify(dataset), 'utf-8');

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({
  version: CONTENT_DATASET_VERSION,
  total: stats.total,
  generatedAt: new Date().toISOString(),
  byCategory: stats.byCategory,
  byType: stats.byType,
  byDifficulty: stats.byDifficulty,
}, null, 2), 'utf-8');

console.log(`Total: ${stats.total}`);
FIXED_CATEGORIES.forEach((c) => {
  const v = verifyDifficultyDistribution(dataset, c.id);
  const status = (stats.byCategory[c.id] ?? 0) >= 300 && v.balanced ? 'PASS' : 'FAIL';
  console.log(`  ${c.name}: ${stats.byCategory[c.id]} (${status})`);
});
console.log(`Written to ${outDir}`);
