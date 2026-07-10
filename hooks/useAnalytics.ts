import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../utils/analytics';

export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    analytics.page(location.pathname, {
      search: location.search,
      hash: location.hash
    });
  }, [location]);
};

export const useAnalytics = () => {
  return {
    track: analytics.track,
    page: analytics.page,
    identify: analytics.identify
  };
};
