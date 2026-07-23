import { logger } from './logger';

const BUILD_ID_META = 'forge-build-id';
const VERSION_RELOAD_KEY = 'forge:version-reload';
const VERSION_CHECK_COOLDOWN_MS = 15_000;

let loadedBuildId: string | null = null;
let lastCheckAt = 0;

export function getLoadedBuildId(): string {
  if (loadedBuildId) return loadedBuildId;
  const meta = document.querySelector(`meta[name="${BUILD_ID_META}"]`);
  loadedBuildId = meta?.getAttribute('content')?.trim() || import.meta.env.VITE_BUILD_ID || 'dev';
  return loadedBuildId;
}

export interface VersionManifest {
  buildId: string;
  builtAt?: string;
  entry?: string;
}

export async function fetchRemoteVersion(): Promise<VersionManifest | null> {
  try {
    const response = await fetch(`/version.json?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (!response.ok) return null;
    return (await response.json()) as VersionManifest;
  } catch (error) {
    logger.debug('Version check fetch failed', { error }, 'AppUpdate');
    return null;
  }
}

function hasReloadedThisSession(): boolean {
  try {
    return !!sessionStorage.getItem(VERSION_RELOAD_KEY);
  } catch {
    return false;
  }
}

function markReloaded(reason: string): void {
  try {
    sessionStorage.setItem(VERSION_RELOAD_KEY, reason);
  } catch {
    /* sessionStorage unavailable */
  }
}

/** Mark an impending SW-driven reload so version checks do not double-reload. */
export function markPendingUpdateReload(reason: string): void {
  if (hasReloadedThisSession()) return;
  markReloaded(reason);
}

export function clearUpdateReloadFlag(): void {
  try {
    sessionStorage.removeItem(VERSION_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

export async function checkForAppUpdate(options?: { force?: boolean }): Promise<boolean> {
  const now = Date.now();
  if (!options?.force && now - lastCheckAt < VERSION_CHECK_COOLDOWN_MS) {
    return false;
  }
  lastCheckAt = now;

  const remote = await fetchRemoteVersion();
  if (!remote?.buildId) return false;

  const local = getLoadedBuildId();
  if (local === 'dev' || remote.buildId === local) {
    return false;
  }

  logger.info('New build detected', { local, remote: remote.buildId }, 'AppUpdate');
  return true;
}

export async function triggerServiceWorkerUpdateCheck(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  } catch (error) {
    logger.debug('Service worker update check failed', { error }, 'AppUpdate');
  }
}

/** Silent background checks only — no update UI or auto-reload. */
export function initAppUpdateListeners(): () => void {
  clearUpdateReloadFlag();

  const handleVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    void checkForAppUpdate();
    void triggerServiceWorkerUpdateCheck();
  };

  document.addEventListener('visibilitychange', handleVisibility);

  void checkForAppUpdate({ force: true });
  void triggerServiceWorkerUpdateCheck();

  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

/** Notify when a waiting service worker takes control after a deploy (no auto-reload). */
export function watchServiceWorkerUpdates(
  registration: ServiceWorkerRegistration | undefined,
  onUpdating?: () => void
): void {
  if (!registration || !('serviceWorker' in navigator)) return;

  let pendingUpdate = false;

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        pendingUpdate = true;
      }
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!pendingUpdate) return;
    pendingUpdate = false;
    onUpdating?.();
  });
}
