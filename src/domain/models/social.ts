import type {
  FriendshipStatus,
  InvitationStatus,
  InvitationType,
  ActivityType,
  ProfileVisibility,
  ReportReason,
} from '../constants/enums';

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  senderId: string;
  receiverId: string;
  type: InvitationType;
  referenceId: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
}

export interface SocialActivity {
  id: string;
  userId: string;
  type: ActivityType;
  title: string;
  body?: string;
  referenceId?: string;
  referenceType?: 'quiz' | 'game' | 'room';
  createdAt: string;
  /** Privacy-filtered — no private quiz details */
  isPublic: boolean;
}

export interface PrivacySettings {
  userId: string;
  profileVisibility: ProfileVisibility;
  activitySharing: boolean;
  discoverable: boolean;
  showOnlineStatus: boolean;
  updatedAt: string;
}

export interface FriendProfile {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  badges: Array<{ id: string; name: string; icon: string }>;
  quizzesCompleted: number;
  gamesPlayed: number;
  winRate: number;
  friendshipStatus: FriendshipStatus | 'none';
  isFriend: boolean;
  isBlocked: boolean;
}

export interface FriendSuggestion {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  source: 'mutual_friends' | 'shared_room' | 'quiz_interaction';
  mutualFriendsCount?: number;
}

export interface UserSearchResult {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  friendshipStatus: FriendshipStatus | 'none';
}

export interface CreateReportInput {
  reporterId: string;
  targetId: string;
  targetType: 'user' | 'quiz' | 'content' | 'room' | 'activity';
  reason: ReportReason;
  description?: string;
}

export interface NotificationPreferences {
  friendRequests: boolean;
  quizActivity: boolean;
  roomInvites: boolean;
  gameActivity: boolean;
  marketing: boolean;
  system: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  friendRequests: true,
  quizActivity: true,
  roomInvites: true,
  gameActivity: true,
  marketing: false,
  system: true,
};
