import * as SecureStore from 'expo-secure-store';
import { logger } from '@/utils/logger';

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const memoryStore = new Map<string, string>();

export const secureStorage: StorageAdapter = {
  async get(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  async set(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      memoryStore.set(key, value);
    }
  },
  async remove(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      memoryStore.delete(key);
    }
  },
};

export const appStorage = {
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await secureStorage.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      logger.error('Storage parse error', e);
      return null;
    }
  },
  async setJSON<T>(key: string, value: T): Promise<void> {
    await secureStorage.set(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await secureStorage.remove(key);
  },
};
