import { v4 as uuidv4 } from 'uuid';
import type { Entitlement } from '@/domain/models/user';
import { ENTITLEMENT_STATUS } from '@/domain/constants/enums';
import { serverEntitlementService } from '@/services/entitlement/server-entitlement.service';

export type WebhookEventType =
  | 'subscription_purchased'
  | 'subscription_renewed'
  | 'subscription_expired'
  | 'subscription_revoked'
  | 'subscription_grace'
  | 'billing_retry';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  userId: string;
  transactionId: string;
  productId?: string;
  platform: 'ios' | 'android';
  receivedAt: string;
}

const processedWebhookIds = new Set<string>();

export class WebhookService {
  private events: WebhookEvent[] = [];

  async process(event: Omit<WebhookEvent, 'id' | 'receivedAt'>): Promise<{ processed: boolean; entitlement?: Entitlement }> {
    const idempotencyKey = `${event.platform}:${event.transactionId}:${event.type}`;
    if (processedWebhookIds.has(idempotencyKey)) {
      return { processed: false, entitlement: serverEntitlementService.getEntitlement(event.userId) };
    }

    processedWebhookIds.add(idempotencyKey);
    const record: WebhookEvent = {
      ...event,
      id: uuidv4(),
      receivedAt: new Date().toISOString(),
    };
    this.events.push(record);

    let entitlement: Entitlement;
    switch (event.type) {
      case 'subscription_purchased':
      case 'subscription_renewed':
        entitlement = serverEntitlementService.verifyAndGrant({
          userId: event.userId,
          receipt: `${event.platform}-webhook-${event.transactionId}`,
          productId: event.productId ?? '',
          platform: event.platform,
          transactionId: event.transactionId,
        }).entitlement ?? serverEntitlementService.getEntitlement(event.userId);
        break;
      case 'subscription_expired':
        entitlement = serverEntitlementService.expire(event.userId);
        break;
      case 'subscription_revoked':
        entitlement = serverEntitlementService.revoke(event.userId);
        break;
      case 'subscription_grace':
        entitlement = serverEntitlementService.setGrace(event.userId);
        break;
      case 'billing_retry':
        entitlement = serverEntitlementService.setGrace(event.userId);
        break;
      default:
        entitlement = serverEntitlementService.getEntitlement(event.userId);
    }

    return { processed: true, entitlement };
  }

  listEvents(): WebhookEvent[] {
    return [...this.events];
  }

  _reset(): void {
    this.events = [];
    processedWebhookIds.clear();
  }
}

export const webhookService = new WebhookService();
