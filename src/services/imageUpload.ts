import { logger } from '@/utils/logger';
import { env } from '@config/environment';
import { secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';
import Constants from 'expo-constants';
import { getPlatform } from '@/utils/platform';
import { v4 as uuidv4 } from 'uuid';

export interface ImageUploadService {
  upload(uri: string, type?: 'avatar' | 'cover'): Promise<string>;
}

async function getDeviceId(): Promise<string> {
  const existing = await secureStorage.get('device_id');
  if (existing) return existing;
  const id = uuidv4();
  await secureStorage.set('device_id', id);
  return id;
}

class CloudImageUploadService implements ImageUploadService {
  async upload(uri: string, type: 'avatar' | 'cover' = 'avatar'): Promise<string> {
    if (env.useMockApi) {
      logger.debug('Mock image upload:', type, uri);
      return uri;
    }

    const token = await secureStorage.get(STORAGE_KEYS.authToken);
    const mime = 'image/jpeg';
    const presignRes = await fetch(`${env.apiUrl}/api/v1/storage/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ purpose: type, mime, size: 500_000 }),
    });
    const presignJson = await presignRes.json() as { success: boolean; data?: { key: string; uploadUrl: string } };
    if (!presignJson.success || !presignJson.data) throw new Error('Presign failed');

    const blob = await fetch(uri).then((r) => r.blob());
    const uploadRes = await fetch(`${env.apiUrl}${presignJson.data.uploadUrl}`, {
      method: 'PUT',
      headers: { 'Content-Type': mime, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: blob,
    });
    if (!uploadRes.ok) throw new Error('Upload failed');

    const stored = await uploadRes.json() as { success: boolean; data?: { url: string } };
    return stored.data?.url ?? presignJson.data.key;
  }
}

export const imageUploadService = new CloudImageUploadService();

export async function registerPushTokenWithBackend(pushToken: string): Promise<void> {
  if (env.useMockApi) return;
  const token = await secureStorage.get(STORAGE_KEYS.authToken);
  if (!token) return;
  const deviceId = await getDeviceId();
  await fetch(`${env.apiUrl}/api/v1/notifications/push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      token: pushToken,
      deviceId,
      platform: getPlatform(),
      appVersion: Constants.expoConfig?.version ?? '1.0.0',
    }),
  });
}
