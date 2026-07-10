import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  captureError,
  setUser,
  startTransaction,
  _testing,
  UserContext,
} from './monitoringService';

describe('Monitoring Service Property Tests', () => {
  beforeEach(() => {
    _testing.reset();
  });

  /**
   * Feature: infrastructure-enhancements, Property 9: Error Capture Completeness
   * Validates: Requirements 4.2
   * 
   * For any error passed to captureError, the captured event should include
   * the error message, stack trace, and timestamp.
   */
  describe('Property 9: Error Capture Completeness', () => {
    it('captured events include message, stack trace, and timestamp', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (errorMessage) => {
            _testing.clearCapturedEvents();
            
            const error = new Error(errorMessage);
            captureError(error);
            
            const events = _testing.getCapturedEvents();
            expect(events.length).toBe(1);
            
            const capturedEvent = events[0];
            
            // Must have message
            expect(capturedEvent.message).toBe(errorMessage);
            
            // Must have stack trace
            expect(capturedEvent.stack).toBeDefined();
            expect(typeof capturedEvent.stack).toBe('string');
            expect(capturedEvent.stack!.length).toBeGreaterThan(0);
            
            // Must have timestamp
            expect(capturedEvent.timestamp).toBeDefined();
            expect(typeof capturedEvent.timestamp).toBe('number');
            expect(capturedEvent.timestamp).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: infrastructure-enhancements, Property 10: Performance Transaction Recording
   * Validates: Requirements 4.3
   * 
   * For any transaction started with startTransaction, the transaction should
   * record start time, end time, and operation name when finished.
   */
  describe('Property 10: Performance Transaction Recording', () => {
    it('transactions record start time, end time, and operation name', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (name, op) => {
            const transaction = startTransaction(name, op);
            
            // Must have name and op
            expect(transaction.name).toBe(name);
            expect(transaction.op).toBe(op);
            
            // Must have start time
            expect(transaction.startTime).toBeDefined();
            expect(typeof transaction.startTime).toBe('number');
            expect(transaction.startTime).toBeGreaterThan(0);
            
            // End time should not be set before finish
            expect(transaction.endTime).toBeUndefined();
            
            // Finish the transaction
            transaction.finish();
            
            // End time should be set after finish
            expect(transaction.endTime).toBeDefined();
            expect(typeof transaction.endTime).toBe('number');
            expect(transaction.endTime!).toBeGreaterThanOrEqual(transaction.startTime);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: infrastructure-enhancements, Property 11: Error Context Attachment
   * Validates: Requirements 4.4
   * 
   * For any error captured when a user is authenticated, the captured event
   * should include the user's anonymized ID and role.
   */
  describe('Property 11: Error Context Attachment', () => {
    it('captured events include user context when user is set', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.oneof(fc.constant('worker'), fc.constant('customer'), fc.constant('admin')),
          (errorMessage, userId, role) => {
            _testing.clearCapturedEvents();
            
            // Set user context
            const user: UserContext = { id: userId, role };
            setUser(user);
            
            // Capture an error
            const error = new Error(errorMessage);
            captureError(error);
            
            const events = _testing.getCapturedEvents();
            expect(events.length).toBe(1);
            
            const capturedEvent = events[0];
            
            // Must have user context
            expect(capturedEvent.user).toBeDefined();
            expect(capturedEvent.user!.id).toBe(userId);
            expect(capturedEvent.user!.role).toBe(role);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('captured events do not include user context when user is not set', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (errorMessage) => {
            _testing.clearCapturedEvents();
            
            // Ensure no user is set
            setUser(null);
            
            // Capture an error
            const error = new Error(errorMessage);
            captureError(error);
            
            const events = _testing.getCapturedEvents();
            expect(events.length).toBe(1);
            
            const capturedEvent = events[0];
            
            // Should not have user context
            expect(capturedEvent.user).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: infrastructure-enhancements, Property 12: Sensitive Data Filtering
   * Validates: Requirements 4.5
   * 
   * For any error context containing strings matching password, token, or secret
   * patterns, the captured event should have those values redacted or removed.
   */
  describe('Property 12: Sensitive Data Filtering', () => {
    it('filters sensitive keys from error context', () => {
      const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authToken', 'credential', 'bearer'];
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.constantFrom(...sensitiveKeys),
          fc.string({ minLength: 1 }),
          (errorMessage, sensitiveKey, sensitiveValue) => {
            _testing.clearCapturedEvents();
            
            const error = new Error(errorMessage);
            const context = {
              extra: {
                [sensitiveKey]: sensitiveValue,
                safeKey: 'safeValue',
              },
            };
            
            captureError(error, context);
            
            const events = _testing.getCapturedEvents();
            expect(events.length).toBe(1);
            
            const capturedEvent = events[0];
            
            // Sensitive key should be redacted
            expect(capturedEvent.extra).toBeDefined();
            expect(capturedEvent.extra![sensitiveKey]).toBe('[REDACTED]');
            
            // Safe key should not be redacted
            expect(capturedEvent.extra!['safeKey']).toBe('safeValue');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filters nested sensitive data', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (errorMessage, sensitiveValue) => {
            _testing.clearCapturedEvents();
            
            const error = new Error(errorMessage);
            const context = {
              extra: {
                nested: {
                  password: sensitiveValue,
                  safe: 'value',
                },
              },
            };
            
            captureError(error, context);
            
            const events = _testing.getCapturedEvents();
            expect(events.length).toBe(1);
            
            const capturedEvent = events[0];
            
            // Nested sensitive key should be redacted
            expect(capturedEvent.extra).toBeDefined();
            const nested = capturedEvent.extra!['nested'] as Record<string, unknown>;
            expect(nested['password']).toBe('[REDACTED]');
            expect(nested['safe']).toBe('value');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
