import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { hashPassword, verifyPassword } from './crypto';

/**
 * Feature: infrastructure-enhancements, Property: Encryption round trip
 * Validates: Requirements 2.3
 * 
 * For any string password, hashing then verifying with the same password
 * should return true.
 */
describe('Crypto Property Tests', () => {
  // PBKDF2 with 100k iterations is slow, so we use fewer runs and longer timeout
  it('hash then verify returns true for any password (round trip)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-empty strings as passwords
        fc.string({ minLength: 1, maxLength: 50 }),
        async (password) => {
          const hash = await hashPassword(password);
          const isValid = await verifyPassword(password, hash);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 10 } // Reduced due to slow PBKDF2 operations
    );
  }, 60000); // 60 second timeout

  it('verify returns false for wrong password', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        async (password1, password2) => {
          // Only test when passwords are different
          fc.pre(password1 !== password2);
          
          const hash = await hashPassword(password1);
          const isValid = await verifyPassword(password2, hash);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 10 } // Reduced due to slow PBKDF2 operations
    );
  }, 60000); // 60 second timeout
});
