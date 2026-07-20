import { logEvent } from '../services/analyticsService';

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: string;
  sessionId: string;
}

const ANALYTICS_KEY = 'forge_analytics';
const SESSION_KEY = 'forge_session_id';
const MAX_EVENTS = 500;

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

const persistEventLocal = (event: AnalyticsEvent) => {
  try {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    const events: AnalyticsEvent[] = stored ? JSON.parse(stored) : [];
    events.push(event);
    if (events.length > MAX_EVENTS) events.shift();
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
  } catch (err) {
    console.error('[Analytics] Failed to persist event locally:', err);
  }
};

/** Mirror key events to Supabase analytics_events (best-effort). */
const persistEventRemote = (event: AnalyticsEvent) => {
  const pagePath =
    typeof event.properties?.page === 'string'
      ? event.properties.page
      : typeof window !== 'undefined'
        ? window.location.pathname
        : null;

  void logEvent({
    eventName: event.name,
    properties: event.properties,
    sessionId: event.sessionId,
    pagePath,
  });
};

export const analytics = {
  track: (name: string, properties?: Record<string, unknown>) => {
    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    persistEventLocal(event);
    persistEventRemote(event);

    if (import.meta.env.DEV) {
      console.debug('[Analytics]', name, properties || '');
    }
  },

  page: (pageName: string, properties?: Record<string, unknown>) => {
    analytics.track('page_view', { page: pageName, ...properties });
  },

  identify: (userId: string, traits?: Record<string, unknown>) => {
    analytics.track('identify', { userId, ...traits });
  },

  getEvents: (): AnalyticsEvent[] => {
    try {
      const stored = localStorage.getItem(ANALYTICS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('[Analytics] Failed to parse stored events:', err);
      return [];
    }
  },

  clearEvents: () => {
    localStorage.removeItem(ANALYTICS_KEY);
  },
};

// Common event helpers
export const trackSearch = (query: string, resultsCount: number) =>
  analytics.track('search', { query, resultsCount });

export const trackWorkerView = (workerId: string, workerName: string) =>
  analytics.track('worker_view', { workerId, workerName });

export const trackSignup = (role: string, country: string) =>
  analytics.track('signup', { role, country });

export const trackLogin = (method: string) =>
  analytics.track('login', { method });

export const trackError = (error: string, context?: string) =>
  analytics.track('error', { error, context });

export const trackBookingCreated = (bookingId: string, meta?: Record<string, unknown>) =>
  analytics.track('booking_created', { bookingId, ...meta });

export const trackApply = (jobId: string, applicationId?: string) =>
  analytics.track('apply', { jobId, applicationId });

export const trackFavorite = (workerUserId: string, favorited: boolean) =>
  analytics.track('favorite', { workerUserId, favorited });
