import { env } from '@config/environment';
import { secureStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';
import type { VerifyReceiptInput, VerifyReceiptResult } from '@/services/entitlement/server-entitlement.service';
import { serverEntitlementService } from '@/services/entitlement/server-entitlement.service';
import { logger } from '@/utils/logger';

export interface ReceiptVerificationProvider {
  platform: 'ios' | 'android';
  verify(input: VerifyReceiptInput): Promise<VerifyReceiptResult>;
}

async function verifyViaBackend(input: VerifyReceiptInput): Promise<VerifyReceiptResult> {
  if (env.useMockApi) {
    const prefixValid = input.platform === 'ios'
      ? input.receipt.startsWith('apple-') || input.receipt.startsWith('mock-receipt-')
      : input.receipt.startsWith('google-') || input.receipt.startsWith('mock-receipt-');
    if (!prefixValid) return { valid: false, reason: 'Invalid receipt format' };
    return serverEntitlementService.verifyAndGrant({
      ...input,
      environment: input.environment ?? 'sandbox',
    });
  }

  try {
    const token = await secureStorage.get(STORAGE_KEYS.authToken);
    const res = await fetch(`${env.apiUrl}/api/v1/subscriptions/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        receipt: input.receipt,
        platform: input.platform,
        productId: input.productId,
        transactionId: input.transactionId,
      }),
    });
    const json = await res.json() as { success: boolean; data?: { entitlement?: VerifyReceiptResult['entitlement'] }; error?: { message: string } };
    if (!res.ok || !json.success || !json.data?.entitlement) {
      return { valid: false, reason: json.error?.message ?? 'Backend verification failed' };
    }
    return { valid: true, entitlement: json.data.entitlement };
  } catch (err) {
    logger.error('Backend purchase verification failed', err);
    return { valid: false, reason: 'Network error during verification' };
  }
}

export class AppleReceiptVerificationProvider implements ReceiptVerificationProvider {
  platform: 'ios' | 'android' = 'ios';
  verify(input: VerifyReceiptInput) { return verifyViaBackend(input); }
}

export class GoogleReceiptVerificationProvider implements ReceiptVerificationProvider {
  platform: 'ios' | 'android' = 'android';
  verify(input: VerifyReceiptInput) { return verifyViaBackend(input); }
}

export const getVerificationProvider = (platform: 'ios' | 'android'): ReceiptVerificationProvider =>
  platform === 'ios' ? new AppleReceiptVerificationProvider() : new GoogleReceiptVerificationProvider();
