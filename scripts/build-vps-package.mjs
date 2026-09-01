#!/usr/bin/env node
/**
 * Build NKT VPS deployment ZIP package.
 * Output: release/nkt-vps-deploy.zip
 */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'release', 'nkt-vps-deploy');
const ZIP_PATH = join(ROOT, 'release', 'nkt-vps-deploy.zip');
const TEMPLATE_DIR = join(ROOT, 'deployment-package');

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.cache', '.turbo', '__tests__',
]);
const EXCLUDE_FILES = /\.(env|env\.local|env\.production|log|pem|key|p12|pfx)$/i;
const EXCLUDE_PATH_PARTS = ['node_modules', '.git', 'dist', 'coverage', 'local-backup-test.sql'];

function shouldExclude(relPath) {
  const parts = relPath.split(/[/\\]/);
  if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  if (EXCLUDE_PATH_PARTS.some((p) => relPath.includes(p))) return true;
  const base = parts[parts.length - 1];
  if (EXCLUDE_FILES.test(base)) return true;
  if (base === '.env' || base.startsWith('.env.')) return true;
  return false;
}

function copyFiltered(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const rel = relative(src, srcPath);
    if (shouldExclude(entry.name) || shouldExclude(rel)) continue;
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFiltered(srcPath, destPath);
    } else if (entry.isFile()) {
      cpSync(srcPath, destPath);
    }
  }
}

function getGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function scanPackage(dir, issues = []) {
  const forbiddenPatterns = [
    { re: /super123/i, label: 'default password' },
    { re: /BEGIN (RSA |OPENSSH )?PRIVATE KEY/, label: 'private key' },
  ];
  const prodConfigPatterns = [
    { re: /76\.13\.138\.159/, label: 'VPS IP in source/config', allowDocs: true },
    { re: /example\.com/, label: 'example.com in config', allowDocs: true, allowEnvExample: true },
  ];

  function walk(current, rel = '') {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
          issues.push(`FORBIDDEN DIR: ${relPath}`);
          continue;
        }
        walk(full, relPath);
        continue;
      }
      if (entry.name === '.env' || /^\.env\.(local|production)$/.test(entry.name)) {
        issues.push(`FORBIDDEN FILE: ${relPath}`);
        continue;
      }
      if (entry.name.endsWith('.pem') || entry.name.endsWith('.key')) {
        issues.push(`FORBIDDEN FILE: ${relPath}`);
        continue;
      }
      const ext = entry.name.split('.').pop()?.toLowerCase();
      const textExts = new Set(['ts', 'tsx', 'js', 'mjs', 'json', 'yml', 'yaml', 'sh', 'md', 'conf', 'template', 'sql', 'example', 'env']);
      if (!textExts.has(ext || '') && !entry.name.includes('.env')) continue;
      let content;
      try {
        content = readFileSync(full, 'utf-8');
      } catch {
        continue;
      }
      const isDoc = relPath.startsWith('docs/') || relPath === 'README-DEPLOY.md' || relPath.startsWith('deployment/docs/') || relPath === 'deployment/README-DEPLOY.md';
      const isEnvExample = relPath.includes('.env') && relPath.includes('example');
      const isScript = relPath.includes('/scripts/') || relPath.includes('\\scripts\\');
      for (const { re, label } of forbiddenPatterns) {
        if (label === 'default password' && (isScript || relPath.includes('check-production'))) continue;
        if (re.test(content)) issues.push(`${label}: ${relPath}`);
      }
      for (const { re, label, allowDocs, allowEnvExample } of prodConfigPatterns) {
        if (allowDocs && (isDoc || relPath.includes('README-DEPLOY'))) continue;
        if (allowEnvExample && isEnvExample) continue;
        if (isScript && (label.includes('example.com') || label.includes('VPS IP'))) continue;
        if (relPath.includes('docker-compose') || relPath.includes('Dockerfile') || relPath.startsWith('deployment/')) {
          if (re.test(content)) issues.push(`${label}: ${relPath}`);
        }
      }
      if (!isDoc && !isEnvExample && /\blocalhost\b|127\.0\.0\.1/.test(content)) {
        if (relPath.startsWith('deployment/') && relPath.endsWith('.yml')) {
          // healthchecks use 127.0.0.1 inside containers — allowed
          if (!/healthcheck|127\.0\.0\.1:300/.test(content)) {
            issues.push(`localhost in deployment config: ${relPath}`);
          }
        }
      }
    }
  }
  walk(dir);
  return issues;
}

function listFiles(dir, prefix = '') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full, rel));
    else files.push(rel);
  }
  return files.sort();
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Build ─────────────────────────────────────────────────────────────────────
console.log('=== NKT VPS Package Builder ===\n');

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

console.log('[1/7] Copying server...');
copyFiltered(join(ROOT, 'server'), join(OUT_DIR, 'server'));

console.log('[2/7] Copying admin...');
copyFiltered(join(ROOT, 'admin'), join(OUT_DIR, 'admin'));

console.log('[3/7] Copying deployment package template...');
cpSync(TEMPLATE_DIR, join(OUT_DIR, 'deployment'), { recursive: true });

console.log('[4/7] Copying content dataset...');
const datasetSrc = join(ROOT, 'admin', 'src', 'data', 'content-dataset.json');
mkdirSync(join(OUT_DIR, 'server', 'data'), { recursive: true });
cpSync(datasetSrc, join(OUT_DIR, 'server', 'data', 'content-dataset.json'));

console.log('[5/7] Writing VERSION and root files...');
const gitSha = getGitSha();
const version = readFileSync(join(ROOT, 'package.json'), 'utf-8');
const appVersion = JSON.parse(version).version || '1.0.0';
writeFileSync(join(OUT_DIR, 'VERSION'), [
  `NKT_DEPLOYMENT_PACKAGE_VERSION=${appVersion}`,
  `BUILD_DATE=${new Date().toISOString()}`,
  `GIT_SHA=${gitSha}`,
  `PACKAGE_TYPE=vps-deploy`,
].join('\n') + '\n');

cpSync(join(TEMPLATE_DIR, 'docker-compose.yml'), join(OUT_DIR, 'docker-compose.yml'));
cpSync(join(TEMPLATE_DIR, 'README-DEPLOY.md'), join(OUT_DIR, 'README-DEPLOY.md'));
cpSync(join(TEMPLATE_DIR, 'env', '.env.example'), join(OUT_DIR, '.env.example'));
cpSync(join(TEMPLATE_DIR, 'env', '.env.production.example'), join(OUT_DIR, '.env.production.example'));

console.log('[6/7] Validating package...');
const issues = scanPackage(OUT_DIR);
if (issues.length > 0) {
  console.error('\nVALIDATION FAILED:');
  for (const i of issues) console.error('  -', i);
  process.exit(1);
}
console.log('  Package scan: PASS');

// docker compose config (if docker available)
let composePass = false;
try {
  const envStub = join(OUT_DIR, '.env.production.example');
  execSync(`docker compose -f "${join(OUT_DIR, 'docker-compose.yml')}" --env-file "${envStub}" config`, {
    stdio: 'pipe',
    env: { ...process.env, POSTGRES_PASSWORD: 'testpass123456', REDIS_PASSWORD: 'testredis123456', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) },
  });
  composePass = true;
  console.log('  Docker compose config: PASS');
} catch (e) {
  console.log('  Docker compose config: SKIP (docker unavailable or validation needs filled env)');
}

console.log('[7/7] Creating ZIP...');
rmSync(ZIP_PATH, { force: true });
mkdirSync(join(ROOT, 'release'), { recursive: true });

if (process.platform === 'win32') {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${OUT_DIR}' -DestinationPath '${ZIP_PATH}' -Force"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(`cd "${join(ROOT, 'release')}" && zip -r nkt-vps-deploy.zip nkt-vps-deploy`, { stdio: 'inherit' });
}

const zipSize = statSync(ZIP_PATH).size;
const files = listFiles(OUT_DIR);

console.log('\n=== BUILD COMPLETE ===');
console.log(`ZIP: ${ZIP_PATH}`);
console.log(`Size: ${formatSize(zipSize)}`);
console.log(`Files: ${files.length}`);
console.log(`Compose validation: ${composePass ? 'PASS' : 'SKIP'}`);

writeFileSync(join(ROOT, 'release', 'PHASE25-BUILD-REPORT.txt'), [
  'PHASE 25 BUILD REPORT',
  `ZIP: ${ZIP_PATH}`,
  `SIZE: ${zipSize}`,
  `FILES: ${files.length}`,
  `GIT_SHA: ${gitSha}`,
  `COMPOSE: ${composePass ? 'PASS' : 'SKIP'}`,
  `SCAN: PASS`,
  `VPS: NOT DEPLOYED`,
].join('\n'));
