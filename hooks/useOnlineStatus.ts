import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info('Network connection restored', undefined, 'useOnlineStatus');
    };

    const handleOffline = () => {
      setIsOnline(false);
      logger.warn('Network connection lost', undefined, 'useOnlineStatus');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
