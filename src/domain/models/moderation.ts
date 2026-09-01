import type { ModerationStatus, NotificationType, ReportType } from '../constants/enums';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  read: boolean;
  createdAt: string;
}

export interface NotificationRoute {
  screen: string;
  params?: Record<string, string>;
}

export interface Report {
  id: string;
  type: ReportType;
  reporterId: string;
  targetId: string;
  targetType: 'user' | 'content' | 'room' | 'custom_category';
  reason: string;
  description?: string;
  status: ModerationStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedUserId: string;
  createdAt: string;
}
