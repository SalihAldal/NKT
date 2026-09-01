import { logger } from './logger.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureAt = 0;
  private state: CircuitState = 'closed';

  constructor(private readonly options: CircuitBreakerOptions) {}

  getState(): CircuitState {
    if (this.state === 'open' && Date.now() - this.lastFailureAt >= (this.options.resetTimeoutMs ?? 30_000)) {
      this.state = 'half-open';
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === 'open') {
      throw new Error(`${this.options.name} circuit open`);
    }
    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (err) {
      this.failures += 1;
      this.lastFailureAt = Date.now();
      if (this.failures >= (this.options.failureThreshold ?? 5)) {
        this.state = 'open';
        logger.warn({ breaker: this.options.name }, 'Circuit breaker opened');
      }
      throw err;
    }
  }
}

export const paymentBreaker = new CircuitBreaker({ name: 'payment', failureThreshold: 5 });
export const pushBreaker = new CircuitBreaker({ name: 'push', failureThreshold: 8 });
export const aiBreaker = new CircuitBreaker({ name: 'ai', failureThreshold: 3, resetTimeoutMs: 60_000 });
export const storageBreaker = new CircuitBreaker({ name: 'storage', failureThreshold: 5 });
