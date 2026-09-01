import type { PaywallContext } from '@/domain/constants/enums';

let currentContext: PaywallContext | null = null;

export const paywallContext = {
  set(context: PaywallContext) {
    currentContext = context;
  },
  get(): PaywallContext {
    return currentContext ?? 'premium_screen';
  },
  clear() {
    currentContext = null;
  },
};
