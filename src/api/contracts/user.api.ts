import type { Profile, User } from '@/domain/models/user';
import type { PaginatedResponse } from '../types';

export interface UserApi {
  getProfile(userId: string): Promise<Profile>;
  updateProfile(userId: string, data: Partial<Profile>): Promise<Profile>;
  deleteAccount(userId: string): Promise<void>;
  search(query: string, page?: number): Promise<PaginatedResponse<Profile>>;
}

export type { User, Profile };
