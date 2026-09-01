import { getPlatform } from '@/utils/platform';
import type { PaymentProvider } from './payment.service';
import { env } from '@config/environment';
import { logger } from '@/utils/logger';

type RNIapModule = {
  getSubscriptions: (opts: { skus: string[] }) => Promise<Array<{ productId: string; title?: string; localizedPrice?: string; currency?: string }>>;
  requestSubscription: (opts: { sku: string }) => Promise<Array<{ transactionReceipt?: string; purchaseToken?: string; transactionId?: string; productId: string }> | { transactionReceipt?: string; purchaseToken?: string; transactionId?: string; productId: string }>;
  getAvailablePurchases: () => Promise<Array<{ transactionReceipt?: string; purchaseToken?: string; transactionId?: string; productId: string }>>;
};

function loadRNIap(): RNIapModule | null {
  try {
    // Optional native module — requires dev/production build with react-native-iap
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-iap') as RNIapModule;
  } catch {
    return null;
  }
}

class StorePaymentProvider implements PaymentProvider {
  platform: 'ios' | 'android' = getPlatform();
  private rnIap = loadRNIap();

  async getProducts() {
    if (!this.rnIap) return [];
    const skus = this.platform === 'ios'
      ? [process.env.EXPO_PUBLIC_IOS_PREMIUM_WEEKLY, process.env.EXPO_PUBLIC_IOS_PREMIUM_MONTHLY].filter(Boolean) as string[]
      : [process.env.EXPO_PUBLIC_ANDROID_PREMIUM_WEEKLY, process.env.EXPO_PUBLIC_ANDROID_PREMIUM_MONTHLY].filter(Boolean) as string[];
    const products = await this.rnIap.getSubscriptions({ skus });
    return products.map((p) => ({
      id: p.productId,
      title: p.title ?? p.productId,
      price: p.localizedPrice ?? '',
      currency: p.currency ?? 'TRY',
      plan: p.productId.includes('weekly') ? 'weekly' : 'monthly',
    }));
  }

  async purchase(productId: string) {
    if (!this.rnIap) {
      if (env.isProduction) throw new Error('Native IAP module not available');
      const prefix = this.platform === 'ios' ? 'apple-' : 'google-';
      return { receipt: `${prefix}${productId}`, transactionId: `txn-${Date.now()}` };
    }
    const result = await this.rnIap.requestSubscription({ sku: productId });
    const purchase = Array.isArray(result) ? result[0] : result;
    if (!purchase) return { receipt: '', transactionId: '', cancelled: true };
    return {
      receipt: purchase.transactionReceipt ?? purchase.purchaseToken ?? '',
      transactionId: purchase.transactionId ?? purchase.purchaseToken ?? String(Date.now()),
    };
  }

  async restore() {
    if (!this.rnIap) return [];
    const purchases = await this.rnIap.getAvailablePurchases();
    return purchases.map((p) => ({
      receipt: p.transactionReceipt ?? p.purchaseToken ?? '',
      productId: p.productId,
      transactionId: p.transactionId ?? p.purchaseToken ?? '',
    }));
  }
}

export function createStorePaymentProvider(): PaymentProvider {
  const provider = new StorePaymentProvider();
  if (!loadRNIap() && env.isProduction) {
    logger.error('react-native-iap not installed — IAP unavailable in production');
  }
  return provider;
}
