type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  context?: string;
}

const LOG_STORAGE_KEY = 'forge_logs';
const MAX_LOGS = 100;

const isDev = import.meta.env.DEV;

const formatTimestamp = () => new Date().toISOString();

const persistLog = (entry: LogEntry) => {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    const logs: LogEntry[] = stored ? JSON.parse(stored) : [];
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('[Logger] Failed to persist log entry:', err);
  }
};

const createLogEntry = (level: LogLevel, message: string, data?: unknown, context?: string): LogEntry => ({
  timestamp: formatTimestamp(),
  level,
  message,
  data,
  context
});

export const logger = {
  debug: (message: string, data?: unknown, context?: string) => {
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
    persistLog(createLogEntry('debug', message, data, context));
  },

  info: (message: string, data?: unknown, context?: string) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, data || '');
    }
    persistLog(createLogEntry('info', message, data, context));
  },

  warn: (message: string, data?: unknown, context?: string) => {
    console.warn(`[WARN] ${message}`, data || '');
    persistLog(createLogEntry('warn', message, data, context));
  },

  error: (message: string, data?: unknown, context?: string) => {
    console.error(`[ERROR] ${message}`, data || '');
    persistLog(createLogEntry('error', message, data, context));
  },

  getLogs: (): LogEntry[] => {
    try {
      const stored = localStorage.getItem(LOG_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('[Logger] Failed to retrieve logs:', err);
      return [];
    }
  },

  clearLogs: () => {
    localStorage.removeItem(LOG_STORAGE_KEY);
  }
};
