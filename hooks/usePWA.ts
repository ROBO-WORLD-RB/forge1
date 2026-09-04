import { useEffect } from 'react';
import { registerServiceWorker, isServiceWorkerSupported } from '../services/serviceWorker';
import { logger } from '../utils/logger';

/** Registers the service worker silently — no update prompts or overlays. */
export function usePWA() {
  useEffect(() => {
    if (!isServiceWorkerSupported()) {
      logger.info('Service workers not supported', undefined, 'usePWA');
      return;
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
  }, []);
}
