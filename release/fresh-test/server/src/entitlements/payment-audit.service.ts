import { logger } from '../common/logger.js';

export type PaymentAuditAction =
  | 'purchase.verify'
  | 'purchase.duplicate'
  | 'purchase.failed'
  | 'purchase.pending'
  | 'subscription.active'
  | 'subscription.grace'
  | 'subscription.expired'
  | 'subscription.cancelled'
  | 'subscription.revoked'
  | 'subscription.refunded'
  | 'entitlement.grant'
  | 'entitlement.revoke'
  | 'entitlement.expire'
  | 'restore'
  | 'webhook.received'
  | 'webhook.processed'
  | 'webhook.skipped'
  | 'reconcile';

export function logPaymentAudit(data: {
  action: PaymentAuditAction;
  userId?: string;
  provider?: string;
  transactionId?: string;
  eventId?: string;
  status?: string;
  reason?: string;
}) {
  logger.info({
    audit: 'payment',
    ...data,
  }, `payment.${data.action}`);
}
