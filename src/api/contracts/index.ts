export type { AuthApi, AuthSession, LoginDto, RegisterDto, RecoverDto } from './auth.api';
export type { QuizApi, CreateQuizDto } from './quiz.api';
export type { UserApi } from './user.api';
export type { FriendApi } from './friend.api';
export type { InvitationApi } from './invitation.api';
export type { SocialApi } from './social.api';
export type { RoomApi, CreateRoomDto, JoinRoomDto, RoomActionContext } from './room.api';
export type { CategoryApi, ContentApi } from './content.api';
export type { SubscriptionApi } from './subscription.api';
export type { NotificationApi } from './notification.api';
export type { ModerationApi, ProfanityFilter } from './moderation.api';
export type { AnalyticsApi } from './analytics.api';
export type { GameApi, GameActionContext } from './game.api';

import type { AuthApi } from './auth.api';
import type { QuizApi } from './quiz.api';
import type { UserApi } from './user.api';
import type { FriendApi } from './friend.api';
import type { InvitationApi } from './invitation.api';
import type { SocialApi } from './social.api';
import type { RoomApi } from './room.api';
import type { CategoryApi, ContentApi } from './content.api';
import type { SubscriptionApi } from './subscription.api';
import type { NotificationApi } from './notification.api';
import type { ModerationApi } from './moderation.api';
import type { AnalyticsApi } from './analytics.api';
import type { GameApi } from './game.api';

export interface ApiServices {
  auth: AuthApi;
  quiz: QuizApi;
  user: UserApi;
  friend: FriendApi;
  invitation: InvitationApi;
  social: SocialApi;
  room: RoomApi;
  game: GameApi;
  content: ContentApi;
  category: CategoryApi;
  subscription: SubscriptionApi;
  notification: NotificationApi;
  moderation: ModerationApi;
  analytics: AnalyticsApi;
}
