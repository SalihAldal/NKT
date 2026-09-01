import type { Notification } from '../models/moderation';
import type { NotificationItem } from '@/types';

const LEGACY_TYPE_MAP: Record<string, NotificationItem['type']> = {
  quiz_received: 'quiz_received',
  quiz_completed: 'quiz_solved',
  friend_joined_room: 'friend_invite',
  invite: 'friend_invite',
  game_completed: 'result_revealed',
};

export const mapNotificationToUi = (n: Notification): NotificationItem => ({
  id: n.id,
  type: LEGACY_TYPE_MAP[n.type] ?? 'quiz_received',
  title: n.title,
  body: n.body,
  data: n.data,
  read: n.read,
  createdAt: n.createdAt,
});
