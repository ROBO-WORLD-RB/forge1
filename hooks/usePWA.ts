import { useState, useEffect, useCallback } from 'react';
import { registerServiceWorker, updateServiceWorker, isServiceWorkerSupported } from '../services/serviceWorker';
import { logger } from '../utils/logger';

interface PWAState {
  needRefresh: boolean;
  offlineReady: boolean;
  isSupported: boolean;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    needRefresh: false,
    offlineReady: false,
    isSupported: isServiceWorkerSupported()
  });

  useEffect(() => {
    if (!state.isSupported) {
      logger.info('Service workers not supported', undefined, 'usePWA');
      return;
    }

    registerServiceWorker({
      onNeedRefresh() {
        setState(prev => ({ ...prev, needRefresh: true }));
      },
      onOfflineReady() {
        setState(prev => ({ ...prev, offlineReady: true }));
      },
      onRegistered(registration) {
        logger.info('PWA registered', { scope: registration?.scope }, 'usePWA');
      },
      onRegisterError(error) {
        logger.error('PWA registration failed', error, 'usePWA');
      }
    });
  }, [state.isSupported]);

  const updateApp = useCallback(async () => {
    try {
      await updateServiceWorker(true);
      setState(prev => ({ ...prev, needRefresh: false }));
    } catch (error) {
      logger.error('Failed to update app', error as Error, 'usePWA');
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, needRefresh: false }));
  }, []);

  const dismissOfflineReady = useCallback(() => {
    setState(prev => ({ ...prev, offlineReady: false }));
  }, []);

  return {
    ...state,
    updateApp,
    dismissUpdate,
    dismissOfflineReady
  };
}
