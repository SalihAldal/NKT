import { config } from '../../config/index.js';
import { pushBreaker } from '../../common/circuit-breaker.js';
import { logger } from '../../common/logger.js';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  success: boolean;
  invalidToken?: boolean;
  error?: string;
}

export async function sendExpoPush(message: PushMessage): Promise<PushResult> {
  if (!config.EXPO_ACCESS_TOKEN) {
    logger.warn('EXPO_ACCESS_TOKEN missing — push skipped');
    return { success: false, error: 'push_not_configured' };
  }

  return pushBreaker.execute(async () => {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.EXPO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: message.to,
        title: message.title,
        body: message.body,
        data: message.data,
        sound: 'default',
      }),
    });

    if (!res.ok) {
      return { success: false, error: `http_${res.status}` };
    }

    const json = await res.json() as { data?: Array<{ status: string; details?: { error?: string } }> };
    const ticket = json.data?.[0];
    if (!ticket) return { success: false, error: 'no_ticket' };
    if (ticket.status === 'error') {
      const invalid = ticket.details?.error === 'DeviceNotRegistered';
      return { success: false, invalidToken: invalid, error: ticket.details?.error };
    }
    return { success: true };
  }).catch((err: Error) => ({ success: false, error: err.message }));
}
