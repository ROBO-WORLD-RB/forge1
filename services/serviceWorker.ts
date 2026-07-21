import { registerSW } from 'virtual:pwa-register';
import { logger } from '../utils/logger';
import { markPendingUpdateReload, watchServiceWorkerUpdates } from '../utils/appUpdate';
import { showUpdateOverlay, UPDATE_OVERLAY_DELAY_MS } from '../utils/updateOverlay';

export interface ServiceWorkerConfig {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: Error) => void;
  /** When true, activate waiting SW and reload without user action. */
  autoReload?: boolean;
  onUpdating?: () => void;
}

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

/**
 * Registers the service worker with update callbacks
 */
export function registerServiceWorker(config: ServiceWorkerConfig = {}): void {
  const {
    onNeedRefresh,
    onOfflineReady,
    onRegistered,
    onRegisterError,
    autoReload = true,
    onUpdating,
  } = config;

  updateSW = registerSW({
    onNeedRefresh() {
      logger.info('New service worker available', undefined, 'ServiceWorker');
      onNeedRefresh?.();
      if (autoReload) {
        void updateServiceWorker(true);
      }
    },
    onOfflineReady() {
      logger.info('App ready to work offline', undefined, 'ServiceWorker');
      onOfflineReady?.();
    },
    onRegistered(registration) {
      logger.info('Service worker registered', { scope: registration?.scope }, 'ServiceWorker');
      watchServiceWorkerUpdates(registration, onUpdating);
      onRegistered?.(registration);
    },
    onRegisterError(error) {
      logger.error('Service worker registration failed', error, 'ServiceWorker');
      onRegisterError?.(error);
    }
  });
}

/**
 * Triggers a service worker update check and reload
 */
export async function updateServiceWorker(reloadPage = true): Promise<void> {
  if (!updateSW) return;

  if (reloadPage) {
    markPendingUpdateReload('sw-update');
    showUpdateOverlay();
    await new Promise((resolve) => setTimeout(resolve, UPDATE_OVERLAY_DELAY_MS));
  }

  await updateSW(reloadPage);
}

/**
 * Checks if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

/**
 * Gets the current service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!isServiceWorkerSupported()) {
    return undefined;
  }
  return navigator.serviceWorker.getRegistration();
}

/**
 * Unregisters all service workers
 */
export async function unregisterServiceWorkers(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }
  
  const registrations = await navigator.serviceWorker.getRegistrations();
  const results = await Promise.all(
    registrations.map(registration => registration.unregister())
  );
  
  return results.every(result => result);
}
