import type { ApiServices } from '../contracts';
import { createMockAuthApi } from './auth.mock';
import { createMockQuizApi } from './quiz.mock';
import { createMockRoomApi } from './room.mock';
import { createMockCategoryApi, createMockContentApi } from './content.mock';
import { createMockSubscriptionApi } from './subscription.mock';
import { createMockNotificationApi } from './notification.mock';
import { createMockUserApi } from './user.mock';
import { createMockFriendApi } from './friend.mock';
import { createMockInvitationApi } from './invitation.mock';
import { createMockSocialApi } from './social.mock';
import { createMockGameApi } from './game.mock';
import { createMockModerationApi } from './moderation.mock';
import { createMockAnalyticsApi } from './analytics.mock';

let mockAuthenticated = false;

export const setMockAuthenticated = (value: boolean): void => {
  mockAuthenticated = value;
};

export const getMockAuthenticated = (): boolean => mockAuthenticated;

export const createMockApiServices = (): ApiServices => ({
  auth: createMockAuthApi(() => mockAuthenticated, setMockAuthenticated),
  quiz: createMockQuizApi(),
  user: createMockUserApi(),
  friend: createMockFriendApi(),
  invitation: createMockInvitationApi(),
  social: createMockSocialApi(),
  room: createMockRoomApi(),
  game: createMockGameApi(),
  content: createMockContentApi(),
  category: createMockCategoryApi(),
  subscription: createMockSubscriptionApi(),
  notification: createMockNotificationApi(),
  moderation: createMockModerationApi(),
  analytics: createMockAnalyticsApi(),
});
