/**
 * Admin social analytics contracts
 */

export interface AdminSocialStats {
  dailyFriendRequests: number;
  acceptanceRate: number;
  inviteConversion: number;
  roomInviteConversion: number;
  quizShareConversion: number;
  activeSocialUsers: number;
  viralCoefficient: number;
  notificationOpenRate: number;
  totalFriendships: number;
  pendingInvitations: number;
  blockedUsers: number;
  pendingReports: number;
}

export interface AdminFriendshipDto {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  createdAt: string;
}

export interface AdminInvitationDto {
  id: string;
  senderId: string;
  receiverId: string;
  type: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface AdminActivityDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  createdAt: string;
}
