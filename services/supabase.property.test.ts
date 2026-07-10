import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';

/**
 * Feature: infrastructure-enhancements, Property 1: User Registration Round Trip (partial - client init)
 * Validates: Requirements 1.1
 * 
 * For any valid Supabase configuration (URL and anon key), the client
 * should initialize without throwing an error.
 */
describe('Supabase Client Initialization Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('client initializes without error for any valid URL and key format', () => {
    fc.assert(
      fc.property(
        // Generate valid URL-like strings
        fc.record({
          projectId: fc.stringMatching(/^[a-z]{8,20}$/),
        }),
        // Generate valid anon key-like strings (base64-ish format)
        fc.stringMatching(/^[A-Za-z0-9_-]{32,64}$/),
        ({ projectId }, anonKey) => {
          const url = `https://${projectId}.supabase.co`;
          
          // Client creation should not throw
          expect(() => {
            const client = createClient(url, anonKey, {
              auth: {
                autoRefreshToken: true,
                persistSession: false, // Disable for testing
                detectSessionInUrl: false,
              },
            });
            
            // Verify client has expected structure
            expect(client).toBeDefined();
            expect(client.auth).toBeDefined();
            expect(client.from).toBeDefined();
            expect(typeof client.auth.getSession).toBe('function');
            expect(typeof client.auth.signUp).toBe('function');
            expect(typeof client.auth.signInWithPassword).toBe('function');
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('client exposes required auth methods for any valid config', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{8,20}$/),
        fc.stringMatching(/^[A-Za-z0-9_-]{32,64}$/),
        (projectId, anonKey) => {
          const url = `https://${projectId}.supabase.co`;
          const client = createClient(url, anonKey, {
            auth: { persistSession: false },
          });

          // Verify all required auth methods exist
          const authMethods = [
            'getSession',
            'getUser',
            'signUp',
            'signInWithPassword',
            'signOut',
            'onAuthStateChange',
          ];

          authMethods.forEach((method) => {
            expect(typeof client.auth[method as keyof typeof client.auth]).toBe('function');
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('client exposes database query builder for any valid config', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{8,20}$/),
        fc.stringMatching(/^[A-Za-z0-9_-]{32,64}$/),
        fc.stringMatching(/^[a-z_]{3,20}$/), // Table name
        (projectId, anonKey, tableName) => {
          const url = `https://${projectId}.supabase.co`;
          const client = createClient(url, anonKey, {
            auth: { persistSession: false },
          });

          // Verify from() returns a query builder
          const queryBuilder = client.from(tableName);
          expect(queryBuilder).toBeDefined();
          expect(typeof queryBuilder.select).toBe('function');
          expect(typeof queryBuilder.insert).toBe('function');
          expect(typeof queryBuilder.update).toBe('function');
          expect(typeof queryBuilder.delete).toBe('function');
        }
      ),
      { numRuns: 50 }
    );
  });
});
