import { useEffect } from 'react';
import { registerServiceWorker, isServiceWorkerSupported } from '../services/serviceWorker';
import { initAppUpdateListeners } from '../utils/appUpdate';
import { logger } from '../utils/logger';

/** Registers the service worker and runs silent background update checks (no UI). */
export function usePWA() {
  useEffect(() => {
    const stopVersionChecks = initAppUpdateListeners();

    if (!isServiceWorkerSupported()) {
      logger.info('Service workers not supported', undefined, 'usePWA');
      return stopVersionChecks;
    }

    registerServiceWorker({
      onOfflineReady() {
        logger.info('App ready to work offline', undefined, 'usePWA');
      },
      onRegistered(registration) {
        logger.info('PWA registered', { scope: registration?.scope }, 'usePWA');
      },
      onRegisterError(error) {
        logger.error('PWA registration failed', error, 'usePWA');
      },
    });

    return stopVersionChecks;
  }, []);
}
