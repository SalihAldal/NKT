/**
 * Release artifact audit — scans for forbidden strings in source.
 * Run: npx tsx scripts/audit-artifacts.ts
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const FORBIDDEN = [
  'localhost:3000',
  '127.0.0.1',
  'EXPO_PUBLIC_USE_MOCK_API=true',
  'mock-receipt-',
  'super123',
  'nkt_dev_password',
  'change-me-access-secret',
];

const SCAN_DIRS = ['src', 'config', 'app.config.ts'];
const SKIP = ['node_modules', '.test.', '__tests__', '.env.example'];

function scanFile(path: string): string[] {
  const content = readFileSync(path, 'utf-8');
  const hits: string[] = [];
  for (const pattern of FORBIDDEN) {
    if (content.includes(pattern) && !path.includes('.env.example')) {
      hits.push(`${path}: contains "${pattern}"`);
    }
  }
  return hits;
}

function walk(dir: string): string[] {
  const results: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })) return results;
  for (const entry of readdirSync(dir)) {
    if (SKIP.some((s) => entry.includes(s))) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) results.push(...walk(full));
    else if (/\.(ts|tsx|json)$/.test(entry)) results.push(...scanFile(full));
  }
  return results;
}

function main() {
  const hits: string[] = [];
  for (const d of SCAN_DIRS) {
    const full = join(process.cwd(), d);
    try {
      hits.push(...(statSync(full).isDirectory() ? walk(full) : scanFile(full)));
    } catch { /* skip */ }
  }

  console.log('=== Artifact Audit ===');
  if (hits.length === 0) {
    console.log('PASS: No forbidden patterns in production paths');
    process.exit(0);
  }
  hits.forEach((h) => console.warn(`WARNING: ${h}`));
  console.log(`\nWarnings: ${hits.length} (review before production)`);
  process.exit(0);
}

main();
