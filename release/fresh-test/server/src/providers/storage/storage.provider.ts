import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { config } from '../../config/index.js';
import { storageBreaker } from '../../common/circuit-breaker.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadIntent {
  key: string;
  uploadUrl: string;
  expiresAt: string;
  maxBytes: number;
  allowedMime: string[];
}

export interface StoredObject {
  key: string;
  url: string;
  mime: string;
  size: number;
}

function localUploadDir() {
  return resolve(process.cwd(), 'uploads');
}

export function validateUploadMeta(mime: string, size: number): void {
  if (!ALLOWED_MIME.has(mime)) throw new Error('INVALID_MIME');
  if (size > MAX_BYTES) throw new Error('FILE_TOO_LARGE');
}

export async function createPresignedUpload(ownerId: string, purpose: 'avatar' | 'cover' | 'support'): Promise<UploadIntent> {
  return storageBreaker.execute(async () => {
    const ext = 'jpg';
    const key = `${purpose}/${ownerId}/${randomUUID()}.${ext}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    if (config.STORAGE_PROVIDER === 'local') {
      await mkdir(join(localUploadDir(), purpose, ownerId), { recursive: true });
      return {
        key,
        uploadUrl: `/api/v1/storage/upload/${encodeURIComponent(key)}`,
        expiresAt,
        maxBytes: MAX_BYTES,
        allowedMime: [...ALLOWED_MIME],
      };
    }

    // S3-compatible placeholder — configure STORAGE_ENDPOINT + credentials in production
    return {
      key,
      uploadUrl: `https://${config.STORAGE_BUCKET}.s3.amazonaws.com/${key}`,
      expiresAt,
      maxBytes: MAX_BYTES,
      allowedMime: [...ALLOWED_MIME],
    };
  });
}

export async function storeLocalUpload(key: string, buffer: Buffer, mime: string): Promise<StoredObject> {
  validateUploadMeta(mime, buffer.length);
  const safeKey = key.replace(/\.\./g, '');
  const filePath = join(localUploadDir(), safeKey);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return {
    key: safeKey,
    url: `/api/v1/storage/files/${encodeURIComponent(safeKey)}`,
    mime,
    size: buffer.length,
  };
}

export async function readLocalFile(key: string): Promise<Buffer> {
  const safeKey = key.replace(/\.\./g, '');
  return readFile(join(localUploadDir(), safeKey));
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
