import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logger } from './logger';

describe('Logger', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs debug messages and persists to storage', () => {
    logger.debug('test debug message', { data: 'value' });
    
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('debug');
    expect(logs[0].message).toBe('test debug message');
    expect(logs[0].data).toEqual({ data: 'value' });
  });

  it('logs info messages and persists to storage', () => {
    logger.info('test info message');
    
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].message).toBe('test info message');
  });

  it('logs warn messages and persists to storage', () => {
    logger.warn('test warn message', null, 'TestContext');
    
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('warn');
    expect(logs[0].message).toBe('test warn message');
    expect(logs[0].context).toBe('TestContext');
  });

  it('logs error messages and persists to storage', () => {
    logger.error('test error message');
    
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('error');
    expect(logs[0].message).toBe('test error message');
  });

  it('includes timestamp in log entries', () => {
    logger.info('timestamp test');
    
    const logs = logger.getLogs();
    expect(logs[0].timestamp).toBeDefined();
    expect(new Date(logs[0].timestamp).getTime()).not.toBeNaN();
  });

  it('clearLogs removes all stored logs', () => {
    logger.info('message 1');
    logger.info('message 2');
    expect(logger.getLogs().length).toBe(2);
    
    logger.clearLogs();
    expect(logger.getLogs().length).toBe(0);
  });

  it('getLogs returns empty array when no logs exist', () => {
    const logs = logger.getLogs();
    expect(logs).toEqual([]);
  });
});
