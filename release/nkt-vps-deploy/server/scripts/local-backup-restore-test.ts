#!/usr/bin/env tsx
/**
 * Local PostgreSQL backup + restore verification.
 * Run: tsx scripts/local-backup-restore-test.ts
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const parsed = new URL(dbUrl.replace('postgresql://', 'http://'));
const user = parsed.username;
const password = parsed.password;
const host = parsed.hostname;
const port = parsed.port || '5432';
const dbName = parsed.pathname.slice(1).split('?')[0];
const restoreDb = `${dbName}_restore_test`;
const container = process.env.POSTGRES_DOCKER_CONTAINER ?? 'server-postgres-1';

const env = { ...process.env, PGPASSWORD: password };

function hasPgDump(): boolean {
  try {
    execSync('pg_dump --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function psqlAdmin(sql: string) {
  if (hasPgDump()) {
    execSync(`psql -h ${host} -p ${port} -U ${user} -d postgres -c "${sql}"`, { env, stdio: 'inherit' });
    return;
  }
  execSync(`docker exec ${container} psql -U ${user} -d postgres -c "${sql}"`, { env, stdio: 'inherit' });
}

function createBackup(file: string) {
  if (hasPgDump()) {
    execSync(`pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} -f ${file}`, { env, stdio: 'inherit', maxBuffer: 50 * 1024 * 1024 });
    return;
  }
  execSync(`docker exec ${container} pg_dump -U ${user} -d ${dbName} -f /tmp/backup.sql`, { env, stdio: 'inherit' });
  execSync(`docker cp ${container}:/tmp/backup.sql ${file}`, { stdio: 'inherit' });
}

function restoreBackup(file: string, targetDb: string) {
  if (hasPgDump()) {
    execSync(`psql -h ${host} -p ${port} -U ${user} -d ${targetDb} -f ${file}`, { env, stdio: 'inherit' });
    return;
  }
  execSync(`docker cp ${file} ${container}:/tmp/restore.sql`, { stdio: 'inherit' });
  execSync(`docker exec ${container} psql -U ${user} -d ${targetDb} -f /tmp/restore.sql`, { env, stdio: 'inherit' });
}

async function main() {
  const prisma = new PrismaClient();
  const beforeCount = await prisma.gameContent.count();
  console.log(`Content before backup: ${beforeCount}`);

  const backupFile = 'local-backup-test.sql';
  createBackup(backupFile);
  console.log('Backup created:', backupFile);

  psqlAdmin(`DROP DATABASE IF EXISTS ${restoreDb}`);
  psqlAdmin(`CREATE DATABASE ${restoreDb}`);
  restoreBackup(backupFile, restoreDb);

  const restoreUrl = new URL(dbUrl.replace('postgresql://', 'http://'));
  restoreUrl.pathname = `/${restoreDb}`;
  const restorePrisma = new PrismaClient({
    datasources: { db: { url: restoreUrl.toString().replace('http://', 'postgresql://') } },
  });
  const afterCount = await restorePrisma.gameContent.count();
  console.log(`Content after restore: ${afterCount}`);
  if (afterCount !== beforeCount) {
    console.error('RESTORE FAIL: content count mismatch');
    process.exit(1);
  }
  console.log('RESTORE PASS');
  await restorePrisma.$disconnect();
  psqlAdmin(`DROP DATABASE ${restoreDb}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
