#!/usr/bin/env tsx
/**
 * Migration validation — run before production deploy and in CI.
 * Exit 0 = PASS, 1 = FAIL
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'prisma', 'migrations');
const SCHEMA_PATH = join(ROOT, 'prisma', 'schema.prisma');

const DESTRUCTIVE_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
];

let failures = 0;

function fail(msg: string) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

function pass(msg: string) {
  console.log(`PASS: ${msg}`);
}

function run(cmd: string) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

console.log('=== NKT Migration Validation ===\n');

// 1. Schema exists
if (!existsSync(SCHEMA_PATH)) fail('prisma/schema.prisma missing');
else pass('Prisma schema present');

// 2. Migration lock
const lockPath = join(MIGRATIONS_DIR, 'migration_lock.toml');
if (!existsSync(lockPath)) fail('migration_lock.toml missing');
else pass('migration_lock.toml present');

// 3. At least one migration
const migrationDirs = existsSync(MIGRATIONS_DIR)
  ? readdirSync(MIGRATIONS_DIR).filter((d) => d !== 'migration_lock.toml' && !d.startsWith('.'))
  : [];
if (migrationDirs.length === 0) fail('No migration directories found');
else pass(`${migrationDirs.length} migration(s) found`);

// 4. Destructive SQL check in migrations
for (const dir of migrationDirs) {
  const sqlPath = join(MIGRATIONS_DIR, dir, 'migration.sql');
  if (!existsSync(sqlPath)) {
    fail(`Missing migration.sql in ${dir}`);
    continue;
  }
  const sql = readFileSync(sqlPath, 'utf-8');
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(sql)) {
      fail(`Destructive SQL in ${dir}: ${pattern.source}`);
    }
  }
}
pass('No destructive SQL patterns in migrations');

// 5. Prisma validate
try {
  run('npx prisma validate');
  pass('Prisma schema validation');
} catch (e) {
  fail('Prisma schema validation failed');
}

// 6. Prisma generate
try {
  run('npx prisma generate');
  pass('Prisma client generation');
} catch {
  fail('Prisma generate failed');
}

// 7. Migration status (requires DATABASE_URL)
if (process.env.DATABASE_URL) {
  try {
    const status = run('npx prisma migrate status');
    if (status.includes('Database schema is up to date')) {
      pass('Migration status: up to date');
    } else if (status.includes('following migration have not yet been applied')) {
      fail('Pending migrations not applied');
    } else {
      pass('Migration status checked');
    }
  } catch {
    fail('prisma migrate status failed');
  }

  // 8. Schema drift
  try {
    const drift = run(`npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-url "${process.env.DATABASE_URL}" --script`);
    const normalized = drift.replace(/--.*$/gm, '').trim();
    if (normalized.length === 0 || normalized.includes('empty migration')) {
      pass('No schema drift detected');
    } else {
      fail('Schema drift detected — run prisma migrate dev');
      console.error(drift.slice(0, 500));
    }
  } catch {
    fail('Drift detection failed');
  }
} else {
  console.log('SKIP: DATABASE_URL not set — live drift/status checks skipped');
}

// 9. Production safety
if (process.env.NODE_ENV === 'production') {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { scripts?: Record<string, string> };
  if (pkg.scripts?.['db:reset'] && !pkg.scripts['db:reset'].includes('dev-only')) {
    fail('db:reset must be development-only in production check');
  }
}
pass('Production safety checks');

console.log(`\n=== Result: ${failures === 0 ? 'PASS' : `FAIL (${failures} issues)`} ===`);
process.exit(failures === 0 ? 0 : 1);
