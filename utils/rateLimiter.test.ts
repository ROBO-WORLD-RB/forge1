import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRateLimiter, RateLimitError } from './rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within limit', () => {
    const limiter = createRateLimiter('test-allow', { maxRequests: 3, windowMs: 1000 });
    
    expect(limiter.check().allowed).toBe(true);
    expect(limiter.check().allowed).toBe(true);
    expect(limiter.check().allowed).toBe(true);
    
    limiter.reset();
  });

  it('blocks requests exceeding limit', () => {
    const limiter = createRateLimiter('test-block', { maxRequests: 2, windowMs: 1000 });
    
    expect(limiter.check().allowed).toBe(true);
    expect(limiter.check().allowed).toBe(true);
    
    const result = limiter.check();
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();
    
    limiter.reset();
  });

  it('resets after window expires', () => {
    const limiter = createRateLimiter('test-reset', { maxRequests: 1, windowMs: 1000 });
    
    expect(limiter.check().allowed).toBe(true);
    expect(limiter.check().allowed).toBe(false);
    
    // Advance time past the window
    vi.advanceTimersByTime(1001);
    
    expect(limiter.check().allowed).toBe(true);
    
    limiter.reset();
  });

  it('calculates correct retryAfter time', () => {
    const limiter = createRateLimiter('test-retry', { maxRequests: 1, windowMs: 5000 });
    
    limiter.check(); // First request
    const result = limiter.check(); // Second request (blocked)
    
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(5);
    
    limiter.reset();
  });

  it('reset clears all request history', () => {
    const limiter = createRateLimiter('test-clear', { maxRequests: 1, windowMs: 60000 });
    
    limiter.check();
    expect(limiter.check().allowed).toBe(false);
    
    limiter.reset();
    expect(limiter.check().allowed).toBe(true);
    
    limiter.reset();
  });
});

describe('RateLimitError', () => {
  it('creates error with correct message and retryAfter', () => {
    const error = new RateLimitError(30);
    
    expect(error.name).toBe('RateLimitError');
    expect(error.retryAfter).toBe(30);
    expect(error.message).toContain('30 seconds');
  });
});
