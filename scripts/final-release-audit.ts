/**
 * Final release audit — scans repo for production risks.
 * Run: npx tsx scripts/final-release-audit.ts
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FORBIDDEN_IN_SRC = [
  'nkt_dev_password',
  'change-me-access-secret',
  'sk_live_',
  'sk_test_',
  'EXPO_PUBLIC_USE_MOCK_API=true',
];
const SCAN_DIRS = ['src', 'config', 'app.config.ts', 'server/src'];
const SKIP = ['node_modules', '__tests__', '.test.', 'mock', 'seed.ts'];
const ALLOW_LOCALHOST = ['environment.ts', 'app.config.ts', '.env.example', 'audit-artifacts.ts'];

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

const findings: Finding[] = [];

const ALLOW_PATTERNS = ['environment.ts', 'app.config.ts', '.env.example', 'audit-artifacts.ts', 'final-release-audit.ts', 'phase13-qa.test.ts', 'phase12-integration.test.ts'];

function scanFile(filePath: string) {
  const rel = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  const content = readFileSync(filePath, 'utf-8');
  for (const pattern of FORBIDDEN_IN_SRC) {
    if (content.includes(pattern) && !rel.includes('.env.example') && !ALLOW_PATTERNS.some((a) => rel.includes(a))) {
      // Allow explicit production guards that mention mock flag
      if (pattern === 'EXPO_PUBLIC_USE_MOCK_API=true' && content.includes('FATAL')) continue;
      findings.push({ severity: 'high', message: `${rel}: contains "${pattern}"` });
    }
  }
  if (content.includes('localhost') && !ALLOW_LOCALHOST.some((a) => rel.includes(a)) && !rel.includes('server/src/config')) {
    findings.push({ severity: 'medium', message: `${rel}: contains localhost reference` });
  }
  if (/\bTODO\b|\bFIXME\b/.test(content) && !rel.includes('__tests__')) {
    findings.push({ severity: 'low', message: `${rel}: contains TODO/FIXME` });
  }
}

function walk(dir: string) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (SKIP.some((s) => entry.includes(s))) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|json)$/.test(entry)) scanFile(full);
  }
}

function auditContent() {
  const path = join(ROOT, 'admin', 'src', 'data', 'content-dataset.json');
  if (!existsSync(path)) {
    findings.push({ severity: 'critical', message: 'content-dataset.json missing' });
    return;
  }
  const items = JSON.parse(readFileSync(path, 'utf-8')) as { categoryId?: string; prompt?: string; moderationStatus?: string }[];
  if (items.length !== 6000) {
    findings.push({ severity: 'critical', message: `Content count ${items.length}, expected 6000` });
  }
  const byCat = new Map<string, number>();
  const prompts = new Set<string>();
  let dup = 0;
  for (const item of items) {
    const cat = item.categoryId ?? 'unknown';
    byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
    const p = (item.prompt ?? '').toLowerCase().trim();
    if (prompts.has(p)) dup++;
    else prompts.add(p);
    if (!item.prompt || !item.categoryId) {
      findings.push({ severity: 'high', message: 'Malformed content item found' });
    }
  }
  if (byCat.size !== 20) {
    findings.push({ severity: 'critical', message: `Category count ${byCat.size}, expected 20` });
  }
  for (const [cat, count] of byCat) {
    if (count < 300) findings.push({ severity: 'critical', message: `Category ${cat}: ${count} < 300` });
  }
  if (dup > 0) findings.push({ severity: 'high', message: `${dup} duplicate prompts` });
}

function auditCategories() {
  const freeIds = ['cat-korku', 'cat-cesaret', 'cat-taniyorsun', 'cat-utandiran', 'cat-gece'];
  const seedPath = join(ROOT, 'server', 'prisma', 'seed.ts');
  if (!existsSync(seedPath)) return;
  const seed = readFileSync(seedPath, 'utf-8');
  let freeCount = 0;
  let premiumCount = 0;
  for (const line of seed.split('\n')) {
    if (line.includes('isFree: true')) freeCount++;
    if (line.includes('isFree: false')) premiumCount++;
  }
  if (freeCount !== 5) findings.push({ severity: 'critical', message: `Free categories: ${freeCount}, expected 5` });
  if (premiumCount !== 15) findings.push({ severity: 'critical', message: `Premium categories: ${premiumCount}, expected 15` });
}

function auditInfra() {
  const required = [
    'infra/docker-compose.prod.yml',
    'infra/scripts/deploy.sh',
    'release/launch-manifest.json',
    'docs/DEPLOYMENT.md',
  ];
  for (const f of required) {
    if (!existsSync(join(ROOT, f))) {
      findings.push({ severity: 'high', message: `Missing: ${f}` });
    }
  }
  const migrationsDir = join(ROOT, 'server', 'prisma', 'migrations');
  if (!existsSync(migrationsDir) || readdirSync(migrationsDir).length === 0) {
    findings.push({ severity: 'critical', message: 'Prisma migrations not created' });
  }
}

// Run audits
for (const d of SCAN_DIRS) {
  const full = join(ROOT, d);
  try {
    if (statSync(full).isDirectory()) walk(full);
    else scanFile(full);
  } catch { /* skip */ }
}
auditContent();
auditCategories();
auditInfra();

// Realtime mock check
const realtimePath = join(ROOT, 'src', 'services', 'realtime', 'realtime-client.ts');
if (existsSync(realtimePath)) {
  const rt = readFileSync(realtimePath, 'utf-8');
  if (rt.includes('MockRealtimeClient') && !rt.includes('SocketIORealtimeClient')) {
    findings.push({ severity: 'critical', message: 'Mobile realtime still uses MockRealtimeClient — production multiplayer blocked' });
  }
}

console.log('=== NKT Final Release Audit ===\n');
const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
for (const f of findings) {
  console.log(`[${f.severity.toUpperCase()}] ${f.message}`);
  bySeverity[f.severity]++;
}
console.log(`\nSummary: critical=${bySeverity.critical} high=${bySeverity.high} medium=${bySeverity.medium} low=${bySeverity.low}`);
const blockers = bySeverity.critical + bySeverity.high;
process.exit(blockers > 0 ? 1 : 0);
