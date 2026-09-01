/**
 * Content release audit — checks category counts for production readiness.
 * Run: npx tsx scripts/audit-content-release.ts
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIN_PER_CATEGORY = 300;
const TARGET_CATEGORIES = 20;

interface ContentItem {
  categoryId?: string;
  categorySlug?: string;
  status?: string;
  moderationStatus?: string;
  premium?: boolean;
  ageRating?: string;
}

function main() {
  const datasetPath = join(process.cwd(), 'admin', 'src', 'data', 'content-dataset.json');
  if (!existsSync(datasetPath)) {
    console.error('BLOCKER: content-dataset.json not found');
    process.exit(1);
  }

  const items = JSON.parse(readFileSync(datasetPath, 'utf-8')) as ContentItem[];
  const byCategory = new Map<string, number>();

  for (const item of items) {
    const key = item.categorySlug ?? item.categoryId ?? 'unknown';
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
  }

  console.log('=== NKT Content Release Audit ===');
  console.log(`Total items: ${items.length}`);
  console.log(`Categories: ${byCategory.size}`);

  let blockers = 0;
  if (byCategory.size < TARGET_CATEGORIES) {
    console.error(`BLOCKER: Expected ${TARGET_CATEGORIES} categories, found ${byCategory.size}`);
    blockers++;
  }

  for (const [cat, count] of byCategory) {
    const status = count >= MIN_PER_CATEGORY ? 'PASS' : 'FAIL';
    console.log(`  ${cat}: ${count} [${status}]`);
    if (count < MIN_PER_CATEGORY) blockers++;
  }

  const unapproved = items.filter((i) => i.moderationStatus && !['APPROVED', 'ACTIVE'].includes(i.moderationStatus));
  if (unapproved.length > 0) {
    console.warn(`WARNING: ${unapproved.length} items not approved/active`);
  }

  console.log(`\nBlockers: ${blockers}`);
  process.exit(blockers > 0 ? 1 : 0);
}

main();
