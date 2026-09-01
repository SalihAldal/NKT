import { apiServices } from '@/api/client';
import { analytics } from '@/services/analytics';
import { moderationService } from '@/services/moderation/moderation.service';
import type { Friendship, FriendProfile } from '@/domain/models/social';
import type { InvitationType } from '@/domain/constants/enums';

class FriendServiceImpl {
  async listFriends(userId: string, page = 1) {
    return apiServices.friend.list(userId, page);
  }

  async sendRequest(userId: string, friendUserId: string): Promise<Friendship> {
    const result = await apiServices.friend.sendRequest(userId, friendUserId);
    analytics.track({ name: 'friend_request_sent', params: { targetUserId: friendUserId } });
    return result;
  }

  async acceptRequest(requestId: string, userId: string): Promise<Friendship> {
    const result = await apiServices.friend.acceptRequest(requestId, userId);
    analytics.track({ name: 'friend_request_accepted', params: { friendshipId: requestId } });
    return result;
  }

  async declineRequest(requestId: string, userId: string): Promise<Friendship> {
    const result = await apiServices.friend.declineRequest(requestId, userId);
    analytics.track({ name: 'friend_request_declined', params: { friendshipId: requestId } });
    return result;
  }

  async cancelRequest(requestId: string, userId: string): Promise<void> {
    await apiServices.friend.cancelRequest(requestId, userId);
  }

  async removeFriend(userId: string, friendUserId: string): Promise<void> {
    await apiServices.friend.remove(userId, friendUserId);
    analytics.track({ name: 'friend_removed', params: { targetUserId: friendUserId } });
  }

  async getPendingRequests(userId: string) {
    return apiServices.friend.getPendingRequests(userId);
  }

  async getProfile(viewerId: string, targetId: string): Promise<FriendProfile> {
    analytics.track({ name: 'profile_viewed', params: { targetUserId: targetId } });
    return apiServices.friend.getProfile(viewerId, targetId);
  }

  async getFriendIds(userId: string): Promise<string[]> {
    return apiServices.friend.getFriendIds(userId);
  }

  async blockUser(blockerId: string, blockedUserId: string): Promise<void> {
    await moderationService.blockUser(blockerId, blockedUserId);
    analytics.track({ name: 'friend_blocked', params: { targetUserId: blockedUserId } });
  }

  async sendInvite(
    senderId: string,
    receiverId: string,
    type: InvitationType,
    referenceId: string,
  ) {
    const result = await apiServices.invitation.send(senderId, receiverId, type, referenceId);
    if (type === 'room') {
      analytics.track({ name: 'room_invite_sent', params: { receiverId, referenceId } });
    } else if (type === 'quiz') {
      analytics.track({ name: 'quiz_invite_sent', params: { receiverId, quizId: referenceId } });
    }
    return result;
  }
}

export const friendService = new FriendServiceImpl();
