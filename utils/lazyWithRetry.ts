import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_KEY = 'forge:chunk-reload';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError|Loading chunk [\d]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      message
    )
  );
}

/**
 * React.lazy wrapper that recovers from stale service-worker / CDN chunks
 * after a redeploy by reloading the page once.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      } catch {
        /* ignore */
      }
      return mod;
    } catch (error) {
      if (isChunkLoadError(error)) {
        try {
          const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY);
          if (!alreadyReloaded) {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
            window.location.reload();
            // Keep Suspense pending until the reload completes.
            return new Promise(() => {});
          }
          sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        } catch {
          /* sessionStorage unavailable — fall through and rethrow */
        }
      }
      throw error;
    }
  }) as LazyExoticComponent<T>;
}

export function recoverFromChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}
