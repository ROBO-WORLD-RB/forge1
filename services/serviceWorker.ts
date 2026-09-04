import { registerSW } from 'virtual:pwa-register';
import { logger } from '../utils/logger';

export interface ServiceWorkerConfig {
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: Error) => void;
}

/**
 * Registers the service worker.
 * With Vite PWA `registerType: 'autoUpdate'`, new builds activate in the
 * background — no in-app update banner or overlay.
 */
export function registerServiceWorker(config: ServiceWorkerConfig = {}): void {
  const { onOfflineReady, onRegistered, onRegisterError } = config;

  registerSW({
    onOfflineReady() {
      logger.info('App ready to work offline', undefined, 'ServiceWorker');
      onOfflineReady?.();
    },
    onRegistered(registration) {
      logger.info('Service worker registered', { scope: registration?.scope }, 'ServiceWorker');
      onRegistered?.(registration);
    },
    onRegisterError(error) {
      logger.error('Service worker registration failed', error, 'ServiceWorker');
      onRegisterError?.(error);
    },
  });
}

export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!isServiceWorkerSupported()) {
    return undefined;
  }
  return navigator.serviceWorker.getRegistration();
}

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
