interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitState {
  requests: number[];
}

const limiters = new Map<string, RateLimitState>();

const defaultConfig: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60000 // 1 minute
};

export const createRateLimiter = (key: string, config: Partial<RateLimitConfig> = {}) => {
  const { maxRequests, windowMs } = { ...defaultConfig, ...config };

  return {
    check: (): { allowed: boolean; retryAfter?: number } => {
      const now = Date.now();
      let state = limiters.get(key);

      if (!state) {
        state = { requests: [] };
        limiters.set(key, state);
      }

      // Remove expired timestamps
      state.requests = state.requests.filter(ts => now - ts < windowMs);

      if (state.requests.length >= maxRequests) {
        const oldestRequest = state.requests[0];
        const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
        return { allowed: false, retryAfter };
      }

      state.requests.push(now);
      return { allowed: true };
    },

    reset: () => {
      limiters.delete(key);
    }
  };
};

// Pre-configured limiters for common use cases
export const apiLimiter = createRateLimiter('api', { maxRequests: 30, windowMs: 60000 });
export const authLimiter = createRateLimiter('auth', { maxRequests: 5, windowMs: 300000 }); // 5 per 5 min
export const aiLimiter = createRateLimiter('ai', { maxRequests: 10, windowMs: 60000 });

export class RateLimitError extends Error {
  retryAfter: number;
  
  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}
