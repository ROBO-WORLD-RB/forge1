import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Notification, DeviceToken, NotificationType } from '../types/database';

/**
 * Feature: backend-services, Property Tests for Notification Service
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

// Mock Supabase module - must be hoisted
vi.mock('./supabase', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock monitoring service
vi.mock('./monitoringService', () => ({
  startTransaction: vi.fn(() => ({ finish: vi.fn() })),
  captureError: vi.fn(),
}));

// Import after mocking
import {
  createInAppNotification,
  getNotifications,
  markNotificationRead,
  getNotification,
  registerDeviceToken,
  getDeviceTokens,
} from './notificationService';
import { supabase } from './supabase';

// Arbitraries for generating test data
const userIdArbitrary = fc.uuid();
const notificationIdArbitrary = fc.uuid();
const deviceTokenIdArbitrary = fc.uuid();

// Generate valid notification types
const notificationTypeArbitrary = fc.constantFrom<NotificationType>(
  'new_message',
  'booking_request',
  'booking_accepted',
  'booking_completed',
  'subscription_expiring',
  'subscription_expired',
  'payment_failed',
  'new_review'
);

// Generate valid platform types
const platformArbitrary = fc.constantFrom<'ios' | 'android' | 'web'>('ios', 'android', 'web');

// Generate notification title and body (non-empty strings)
const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 });
const bodyArbitrary = fc.string({ minLength: 1, maxLength: 500 });

// Generate device token string
const tokenArbitrary = fc.string({ minLength: 20, maxLength: 200 });

// Generate metadata object
const metadataArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean())
);


// Helper to create a mock Notification
function createMockNotification(
  id: string,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: Record<string, unknown>,
  readAt?: string
): Notification {
  const now = new Date().toISOString();
  return {
    id,
    user_id: userId,
    type,
    title,
    body,
    metadata: metadata ?? null,
    read_at: readAt ?? null,
    created_at: now,
  };
}

// Helper to create a mock DeviceToken
function createMockDeviceToken(
  id: string,
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web'
): DeviceToken {
  const now = new Date().toISOString();
  return {
    id,
    user_id: userId,
    token,
    platform,
    created_at: now,
  };
}

describe('Notification Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Feature: backend-services, Property 30: Notification Creation Stores All Fields
   * Validates: Requirements 6.2
   * 
   * For any valid notification with userId, type, title, body, and metadata,
   * the created notification should contain all provided data.
   */
  describe('Property 30: Notification Creation Stores All Fields', () => {
    it('for any valid notification, created notification contains all provided fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          notificationTypeArbitrary,
          titleArbitrary,
          bodyArbitrary,
          fc.option(metadataArbitrary, { nil: undefined }),
          async (userId, type, title, body, metadata) => {
            vi.mocked(supabase.from).mockReset();

            const mockNotificationId = fc.sample(fc.uuid(), 1)[0];
            const expectedNotification = createMockNotification(
              mockNotificationId,
              userId,
              type,
              title,
              body,
              metadata as Record<string, unknown> | undefined
            );

            // Mock insert
            const mockSingle = vi.fn().mockResolvedValue({
              data: expectedNotification,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

            vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);

            const result = await createInAppNotification(userId, type, title, body, metadata as Record<string, unknown> | undefined);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Verify all fields are stored correctly
              expect(result.data.user_id).toBe(userId);
              expect(result.data.type).toBe(type);
              expect(result.data.title).toBe(title);
              expect(result.data.body).toBe(body);
              if (metadata) {
                expect(result.data.metadata).toEqual(metadata);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('createInAppNotification inserts with correct data structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          notificationTypeArbitrary,
          titleArbitrary,
          bodyArbitrary,
          async (userId, type, title, body) => {
            vi.mocked(supabase.from).mockReset();

            let capturedInsertData: any = null;

            const mockSingle = vi.fn().mockResolvedValue({
              data: createMockNotification(fc.sample(fc.uuid(), 1)[0], userId, type, title, body),
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockImplementation((data) => {
              capturedInsertData = data;
              return { select: mockSelect };
            });

            vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);

            await createInAppNotification(userId, type, title, body);

            expect(capturedInsertData).not.toBeNull();
            expect(capturedInsertData.user_id).toBe(userId);
            expect(capturedInsertData.type).toBe(type);
            expect(capturedInsertData.title).toBe(title);
            expect(capturedInsertData.body).toBe(body);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 31: Notification Query with Filter
   * Validates: Requirements 6.3
   * 
   * For any user with notifications, getNotifications with unreadOnly=true
   * should return only notifications where read_at is null.
   */
  describe('Property 31: Notification Query with Filter', () => {
    it('for any user, getNotifications with unreadOnly returns only unread notifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.array(
            fc.record({
              type: notificationTypeArbitrary,
              title: titleArbitrary,
              body: bodyArbitrary,
              isRead: fc.boolean(),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          async (userId, notificationSpecs) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock notifications based on specs
            const allNotifications = notificationSpecs.map((spec, index) =>
              createMockNotification(
                fc.sample(fc.uuid(), 1)[0],
                userId,
                spec.type,
                spec.title,
                spec.body,
                undefined,
                spec.isRead ? new Date().toISOString() : undefined
              )
            );

            // Filter to only unread for the mock response
            const unreadNotifications = allNotifications.filter(n => n.read_at === null);

            const mockIs = vi.fn().mockResolvedValue({
              data: unreadNotifications,
              error: null,
            });
            const mockOrder = vi.fn().mockReturnValue({ is: mockIs });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            const result = await getNotifications(userId, true);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // All returned notifications should have read_at as null
              for (const notification of result.data) {
                expect(notification.read_at).toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getNotifications without filter returns all notifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.integer({ min: 0, max: 10 }),
          async (userId, notificationCount) => {
            vi.mocked(supabase.from).mockReset();

            const mockNotifications = Array.from({ length: notificationCount }, (_, i) =>
              createMockNotification(
                fc.sample(fc.uuid(), 1)[0],
                userId,
                'new_message',
                `Title ${i}`,
                `Body ${i}`,
                undefined,
                i % 2 === 0 ? new Date().toISOString() : undefined
              )
            );

            const mockOrder = vi.fn().mockResolvedValue({
              data: mockNotifications,
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            const result = await getNotifications(userId, false);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            expect(result.data?.length).toBe(notificationCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getNotifications queries with correct user filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (userId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedEqField: string | null = null;
            let capturedEqValue: string | null = null;

            const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
            const mockEq = vi.fn().mockImplementation((field, value) => {
              capturedEqField = field;
              capturedEqValue = value;
              return { order: mockOrder };
            });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            await getNotifications(userId, false);

            expect(capturedEqField).toBe('user_id');
            expect(capturedEqValue).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 32: Notification Mark as Read Updates Timestamp
   * Validates: Requirements 6.4
   * 
   * For any unread notification, after markNotificationRead, the notification
   * should have a non-null read_at timestamp.
   */
  describe('Property 32: Notification Mark as Read Updates Timestamp', () => {
    it('markNotificationRead updates read_at to non-null timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          notificationIdArbitrary,
          userIdArbitrary,
          notificationTypeArbitrary,
          titleArbitrary,
          bodyArbitrary,
          async (notificationId, userId, type, title, body) => {
            vi.mocked(supabase.from).mockReset();

            let capturedUpdateData: any = null;

            // Create notification with read_at set after update
            const updatedNotification = createMockNotification(
              notificationId,
              userId,
              type,
              title,
              body,
              undefined,
              new Date().toISOString()
            );

            const mockSingle = vi.fn().mockResolvedValue({
              data: updatedNotification,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockImplementation((data) => {
              capturedUpdateData = data;
              return { eq: mockEq };
            });

            vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

            const result = await markNotificationRead(notificationId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            // Verify update was called with read_at timestamp
            expect(capturedUpdateData).not.toBeNull();
            expect(capturedUpdateData.read_at).toBeDefined();
            expect(typeof capturedUpdateData.read_at).toBe('string');

            // Verify returned notification has read_at set
            if (result.data) {
              expect(result.data.read_at).not.toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('markNotificationRead targets correct notification by ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          notificationIdArbitrary,
          async (notificationId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedEqField: string | null = null;
            let capturedEqValue: string | null = null;

            const mockSingle = vi.fn().mockResolvedValue({
              data: createMockNotification(
                notificationId,
                fc.sample(fc.uuid(), 1)[0],
                'new_message',
                'Title',
                'Body',
                undefined,
                new Date().toISOString()
              ),
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockImplementation((field, value) => {
              capturedEqField = field;
              capturedEqValue = value;
              return { select: mockSelect };
            });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

            await markNotificationRead(notificationId);

            expect(capturedEqField).toBe('id');
            expect(capturedEqValue).toBe(notificationId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 33: Device Token Registration
   * Validates: Requirements 6.5
   * 
   * For any valid device token registration, the token should be stored
   * with the correct userId and platform.
   */
  describe('Property 33: Device Token Registration', () => {
    it('registerDeviceToken stores token with correct userId and platform', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          tokenArbitrary,
          platformArbitrary,
          async (userId, token, platform) => {
            vi.mocked(supabase.from).mockReset();

            const mockTokenId = fc.sample(fc.uuid(), 1)[0];
            const expectedToken = createMockDeviceToken(mockTokenId, userId, token, platform);

            // Mock check for existing token (none found)
            const mockMaybeSingle = vi.fn().mockResolvedValue({
              data: null,
              error: null,
            });
            const mockCheckEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockCheckSelect = vi.fn().mockReturnValue({ eq: mockCheckEq });

            // Mock insert
            const mockInsertSingle = vi.fn().mockResolvedValue({
              data: expectedToken,
              error: null,
            });
            const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockCheckSelect } as any;
              }
              return { insert: mockInsert } as any;
            });

            const result = await registerDeviceToken(userId, token, platform);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Verify all fields are stored correctly
              expect(result.data.user_id).toBe(userId);
              expect(result.data.token).toBe(token);
              expect(result.data.platform).toBe(platform);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('registerDeviceToken returns existing token if already registered', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          tokenArbitrary,
          platformArbitrary,
          async (userId, token, platform) => {
            vi.mocked(supabase.from).mockReset();

            const existingToken = createMockDeviceToken(
              fc.sample(fc.uuid(), 1)[0],
              userId,
              token,
              platform
            );

            // Mock check for existing token (found)
            const mockMaybeSingle = vi.fn().mockResolvedValue({
              data: existingToken,
              error: null,
            });
            const mockCheckEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockCheckSelect = vi.fn().mockReturnValue({ eq: mockCheckEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockCheckSelect } as any);

            const result = await registerDeviceToken(userId, token, platform);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            expect(result.data?.id).toBe(existingToken.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('registerDeviceToken updates user_id if token exists for different user', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          userIdArbitrary,
          tokenArbitrary,
          platformArbitrary,
          async (newUserId, oldUserId, token, platform) => {
            // Ensure different users
            fc.pre(newUserId !== oldUserId);

            vi.mocked(supabase.from).mockReset();

            const existingToken = createMockDeviceToken(
              fc.sample(fc.uuid(), 1)[0],
              oldUserId,
              token,
              platform
            );

            const updatedToken = { ...existingToken, user_id: newUserId };

            // Mock check for existing token (found with different user)
            const mockMaybeSingle = vi.fn().mockResolvedValue({
              data: existingToken,
              error: null,
            });
            const mockCheckEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockCheckSelect = vi.fn().mockReturnValue({ eq: mockCheckEq });

            // Mock update
            const mockUpdateSingle = vi.fn().mockResolvedValue({
              data: updatedToken,
              error: null,
            });
            const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockUpdateSingle });
            const mockUpdateEq = vi.fn().mockReturnValue({ select: mockUpdateSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockCheckSelect } as any;
              }
              return { update: mockUpdate } as any;
            });

            const result = await registerDeviceToken(newUserId, token, platform);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            expect(result.data?.user_id).toBe(newUserId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('registerDeviceToken inserts with correct data structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          tokenArbitrary,
          platformArbitrary,
          async (userId, token, platform) => {
            vi.mocked(supabase.from).mockReset();

            let capturedInsertData: any = null;

            // Mock check for existing token (none found)
            const mockMaybeSingle = vi.fn().mockResolvedValue({
              data: null,
              error: null,
            });
            const mockCheckEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockCheckSelect = vi.fn().mockReturnValue({ eq: mockCheckEq });

            // Mock insert
            const mockInsertSingle = vi.fn().mockResolvedValue({
              data: createMockDeviceToken(fc.sample(fc.uuid(), 1)[0], userId, token, platform),
              error: null,
            });
            const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
            const mockInsert = vi.fn().mockImplementation((data) => {
              capturedInsertData = data;
              return { select: mockInsertSelect };
            });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockCheckSelect } as any;
              }
              return { insert: mockInsert } as any;
            });

            await registerDeviceToken(userId, token, platform);

            expect(capturedInsertData).not.toBeNull();
            expect(capturedInsertData.user_id).toBe(userId);
            expect(capturedInsertData.token).toBe(token);
            expect(capturedInsertData.platform).toBe(platform);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 34: Notification Round-Trip Persistence
   * Validates: Requirements 6.6, 6.7
   * 
   * For any valid notification data, after creating and retrieving,
   * the notification should contain all original data.
   */
  describe('Property 34: Notification Round-Trip Persistence', () => {
    it('for any notification, create then get returns equivalent data', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          notificationTypeArbitrary,
          titleArbitrary,
          bodyArbitrary,
          fc.option(metadataArbitrary, { nil: undefined }),
          async (userId, type, title, body, metadata) => {
            vi.mocked(supabase.from).mockReset();

            const mockNotificationId = fc.sample(fc.uuid(), 1)[0];
            const createdNotification = createMockNotification(
              mockNotificationId,
              userId,
              type,
              title,
              body,
              metadata as Record<string, unknown> | undefined
            );

            // Mock insert for create
            const mockCreateSingle = vi.fn().mockResolvedValue({
              data: createdNotification,
              error: null,
            });
            const mockCreateSelect = vi.fn().mockReturnValue({ single: mockCreateSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockCreateSelect });

            vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);

            const createResult = await createInAppNotification(
              userId,
              type,
              title,
              body,
              metadata as Record<string, unknown> | undefined
            );

            expect(createResult.error).toBeNull();
            expect(createResult.data).not.toBeNull();

            // Now mock get
            vi.mocked(supabase.from).mockReset();

            const mockGetSingle = vi.fn().mockResolvedValue({
              data: createdNotification,
              error: null,
            });
            const mockGetEq = vi.fn().mockReturnValue({ single: mockGetSingle });
            const mockGetSelect = vi.fn().mockReturnValue({ eq: mockGetEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockGetSelect } as any);

            const getResult = await getNotification(mockNotificationId);

            expect(getResult.error).toBeNull();
            expect(getResult.data).not.toBeNull();

            if (createResult.data && getResult.data) {
              // Verify round-trip preserves all data
              expect(getResult.data.id).toBe(createResult.data.id);
              expect(getResult.data.user_id).toBe(createResult.data.user_id);
              expect(getResult.data.type).toBe(createResult.data.type);
              expect(getResult.data.title).toBe(createResult.data.title);
              expect(getResult.data.body).toBe(createResult.data.body);
              expect(getResult.data.metadata).toEqual(createResult.data.metadata);
              expect(getResult.data.created_at).toBe(createResult.data.created_at);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('device token round-trip preserves all data', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          tokenArbitrary,
          platformArbitrary,
          async (userId, token, platform) => {
            vi.mocked(supabase.from).mockReset();

            const mockTokenId = fc.sample(fc.uuid(), 1)[0];
            const createdToken = createMockDeviceToken(mockTokenId, userId, token, platform);

            // Mock check for existing token (none found)
            const mockMaybeSingle = vi.fn().mockResolvedValue({
              data: null,
              error: null,
            });
            const mockCheckEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockCheckSelect = vi.fn().mockReturnValue({ eq: mockCheckEq });

            // Mock insert
            const mockInsertSingle = vi.fn().mockResolvedValue({
              data: createdToken,
              error: null,
            });
            const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockCheckSelect } as any;
              }
              return { insert: mockInsert } as any;
            });

            const createResult = await registerDeviceToken(userId, token, platform);

            expect(createResult.error).toBeNull();
            expect(createResult.data).not.toBeNull();

            // Now mock get
            vi.mocked(supabase.from).mockReset();

            const mockGetResult = vi.fn().mockResolvedValue({
              data: [createdToken],
              error: null,
            });
            const mockGetEq = vi.fn().mockReturnValue(mockGetResult());
            const mockGetSelect = vi.fn().mockReturnValue({ eq: mockGetEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockGetSelect } as any);

            const getResult = await getDeviceTokens(userId);

            expect(getResult.error).toBeNull();
            expect(getResult.data).not.toBeNull();
            expect(getResult.data?.length).toBeGreaterThan(0);

            if (createResult.data && getResult.data && getResult.data.length > 0) {
              const retrievedToken = getResult.data[0];
              // Verify round-trip preserves all data
              expect(retrievedToken.id).toBe(createResult.data.id);
              expect(retrievedToken.user_id).toBe(createResult.data.user_id);
              expect(retrievedToken.token).toBe(createResult.data.token);
              expect(retrievedToken.platform).toBe(createResult.data.platform);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
