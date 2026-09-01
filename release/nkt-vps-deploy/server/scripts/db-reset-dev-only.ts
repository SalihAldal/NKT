#!/usr/bin/env tsx
/**
 * Development-only database reset.
 * Blocked when NODE_ENV=production.
 */
import { execSync } from 'child_process';

if (process.env.NODE_ENV === 'production') {
  console.error('FATAL: db:reset is not allowed in production');
  process.exit(1);
}

if (process.env.ALLOW_DB_RESET !== 'true') {
  console.error('Set ALLOW_DB_RESET=true to confirm destructive reset');
  process.exit(1);
}

console.log('Resetting database (development only)...');
execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
console.log('Reset complete.');
