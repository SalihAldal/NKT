import type { AdminPermission, AdminRole } from './types';

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    'user.read', 'user.update', 'user.suspend', 'user.delete',
    'room.read', 'room.close', 'room.player.remove',
    'quiz.read', 'quiz.moderate',
    'content.read', 'content.create', 'content.update', 'content.delete', 'content.approve', 'content.reject',
    'category.update',
    'subscription.read', 'purchase.read', 'entitlement.grant',
    'analytics.read',
    'report.read', 'report.resolve',
    'support.read', 'support.resolve',
    'settings.update', 'audit.read', 'audit.delete',
    'feature_flag.update', 'notification.manage', 'ads.manage',
  ],
  ADMIN: [
    'user.read', 'user.update', 'user.suspend',
    'room.read', 'room.close', 'room.player.remove',
    'quiz.read', 'quiz.moderate',
    'content.read', 'content.approve', 'content.reject',
    'category.update',
    'subscription.read', 'purchase.read', 'entitlement.grant',
    'analytics.read',
    'report.read', 'report.resolve',
    'support.read', 'support.resolve',
    'settings.update', 'audit.read',
    'notification.manage', 'ads.manage',
  ],
  MODERATOR: [
    'user.read', 'user.update', 'user.suspend',
    'room.read', 'room.close',
    'quiz.read', 'quiz.moderate',
    'content.read', 'content.approve', 'content.reject',
    'report.read', 'report.resolve',
    'audit.read',
  ],
  CONTENT_MANAGER: [
    'content.read', 'content.create', 'content.update', 'content.delete', 'content.approve', 'content.reject',
    'category.update',
    'analytics.read',
    'audit.read',
  ],
  SUPPORT: [
    'user.read',
    'support.read', 'support.resolve',
    'report.read',
    'subscription.read', 'purchase.read',
    'audit.read',
  ],
  ANALYST: [
    'user.read', 'analytics.read', 'subscription.read', 'purchase.read', 'audit.read',
  ],
};

export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: AdminRole, permission: AdminPermission): void {
  if (!roleHasPermission(role, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}
