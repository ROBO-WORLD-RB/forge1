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

/** React.lazy wrapper — chunk load errors surface to ErrorBoundary (no auto-reload). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    const mod = await factory();
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      /* ignore */
    }
    return mod;
  }) as LazyExoticComponent<T>;
}

/** Detect chunk load errors without triggering an automatic reload. */
export function recoverFromChunkLoadError(error: unknown): boolean {
  return isChunkLoadError(error);
}
