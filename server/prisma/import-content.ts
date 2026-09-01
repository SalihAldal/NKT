/**
 * Production content import — separate from migrations and seed.
 * Usage: npx tsx prisma/import-content.ts [--file path/to/content-dataset.json]
 *
 * NOT run automatically on deploy. Explicit operator action only.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient, type ContentType, type ContentModerationStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface DatasetRow {
  id: string;
  categoryId: string;
  type: string;
  difficulty: number;
  prompt: string;
  options?: unknown;
  correctAnswer?: string;
  premium?: boolean;
  active?: boolean;
  moderationStatus?: string;
  ageRating?: string;
  qualityScore?: number;
  aiGenerated?: boolean;
  contentVersion?: string;
}

const TYPE_MAP: Record<string, ContentType> = {
  question: 'QUESTION',
  challenge: 'CHALLENGE',
  performance: 'PERFORMANCE',
};

const MOD_MAP: Record<string, ContentModerationStatus> = {
  draft: 'DRAFT',
  review: 'REVIEW',
  approved: 'APPROVED',
  active: 'ACTIVE',
  rejected: 'REJECTED',
  disabled: 'DISABLED',
};

function resolveDatasetPath(): string {
  const argIdx = process.argv.indexOf('--file');
  if (argIdx >= 0 && process.argv[argIdx + 1]) {
    return resolve(process.argv[argIdx + 1]!);
  }
  const candidates = [
    resolve(process.cwd(), 'data', 'content-dataset.json'),
    resolve(process.cwd(), '..', 'admin', 'src', 'data', 'content-dataset.json'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return candidates[0]!;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_CONTENT_IMPORT !== 'true') {
    console.error('Content import blocked in production. Set ALLOW_CONTENT_IMPORT=true to proceed.');
    process.exit(1);
  }

  const filePath = resolveDatasetPath();
  if (!existsSync(filePath)) {
    console.error(`Dataset not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Loading content from ${filePath}...`);
  const rows = JSON.parse(readFileSync(filePath, 'utf-8')) as DatasetRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('Dataset is empty or invalid');
    process.exit(1);
  }

  const categories = new Set((await prisma.category.findMany({ select: { id: true } })).map((c) => c.id));
  let imported = 0;
  let skipped = 0;
  const batchSize = 200;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const ops = [];
    for (const row of batch) {
      if (!categories.has(row.categoryId)) {
        skipped++;
        continue;
      }
      const type = TYPE_MAP[row.type.toLowerCase()] ?? 'QUESTION';
      const moderationStatus = MOD_MAP[(row.moderationStatus ?? 'approved').toLowerCase()] ?? 'APPROVED';
      const active = row.active ?? true;
      const modStatus = active ? (moderationStatus === 'DRAFT' ? 'APPROVED' : moderationStatus) : moderationStatus;
      ops.push(prisma.gameContent.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          categoryId: row.categoryId,
          type,
          difficulty: row.difficulty,
          prompt: row.prompt,
          options: row.options ?? undefined,
          correctAnswer: row.correctAnswer,
          premium: row.premium ?? false,
          active,
          moderationStatus: modStatus,
          ageRating: row.ageRating ?? 'all',
          qualityScore: row.qualityScore ?? 85,
          aiGenerated: row.aiGenerated ?? false,
          contentVersion: row.contentVersion ?? '2026.1',
        },
        update: {
          prompt: row.prompt,
          options: row.options ?? undefined,
          correctAnswer: row.correctAnswer,
          active,
          moderationStatus: modStatus,
          qualityScore: row.qualityScore ?? 85,
        },
      }));
    }
    if (ops.length) await prisma.$transaction(ops);
    imported += ops.length;
    console.log(`  batch ${Math.floor(i / batchSize) + 1}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }

  const total = await prisma.gameContent.count();
  console.log(`Import complete. Rows processed: ${rows.length}, skipped (unknown category): ${skipped}, total in DB: ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
