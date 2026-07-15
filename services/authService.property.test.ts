import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { UserRole } from '../types/database';

/**
 * Feature: infrastructure-enhancements, Property 1: User Registration Round Trip
 * Validates: Requirements 1.2
 * 
 * For any valid user registration data (email, password, metadata), after successful
 * registration, querying the user profile should return data equivalent to the input metadata.
 */

// Mock Supabase module - must be hoisted
vi.mock('./supabase', () => {
  const mockAuth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  };
  
  const mockFrom = vi.fn();
  
  return {
    supabase: {
      auth: mockAuth,
      from: mockFrom,
    },
  };
});

vi.mock('./monitoringService', () => ({
  startTransaction: () => ({ finish: vi.fn() }),
  captureError: vi.fn(),
}));

vi.mock('../utils/promiseTimeout', () => ({
  withTimeout: (promise: Promise<unknown>) => promise,
  withTimeoutFallback: (promise: Promise<unknown>) => promise,
}));

/** Chain for getUserProfile → not found, then insert for ensureProfileAfterSignup */
function mockProfileMissingThenInsert(insertImpl?: (data: any) => Promise<{ error: any }>) {
  const insert = vi.fn().mockImplementation(async (data: any) => {
    if (insertImpl) return insertImpl(data);
    return { error: null };
  });

  vi.mocked(supabase.from)
    .mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found', code: 'PGRST116' } }),
        }),
      }),
    } as any)
    .mockReturnValueOnce({
      insert,
    } as any);

  return insert;
}

// Import after mocking
import { signUp, signIn } from './authService';
import { supabase } from './supabase';

// Type for UserMetadata
interface UserMetadata {
  phone: string;
  role: UserRole;
  country: 'GH' | 'NG';
  firstName?: string;
  lastName?: string;
}

// Arbitraries for generating test data
const emailArbitrary = fc.emailAddress();

const passwordArbitrary = fc.string({ minLength: 8, maxLength: 64 })
  .filter(s => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s));

const phoneArbitrary = fc.oneof(
  // Ghana phone format
  fc.stringMatching(/^\+233[245]\d{8}$/),
  // Nigeria phone format  
  fc.stringMatching(/^\+234[0-9]\d{9}$/)
);

const roleArbitrary: fc.Arbitrary<UserRole> = fc.constantFrom('worker', 'customer', 'admin');

const countryArbitrary: fc.Arbitrary<'GH' | 'NG'> = fc.constantFrom('GH', 'NG');

const nameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

const userMetadataArbitrary: fc.Arbitrary<UserMetadata> = fc.record({
  phone: phoneArbitrary,
  role: roleArbitrary,
  country: countryArbitrary,
  firstName: fc.option(nameArbitrary, { nil: undefined }),
  lastName: fc.option(nameArbitrary, { nil: undefined }),
});

describe('Auth Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Feature: infrastructure-enhancements, Property 1: User Registration Round Trip
   * Validates: Requirements 1.2
   */
  describe('Property 1: User Registration Round Trip', () => {
    it('for any valid registration data, successful signup returns user with matching metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          passwordArbitrary,
          userMetadataArbitrary,
          async (email, password, metadata) => {
            const mockUserId = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            
            // Mock successful signup response
            vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
              data: {
                user: {
                  id: mockUserId,
                  email,
                  user_metadata: {
                    phone: metadata.phone,
                    role: metadata.role,
                    country: metadata.country,
                    first_name: metadata.firstName,
                    last_name: metadata.lastName,
                  },
                } as any,
                session: {
                  access_token: 'mock-token',
                  refresh_token: 'mock-refresh',
                  expires_in: 3600,
                  token_type: 'bearer',
                  user: { id: mockUserId, email } as any,
                } as any,
              },
              error: null,
            });

            mockProfileMissingThenInsert();

            const result = await signUp(email, password, metadata);

            // Verify no error
            expect(result.error).toBeNull();
            expect(result.user).not.toBeNull();
            
            // Verify user metadata matches input
            if (result.user) {
              expect(result.user.email).toBe(email);
              expect(result.user.user_metadata.phone).toBe(metadata.phone);
              expect(result.user.user_metadata.role).toBe(metadata.role);
              expect(result.user.user_metadata.country).toBe(metadata.country);
              
              if (metadata.firstName) {
                expect(result.user.user_metadata.first_name).toBe(metadata.firstName);
              }
              if (metadata.lastName) {
                expect(result.user.user_metadata.last_name).toBe(metadata.lastName);
              }
            }

            // Verify session is returned
            expect(result.session).not.toBeNull();
            if (result.session) {
              expect(result.session.access_token).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any valid registration data, profile is created with matching data', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          passwordArbitrary,
          userMetadataArbitrary,
          async (email, password, metadata) => {
            const mockUserId = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            let capturedProfileData: any = null;

            // Mock successful signup response
            vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
              data: {
                user: { id: mockUserId, email } as any,
                session: { access_token: 'mock-token' } as any,
              },
              error: null,
            });

            const mockInsert = mockProfileMissingThenInsert(async (data: any) => {
              capturedProfileData = data;
              return { error: null };
            });

            await signUp(email, password, metadata);

            // Trigger miss path: client inserts full RLS-compliant profile (including role)
            expect(mockInsert).toHaveBeenCalled();
            expect(capturedProfileData).not.toBeNull();
            expect(capturedProfileData.id).toBe(mockUserId);
            expect(capturedProfileData.phone).toBe(metadata.phone);
            expect(capturedProfileData.country).toBe(metadata.country);
            expect(capturedProfileData.first_name).toBe(metadata.firstName || null);
            expect(capturedProfileData.last_name).toBe(metadata.lastName || null);
            expect(capturedProfileData.username).toBeDefined();
            const expectedRole = metadata.role === 'worker' ? 'worker' : 'customer';
            expect(capturedProfileData.role).toBe(expectedRole);
            expect(capturedProfileData.profile_completed).toBe(expectedRole === 'customer');
            expect(capturedProfileData.verified).toBe(false);

            expect(vi.mocked(supabase.auth.signUp)).toHaveBeenCalledWith(
              expect.objectContaining({
                options: expect.objectContaining({
                  data: expect.objectContaining({ role: expectedRole }),
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any registration that fails, error is returned with message', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          passwordArbitrary,
          userMetadataArbitrary,
          fc.string({ minLength: 5, maxLength: 100 }), // Error message
          async (email, password, metadata, errorMessage) => {
            // Mock failed signup response
            vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
              data: { user: null, session: null },
              error: { message: errorMessage, code: 'auth_error' } as any,
            });

            const result = await signUp(email, password, metadata);

            // Verify error is returned (some Auth DB failures are remapped to a clearer message)
            expect(result.error).not.toBeNull();
            const lower = errorMessage.toLowerCase();
            const isDbSignup =
              lower.includes('database error saving new user') ||
              lower.includes('database error creating new user') ||
              lower.includes('unable to sign up new user') ||
              lower.includes('database couldn') ||
              lower.includes("couldn't save new user") ||
              lower.includes('could not save new user');
            if (isDbSignup) {
              expect(result.error?.code).toBe('database_signup_failed');
            } else if (
              lower.includes('already registered') ||
              lower.includes('already been registered') ||
              lower.includes('user already exists')
            ) {
              expect(result.error?.code).toBe('user_already_exists');
            } else {
              expect(result.error?.message).toBe(errorMessage);
            }
            expect(result.user).toBeNull();
            expect(result.session).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});


  /**
   * Feature: infrastructure-enhancements, Property 2: Login Returns Valid Session
   * Validates: Requirements 1.3
   * 
   * For any registered user with valid credentials, calling signIn should return
   * a non-null session with a valid JWT token.
   */
  describe('Property 2: Login Returns Valid Session', () => {
    it('for any valid credentials, successful login returns non-null session with JWT token', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          passwordArbitrary,
          async (email, password) => {
            const mockUserId = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const mockAccessToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ sub: mockUserId, email })).toString('base64')}.signature`;
            
            // Mock successful login response
            vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
              data: {
                user: {
                  id: mockUserId,
                  email,
                  aud: 'authenticated',
                  role: 'authenticated',
                } as any,
                session: {
                  access_token: mockAccessToken,
                  refresh_token: 'mock-refresh-token',
                  expires_in: 3600,
                  expires_at: Math.floor(Date.now() / 1000) + 3600,
                  token_type: 'bearer',
                  user: { id: mockUserId, email } as any,
                } as any,
              },
              error: null,
            });

            const result = await signIn(email, password);

            // Verify no error
            expect(result.error).toBeNull();
            
            // Verify session is non-null
            expect(result.session).not.toBeNull();
            
            // Verify session has valid JWT token structure
            if (result.session) {
              expect(result.session.access_token).toBeDefined();
              expect(typeof result.session.access_token).toBe('string');
              expect(result.session.access_token.length).toBeGreaterThan(0);
              
              // JWT tokens have 3 parts separated by dots
              const tokenParts = result.session.access_token.split('.');
              expect(tokenParts.length).toBe(3);
              
              // Verify other session properties
              expect(result.session.token_type).toBe('bearer');
              expect(result.session.expires_in).toBeGreaterThan(0);
            }
            
            // Verify user is returned
            expect(result.user).not.toBeNull();
            if (result.user) {
              expect(result.user.id).toBe(mockUserId);
              expect(result.user.email).toBe(email);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any invalid credentials, login returns error without session', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          passwordArbitrary,
          async (email, password) => {
            // Mock failed login response (invalid credentials)
            vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
              data: { user: null, session: null },
              error: { 
                message: 'Invalid login credentials', 
                code: 'invalid_credentials',
                status: 400,
              } as any,
            });

            const result = await signIn(email, password);

            // Verify error is returned (mapSignInError normalizes Supabase message)
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toBe('Invalid email or password. Please try again.');
            expect(result.error?.code).toBe('invalid_credentials');
            
            // Verify no session or user
            expect(result.session).toBeNull();
            expect(result.user).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('for any successful login, session contains required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          passwordArbitrary,
          fc.integer({ min: 1800, max: 86400 }), // expires_in between 30 min and 24 hours
          async (email, password, expiresIn) => {
            const mockUserId = `user-${Date.now()}`;
            const mockAccessToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ sub: mockUserId })).toString('base64')}.sig`;
            const mockRefreshToken = `refresh-${Date.now()}`;
            const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
            
            // Mock successful login response with specific expiry
            vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
              data: {
                user: { id: mockUserId, email } as any,
                session: {
                  access_token: mockAccessToken,
                  refresh_token: mockRefreshToken,
                  expires_in: expiresIn,
                  expires_at: expiresAt,
                  token_type: 'bearer',
                  user: { id: mockUserId, email } as any,
                } as any,
              },
              error: null,
            });

            const result = await signIn(email, password);

            // Verify session has all required fields
            expect(result.session).not.toBeNull();
            if (result.session) {
              expect(result.session.access_token).toBe(mockAccessToken);
              expect(result.session.refresh_token).toBe(mockRefreshToken);
              expect(result.session.expires_in).toBe(expiresIn);
              expect(result.session.expires_at).toBe(expiresAt);
              expect(result.session.token_type).toBe('bearer');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
