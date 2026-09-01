import type { NotificationRoute } from '@/domain/models/moderation';
import { NOTIFICATION_TYPE } from '@/domain/constants/enums';

export const resolveNotificationRoute = (
  type: string,
  data: Record<string, string> = {},
): NotificationRoute => {
  switch (type) {
    case NOTIFICATION_TYPE.FRIEND_REQUEST:
      return { screen: 'Friends', params: { tab: 'requests' } };
    case NOTIFICATION_TYPE.FRIEND_ACCEPTED:
      return { screen: 'FriendProfile', params: { userId: data.userId ?? '' } };
    case NOTIFICATION_TYPE.QUIZ_RECEIVED:
      return { screen: 'SolveQuiz', params: { quizId: data.quizId ?? '' } };
    case NOTIFICATION_TYPE.QUIZ_COMPLETED:
      return {
        screen: 'Result',
        params: { quizId: data.quizId ?? '', attemptId: data.attemptId ?? '' },
      };
    case NOTIFICATION_TYPE.FRIEND_JOINED_ROOM:
    case NOTIFICATION_TYPE.ROOM_STARTING:
    case NOTIFICATION_TYPE.GAME_STARTED:
    case NOTIFICATION_TYPE.YOUR_TURN:
      return { screen: 'Lobby', params: { code: data.code ?? '' } };
    case NOTIFICATION_TYPE.ROOM_INVITE:
      return { screen: 'JoinRoom', params: { code: data.code ?? '' } };
    case NOTIFICATION_TYPE.GAME_COMPLETED:
      return { screen: 'GameResult', params: { roomId: data.roomId ?? '' } };
    case NOTIFICATION_TYPE.PREMIUM:
      return { screen: 'Premium' };
    case NOTIFICATION_TYPE.INVITE:
      return { screen: 'Auth', params: { inviteUserId: data.userId ?? '' } };
    case NOTIFICATION_TYPE.SYSTEM:
    default:
      return { screen: 'NotificationCenter' };
  }
};

export const isExpiredEntityRoute = (
  type: string,
  data: Record<string, string>,
  checkExpiry: (type: string, data: Record<string, string>) => boolean,
): boolean => checkExpiry(type, data);
