import type { Friendship, FriendProfile } from '@/domain/models/social';

export interface FriendListResponse {
  data: FriendProfile[];
  hasMore: boolean;
}

export interface PendingRequestsResponse {
  requests: Friendship[];
}

export interface FriendApi {
  list(userId: string, page?: number): Promise<FriendListResponse>;
  sendRequest(userId: string, friendUserId: string): Promise<Friendship>;
  acceptRequest(requestId: string, userId: string): Promise<Friendship>;
  declineRequest(requestId: string, userId: string): Promise<Friendship>;
  cancelRequest(requestId: string, userId: string): Promise<void>;
  remove(userId: string, friendUserId: string): Promise<void>;
  getPendingRequests(userId: string): Promise<PendingRequestsResponse>;
  getProfile(viewerId: string, targetId: string): Promise<FriendProfile>;
  getFriendIds(userId: string): Promise<string[]>;
}
