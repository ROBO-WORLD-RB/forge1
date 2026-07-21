import { useState, useEffect, useCallback } from 'react';
import { registerServiceWorker, updateServiceWorker, isServiceWorkerSupported } from '../services/serviceWorker';
import { initAppUpdateListeners } from '../utils/appUpdate';
import { clearUpdateOverlay } from '../utils/updateOverlay';
import { logger } from '../utils/logger';

const UPDATE_OVERLAY_DISMISSED_KEY = 'forge:update-overlay-dismissed';

interface PWAState {
  needRefresh: boolean;
  isUpdating: boolean;
  offlineReady: boolean;
  isSupported: boolean;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    needRefresh: false,
    isUpdating: false,
    offlineReady: false,
    isSupported: isServiceWorkerSupported()
  });

  const notifyUpdateAvailable = useCallback(() => {
    let overlayDismissed = false;
    try {
      overlayDismissed = !!sessionStorage.getItem(UPDATE_OVERLAY_DISMISSED_KEY);
    } catch {
      /* sessionStorage unavailable */
    }

    setState((prev) => ({
      ...prev,
      needRefresh: true,
      isUpdating: !overlayDismissed,
    }));
  }, []);

  useEffect(() => {
    const stopVersionChecks = initAppUpdateListeners(notifyUpdateAvailable);

    if (!state.isSupported) {
      logger.info('Service workers not supported', undefined, 'usePWA');
      return stopVersionChecks;
    }

    registerServiceWorker({
      onUpdating: notifyUpdateAvailable,
      onNeedRefresh: notifyUpdateAvailable,
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

    return stopVersionChecks;
  }, [state.isSupported, notifyUpdateAvailable]);

  const updateApp = useCallback(async () => {
    try {
      try {
        sessionStorage.removeItem(UPDATE_OVERLAY_DISMISSED_KEY);
      } catch {
        /* ignore */
      }
      await updateServiceWorker(true);
      setState(prev => ({ ...prev, needRefresh: false, isUpdating: false }));
    } catch (error) {
      logger.error('Failed to update app', error as Error, 'usePWA');
    }
  }, []);

  const dismissUpdating = useCallback(() => {
    clearUpdateOverlay();
    try {
      sessionStorage.setItem(UPDATE_OVERLAY_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
    setState(prev => ({ ...prev, isUpdating: false }));
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
    dismissUpdating,
    dismissUpdate,
    dismissOfflineReady,
  };
}
