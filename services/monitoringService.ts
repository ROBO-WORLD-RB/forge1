import * as Sentry from '@sentry/react';

// Sensitive data patterns to filter
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /bearer/i,
];

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
}

export interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface UserContext {
  id: string;
  role?: string;
}

export interface CapturedEvent {
  message: string;
  stack?: string;
  timestamp: number;
  user?: UserContext;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface Transaction {
  name: string;
  op: string;
  startTime: number;
  endTime?: number;
  finish: () => void;
}

// Store for captured events (used for testing)
let capturedEvents: CapturedEvent[] = [];
let currentUser: UserContext | null = null;
let isInitialized = false;

/**
 * Filter sensitive data from an object
 */
function filterSensitiveData(obj: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const isSensitiveKey = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    
    if (isSensitiveKey) {
      filtered[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      // Check if value looks like a sensitive value
      const isSensitiveValue = SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
      filtered[key] = isSensitiveValue ? '[REDACTED]' : value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      filtered[key] = filterSensitiveData(value as Record<string, unknown>);
    } else {
      filtered[key] = value;
    }
  }
  
  return filtered;
}

/**
 * Initialize Sentry with the provided configuration
 */
export function initialize(config: SentryConfig): void {
  if (isInitialized) {
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    beforeSend(event) {
      // Filter sensitive data from the event
      if (event.extra) {
        event.extra = filterSensitiveData(event.extra as Record<string, unknown>);
      }
      
      // Filter sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            breadcrumb.data = filterSensitiveData(breadcrumb.data as Record<string, unknown>);
          }
          return breadcrumb;
        });
      }
      
      return event;
    },
  });

  isInitialized = true;
}

/**
 * Capture an error with optional context
 */
export function captureError(error: Error, context?: ErrorContext): void {
  const timestamp = Date.now();
  
  // Filter sensitive data from context
  const filteredExtra = context?.extra 
    ? filterSensitiveData(context.extra as Record<string, unknown>)
    : undefined;
  
  // Store captured event for testing
  const capturedEvent: CapturedEvent = {
    message: error.message,
    stack: error.stack,
    timestamp,
    user: currentUser || undefined,
    tags: context?.tags,
    extra: filteredExtra,
  };
  
  capturedEvents.push(capturedEvent);
  
  // Send to Sentry
  Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    
    if (filteredExtra) {
      Object.entries(filteredExtra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    
    Sentry.captureException(error);
  });
}

/**
 * Capture a message with severity level
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set the current user context
 */
export function setUser(user: UserContext | null): void {
  currentUser = user;
  
  if (user) {
    Sentry.setUser({
      id: user.id,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string): Transaction {
  const startTime = Date.now();
  
  const sentrySpan = Sentry.startInactiveSpan({
    name,
    op,
  });
  
  const transaction: Transaction = {
    name,
    op,
    startTime,
    finish: () => {
      transaction.endTime = Date.now();
      sentrySpan?.end();
    },
  };
  
  return transaction;
}

// Testing utilities - only exported for testing purposes
export const _testing = {
  getCapturedEvents: (): CapturedEvent[] => [...capturedEvents],
  clearCapturedEvents: (): void => {
    capturedEvents = [];
  },
  getCurrentUser: (): UserContext | null => currentUser,
  reset: (): void => {
    capturedEvents = [];
    currentUser = null;
    isInitialized = false;
  },
  filterSensitiveData,
};

// Export Sentry's ErrorBoundary for use in App
export const SentryErrorBoundary = Sentry.ErrorBoundary;
