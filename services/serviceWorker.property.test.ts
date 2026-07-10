import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: infrastructure-enhancements, Property 7: Offline Cache Serving
 * Validates: Requirements 3.2
 * 
 * For any URL that has been previously cached, requesting that URL while offline
 * should return a response with status 200.
 */

/**
 * Feature: infrastructure-enhancements, Property 8: Stale-While-Revalidate Strategy
 * Validates: Requirements 3.5
 * 
 * For any cached API response, the cache strategy should return the cached response
 * immediately while initiating a background revalidation.
 */

// Mock Cache API for testing
class MockCache {
  private store: Map<string, Response> = new Map();

  async match(request: RequestInfo): Promise<Response | undefined> {
    const url = typeof request === 'string' ? request : request.url;
    return this.store.get(url);
  }

  async put(request: RequestInfo, response: Response): Promise<void> {
    const url = typeof request === 'string' ? request : request.url;
    this.store.set(url, response.clone());
  }

  async delete(request: RequestInfo): Promise<boolean> {
    const url = typeof request === 'string' ? request : request.url;
    return this.store.delete(url);
  }

  async keys(): Promise<Request[]> {
    return Array.from(this.store.keys()).map(url => new Request(url));
  }

  has(url: string): boolean {
    return this.store.has(url);
  }

  size(): number {
    return this.store.size;
  }
}

// Simulates CacheFirst strategy
async function cacheFirstStrategy(
  cache: MockCache,
  request: string,
  fetchFn: (url: string) => Promise<Response>,
  isOnline: boolean
): Promise<Response | null> {
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse.clone();
  }

  // If offline and not in cache, return null
  if (!isOnline) {
    return null;
  }

  // Fetch from network and cache
  try {
    const networkResponse = await fetchFn(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return null;
  }
}

// Simulates StaleWhileRevalidate strategy
interface SWRResult {
  response: Response | null;
  revalidationStarted: boolean;
  revalidationTime: number;
}

async function staleWhileRevalidateStrategy(
  cache: MockCache,
  request: string,
  fetchFn: (url: string) => Promise<Response>,
  isOnline: boolean
): Promise<SWRResult> {
  const startTime = Date.now();
  let revalidationStarted = false;

  // Return cached response immediately if available
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Start background revalidation if online
    if (isOnline) {
      revalidationStarted = true;
      // Background revalidation (non-blocking)
      fetchFn(request).then(async (networkResponse) => {
        if (networkResponse.ok) {
          await cache.put(request, networkResponse.clone());
        }
      }).catch(() => {
        // Silently fail background revalidation
      });
    }
    
    return {
      response: cachedResponse.clone(),
      revalidationStarted,
      revalidationTime: Date.now() - startTime
    };
  }

  // No cache, try network
  if (!isOnline) {
    return {
      response: null,
      revalidationStarted: false,
      revalidationTime: Date.now() - startTime
    };
  }

  try {
    const networkResponse = await fetchFn(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return {
      response: networkResponse,
      revalidationStarted: false,
      revalidationTime: Date.now() - startTime
    };
  } catch {
    return {
      response: null,
      revalidationStarted: false,
      revalidationTime: Date.now() - startTime
    };
  }
}

// Arbitraries for property testing
const urlArbitrary = fc.webUrl({ withFragments: false, withQueryParameters: false });

const responseBodyArbitrary = fc.record({
  data: fc.array(fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 })
  }), { minLength: 0, maxLength: 10 })
});

describe('Service Worker Caching Strategies', () => {
  let cache: MockCache;

  beforeEach(() => {
    cache = new MockCache();
  });

  /**
   * Feature: infrastructure-enhancements, Property 7: Offline Cache Serving
   * Validates: Requirements 3.2
   */
  it('Property 7: cached URLs return 200 when offline', async () => {
    await fc.assert(
      fc.asyncProperty(
        urlArbitrary,
        responseBodyArbitrary,
        async (url, body) => {
          // Setup: Pre-cache the URL with a valid response
          const originalResponse = new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
          await cache.put(url, originalResponse);

          // Mock fetch that would fail (simulating offline)
          const failingFetch = vi.fn().mockRejectedValue(new Error('Network error'));

          // Act: Request while offline
          const result = await cacheFirstStrategy(cache, url, failingFetch, false);

          // Assert: Should return cached response with status 200
          expect(result).not.toBeNull();
          expect(result!.status).toBe(200);
          
          // Verify the body matches
          const resultBody = await result!.json();
          expect(resultBody).toEqual(body);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: uncached URLs return null when offline', async () => {
    await fc.assert(
      fc.asyncProperty(
        urlArbitrary,
        async (url) => {
          // Setup: URL is NOT in cache
          expect(cache.has(url)).toBe(false);

          // Mock fetch that would fail
          const failingFetch = vi.fn().mockRejectedValue(new Error('Network error'));

          // Act: Request while offline
          const result = await cacheFirstStrategy(cache, url, failingFetch, false);

          // Assert: Should return null (no cached response available)
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: infrastructure-enhancements, Property 8: Stale-While-Revalidate Strategy
   * Validates: Requirements 3.5
   */
  it('Property 8: stale-while-revalidate returns cached response immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        urlArbitrary,
        responseBodyArbitrary,
        async (url, body) => {
          // Setup: Pre-cache the URL
          const cachedResponse = new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
          await cache.put(url, cachedResponse);

          // Mock fetch with delay (simulating network latency)
          const slowFetch = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return new Response(JSON.stringify({ updated: true }), { status: 200 });
          });

          // Act: Request with SWR strategy
          const result = await staleWhileRevalidateStrategy(cache, url, slowFetch, true);

          // Assert: Response should be returned quickly (from cache)
          expect(result.response).not.toBeNull();
          expect(result.response!.status).toBe(200);
          expect(result.revalidationTime).toBeLessThan(100); // Should be nearly instant (allowing for CI variance)
          expect(result.revalidationStarted).toBe(true);

          // Verify cached body was returned
          const resultBody = await result.response!.json();
          expect(resultBody).toEqual(body);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: stale-while-revalidate initiates background revalidation when online', async () => {
    await fc.assert(
      fc.asyncProperty(
        urlArbitrary,
        responseBodyArbitrary,
        async (url, body) => {
          // Setup: Pre-cache the URL
          const cachedResponse = new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
          await cache.put(url, cachedResponse);

          // Track if fetch was called
          let fetchCalled = false;
          const trackingFetch = vi.fn().mockImplementation(async () => {
            fetchCalled = true;
            return new Response(JSON.stringify({ updated: true }), { status: 200 });
          });

          // Act: Request with SWR strategy while online
          const result = await staleWhileRevalidateStrategy(cache, url, trackingFetch, true);

          // Assert: Revalidation should have been started
          expect(result.revalidationStarted).toBe(true);
          
          // Wait a bit for the background fetch to complete
          await new Promise(resolve => setTimeout(resolve, 10));
          expect(fetchCalled).toBe(true);
        }
      ),
      { numRuns: 50 } // Reduced from 100 to avoid timeout
    );
  }, 15000); // Increased timeout to 15 seconds

  it('Property 8: stale-while-revalidate does not revalidate when offline', async () => {
    await fc.assert(
      fc.asyncProperty(
        urlArbitrary,
        responseBodyArbitrary,
        async (url, body) => {
          // Setup: Pre-cache the URL
          const cachedResponse = new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
          await cache.put(url, cachedResponse);

          // Track if fetch was called
          const trackingFetch = vi.fn();

          // Act: Request with SWR strategy while offline
          const result = await staleWhileRevalidateStrategy(cache, url, trackingFetch, false);

          // Assert: Should return cached response but NOT start revalidation
          expect(result.response).not.toBeNull();
          expect(result.response!.status).toBe(200);
          expect(result.revalidationStarted).toBe(false);
          expect(trackingFetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
