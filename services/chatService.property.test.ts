import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Conversation, Message } from '../types/database';

/**
 * Feature: backend-services, Property Tests for Chat Service
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
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
  createConversation,
  sendMessage,
  getConversations,
  getMessages,
  markAsRead,
  getUnreadCount,
  CHAT_ERROR_CODES,
} from './chatService';
import { supabase } from './supabase';

// Arbitraries for generating test data
const userIdArbitrary = fc.uuid();
const conversationIdArbitrary = fc.uuid();
const messageIdArbitrary = fc.uuid();
const bookingIdArbitrary = fc.uuid();

// Generate valid date strings
const validDateArbitrary = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map(ts => new Date(ts).toISOString());

// Generate message body (non-empty string)
const messageBodyArbitrary = fc.string({ minLength: 1, maxLength: 1000 });

// Generate attachments array
const attachmentsArbitrary = fc.array(fc.webUrl(), { minLength: 0, maxLength: 5 });

// Helper to create a mock Conversation
function createMockConversation(
  id: string,
  participant1: string,
  participant2: string,
  bookingId?: string,
  lastMessageAt?: string
): Conversation {
  const now = new Date().toISOString();
  return {
    id,
    participant_1: participant1,
    participant_2: participant2,
    booking_id: bookingId ?? null,
    last_message_at: lastMessageAt ?? null,
    created_at: now,
  };
}

// Helper to create a mock Message
function createMockMessage(
  id: string,
  conversationId: string,
  senderId: string,
  body: string,
  attachments?: string[],
  readAt?: string
): Message {
  const now = new Date().toISOString();
  return {
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    attachments: attachments ?? null,
    read_at: readAt ?? null,
    created_at: now,
  };
}

describe('Chat Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });


  /**
   * Feature: backend-services, Property 18: Conversation Creation Links Participants
   * Validates: Requirements 4.1
   * 
   * For any two user IDs, createConversation should create a conversation where
   * both users are participants.
   */
  describe('Property 18: Conversation Creation Links Participants', () => {
    it('for any two user IDs, created conversation has both as participants', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          userIdArbitrary,
          fc.option(bookingIdArbitrary, { nil: undefined }),
          async (user1Id, user2Id, bookingId) => {
            vi.mocked(supabase.from).mockReset();

            const mockConversationId = fc.sample(fc.uuid(), 1)[0];
            const expectedConversation = createMockConversation(
              mockConversationId,
              user1Id,
              user2Id,
              bookingId
            );

            // Mock check for existing conversation (none found)
            const mockMaybeSingle = vi.fn().mockResolvedValue({
              data: null,
              error: null,
            });
            const mockOr = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockCheckSelect = vi.fn().mockReturnValue({ or: mockOr });

            // Mock insert
            const mockInsertSingle = vi.fn().mockResolvedValue({
              data: expectedConversation,
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

            const result = await createConversation(user1Id, user2Id, bookingId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Verify both participants are linked
              expect(result.data.participant_1).toBe(user1Id);
              expect(result.data.participant_2).toBe(user2Id);
              // Verify booking_id if provided
              if (bookingId) {
                expect(result.data.booking_id).toBe(bookingId);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('createConversation returns existing conversation if one exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          userIdArbitrary,
          async (user1Id, user2Id) => {
            vi.mocked(supabase.from).mockReset();

            const existingConversation = createMockConversation(
              fc.sample(fc.uuid(), 1)[0],
              user1Id,
              user2Id
            );

            // Mock check for existing conversation (found)
            const mockMaybeSingle = vi.fn().mockResolvedValue({
              data: existingConversation,
              error: null,
            });
            const mockOr = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockCheckSelect = vi.fn().mockReturnValue({ or: mockOr });

            vi.mocked(supabase.from).mockReturnValue({ select: mockCheckSelect } as any);

            const result = await createConversation(user1Id, user2Id);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            expect(result.data?.id).toBe(existingConversation.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: backend-services, Property 19: Message Creation Stores Sender and Body
   * Validates: Requirements 4.2
   * 
   * For any valid message with conversationId, senderId, and body, the created
   * message should contain all provided data.
   */
  describe('Property 19: Message Creation Stores Sender and Body', () => {
    it('for any valid message, created message contains sender and body', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationIdArbitrary,
          userIdArbitrary, // senderId (participant_1)
          userIdArbitrary, // other participant
          messageBodyArbitrary,
          fc.option(attachmentsArbitrary, { nil: undefined }),
          async (conversationId, senderId, otherUserId, body, attachments) => {
            vi.mocked(supabase.from).mockReset();

            const mockConversation = createMockConversation(
              conversationId,
              senderId,
              otherUserId
            );
            const mockMessageId = fc.sample(fc.uuid(), 1)[0];
            const expectedMessage = createMockMessage(
              mockMessageId,
              conversationId,
              senderId,
              body,
              attachments
            );

            // Mock conversation lookup
            const mockConvSingle = vi.fn().mockResolvedValue({
              data: mockConversation,
              error: null,
            });
            const mockConvEq = vi.fn().mockReturnValue({ single: mockConvSingle });
            const mockConvSelect = vi.fn().mockReturnValue({ eq: mockConvEq });

            // Mock message insert
            const mockMsgSingle = vi.fn().mockResolvedValue({
              data: expectedMessage,
              error: null,
            });
            const mockMsgSelect = vi.fn().mockReturnValue({ single: mockMsgSingle });
            const mockMsgInsert = vi.fn().mockReturnValue({ select: mockMsgSelect });

            // Mock conversation update
            const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation((table: string) => {
              callCount++;
              if (callCount === 1) {
                // First call: check conversation
                return { select: mockConvSelect } as any;
              } else if (callCount === 2) {
                // Second call: insert message
                return { insert: mockMsgInsert } as any;
              }
              // Third call: update conversation
              return { update: mockUpdate } as any;
            });

            const result = await sendMessage(conversationId, senderId, body, attachments);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Verify sender_id matches
              expect(result.data.sender_id).toBe(senderId);
              // Verify body matches
              expect(result.data.body).toBe(body);
              // Verify conversation_id matches
              expect(result.data.conversation_id).toBe(conversationId);
              // Verify attachments if provided
              if (attachments && attachments.length > 0) {
                expect(result.data.attachments).toEqual(attachments);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sendMessage rejects non-participant sender', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationIdArbitrary,
          userIdArbitrary, // participant_1
          userIdArbitrary, // participant_2
          userIdArbitrary, // non-participant sender
          messageBodyArbitrary,
          async (conversationId, participant1, participant2, nonParticipant, body) => {
            // Ensure nonParticipant is different from both participants
            fc.pre(nonParticipant !== participant1 && nonParticipant !== participant2);

            vi.mocked(supabase.from).mockReset();

            const mockConversation = createMockConversation(
              conversationId,
              participant1,
              participant2
            );

            const mockConvSingle = vi.fn().mockResolvedValue({
              data: mockConversation,
              error: null,
            });
            const mockConvEq = vi.fn().mockReturnValue({ single: mockConvSingle });
            const mockConvSelect = vi.fn().mockReturnValue({ eq: mockConvEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockConvSelect } as any);

            const result = await sendMessage(conversationId, nonParticipant, body);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(CHAT_ERROR_CODES.INVALID_PARTICIPANT);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 20: Conversation Query Returns User's Conversations
   * Validates: Requirements 4.3
   * 
   * For any user ID, getConversations should return only conversations where
   * the user is participant_1 or participant_2.
   */
  describe('Property 20: Conversation Query Returns User\'s Conversations', () => {
    it('for any user ID, getConversations returns only conversations where user is a participant', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.array(userIdArbitrary, { minLength: 1, maxLength: 10 }),
          async (userId, otherUserIds) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock conversations where userId is always a participant
            const mockConversations = otherUserIds.map((otherId) => {
              const isParticipant1 = Math.random() > 0.5;
              return createMockConversation(
                fc.sample(fc.uuid(), 1)[0],
                isParticipant1 ? userId : otherId,
                isParticipant1 ? otherId : userId
              );
            });

            const mockOrder = vi.fn().mockResolvedValue({
              data: mockConversations,
              error: null,
            });
            const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ or: mockOr });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            const result = await getConversations(userId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // All returned conversations should have userId as a participant
              for (const conversation of result.data) {
                const isParticipant = 
                  conversation.participant_1 === userId || 
                  conversation.participant_2 === userId;
                expect(isParticipant).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getConversations queries with correct user filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (userId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedOrFilter: string | null = null;

            const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
            const mockOr = vi.fn().mockImplementation((filter) => {
              capturedOrFilter = filter;
              return { order: mockOrder };
            });
            const mockSelect = vi.fn().mockReturnValue({ or: mockOr });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            await getConversations(userId);

            expect(capturedOrFilter).not.toBeNull();
            expect(capturedOrFilter).toContain(`participant_1.eq.${userId}`);
            expect(capturedOrFilter).toContain(`participant_2.eq.${userId}`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: backend-services, Property 21: Message Pagination Works Correctly
   * Validates: Requirements 4.4
   * 
   * For any conversation with N messages and a limit L, getMessages should return
   * at most L messages and provide a valid cursor for the next page.
   */
  describe('Property 21: Message Pagination Works Correctly', () => {
    it('for any limit, getMessages returns at most limit messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationIdArbitrary,
          userIdArbitrary,
          fc.integer({ min: 1, max: 100 }), // limit
          fc.integer({ min: 0, max: 50 }), // number of messages to generate
          async (conversationId, senderId, limit, messageCount) => {
            vi.mocked(supabase.from).mockReset();

            // Generate mock messages
            const mockMessages: Message[] = [];
            for (let i = 0; i < Math.min(messageCount, limit + 1); i++) {
              mockMessages.push(createMockMessage(
                fc.sample(fc.uuid(), 1)[0],
                conversationId,
                senderId,
                `Message ${i}`,
                undefined,
                undefined
              ));
            }

            const mockLimit = vi.fn().mockResolvedValue({
              data: mockMessages,
              error: null,
            });
            const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            const result = await getMessages(conversationId, limit);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Should return at most 'limit' messages
              expect(result.data.messages.length).toBeLessThanOrEqual(limit);
              
              // hasMore should be true if we got more than limit messages from DB
              if (mockMessages.length > limit) {
                expect(result.data.hasMore).toBe(true);
                expect(result.data.nextCursor).not.toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getMessages with cursor filters by created_at', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationIdArbitrary,
          validDateArbitrary, // cursor
          async (conversationId, cursor) => {
            vi.mocked(supabase.from).mockReset();

            let capturedLtField: string | null = null;
            let capturedLtValue: string | null = null;

            // The query chain is: select -> eq -> order -> limit -> lt (when cursor provided)
            // The lt method is called on the result of limit when cursor is provided
            const mockLtResult = vi.fn().mockResolvedValue({ data: [], error: null });
            const mockLt = vi.fn().mockImplementation((field, value) => {
              capturedLtField = field;
              capturedLtValue = value;
              return mockLtResult();
            });
            // limit returns an object with lt method (for cursor-based pagination)
            const mockLimit = vi.fn().mockReturnValue({ 
              lt: mockLt,
              then: (resolve: any) => resolve({ data: [], error: null })
            });
            const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            await getMessages(conversationId, 50, cursor);

            expect(capturedLtField).toBe('created_at');
            expect(capturedLtValue).toBe(cursor);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 22: Mark as Read Updates Timestamp
   * Validates: Requirements 4.5
   * 
   * For any unread messages in a conversation, after markAsRead, all messages
   * from the other participant should have a non-null read_at timestamp.
   */
  describe('Property 22: Mark as Read Updates Timestamp', () => {
    it('markAsRead updates messages from other participant', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationIdArbitrary,
          userIdArbitrary, // userId marking as read
          async (conversationId, userId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedUpdateData: any = null;
            let capturedNeqField: string | null = null;
            let capturedNeqValue: string | null = null;

            const mockIs = vi.fn().mockResolvedValue({ data: null, error: null });
            const mockNeq = vi.fn().mockImplementation((field, value) => {
              capturedNeqField = field;
              capturedNeqValue = value;
              return { is: mockIs };
            });
            const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
            const mockUpdate = vi.fn().mockImplementation((data) => {
              capturedUpdateData = data;
              return { eq: mockEq };
            });

            vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

            const result = await markAsRead(conversationId, userId);

            expect(result.error).toBeNull();

            // Verify update was called with read_at timestamp
            expect(capturedUpdateData).not.toBeNull();
            expect(capturedUpdateData.read_at).toBeDefined();
            expect(typeof capturedUpdateData.read_at).toBe('string');

            // Verify we're filtering out messages from the current user
            expect(capturedNeqField).toBe('sender_id');
            expect(capturedNeqValue).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('markAsRead only updates messages where read_at is null', async () => {
      await fc.assert(
        fc.asyncProperty(
          conversationIdArbitrary,
          userIdArbitrary,
          async (conversationId, userId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedIsField: string | null = null;
            let capturedIsValue: any = null;

            const mockIs = vi.fn().mockImplementation((field, value) => {
              capturedIsField = field;
              capturedIsValue = value;
              return Promise.resolve({ data: null, error: null });
            });
            const mockNeq = vi.fn().mockReturnValue({ is: mockIs });
            const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

            await markAsRead(conversationId, userId);

            // Verify we're filtering for read_at is null
            expect(capturedIsField).toBe('read_at');
            expect(capturedIsValue).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: backend-services, Property 23: Unread Count Matches Actual Unread
   * Validates: Requirements 4.6
   * 
   * For any user with messages, getUnreadCount should return the exact count
   * of messages where sender_id != userId and read_at is null.
   */
  describe('Property 23: Unread Count Matches Actual Unread', () => {
    it('getUnreadCount returns count of unread messages from others', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.integer({ min: 0, max: 100 }), // expected unread count
          fc.array(conversationIdArbitrary, { minLength: 1, maxLength: 5 }),
          async (userId, expectedCount, conversationIds) => {
            vi.mocked(supabase.from).mockReset();

            // Mock conversations query
            const mockConversations = conversationIds.map(id => ({ id }));
            const mockConvOr = vi.fn().mockResolvedValue({
              data: mockConversations,
              error: null,
            });
            const mockConvSelect = vi.fn().mockReturnValue({ or: mockConvOr });

            // Mock messages count query
            const mockIs = vi.fn().mockResolvedValue({
              count: expectedCount,
              error: null,
            });
            const mockNeq = vi.fn().mockReturnValue({ is: mockIs });
            const mockIn = vi.fn().mockReturnValue({ neq: mockNeq });
            const mockMsgSelect = vi.fn().mockReturnValue({ in: mockIn });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockConvSelect } as any;
              }
              return { select: mockMsgSelect } as any;
            });

            const result = await getUnreadCount(userId);

            expect(result.error).toBeNull();
            expect(result.data).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getUnreadCount returns 0 when user has no conversations', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (userId) => {
            vi.mocked(supabase.from).mockReset();

            // Mock empty conversations
            const mockConvOr = vi.fn().mockResolvedValue({
              data: [],
              error: null,
            });
            const mockConvSelect = vi.fn().mockReturnValue({ or: mockConvOr });

            vi.mocked(supabase.from).mockReturnValue({ select: mockConvSelect } as any);

            const result = await getUnreadCount(userId);

            expect(result.error).toBeNull();
            expect(result.data).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getUnreadCount filters by sender_id != userId', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.array(conversationIdArbitrary, { minLength: 1, maxLength: 3 }),
          async (userId, conversationIds) => {
            vi.mocked(supabase.from).mockReset();

            let capturedNeqField: string | null = null;
            let capturedNeqValue: string | null = null;

            const mockConversations = conversationIds.map(id => ({ id }));
            const mockConvOr = vi.fn().mockResolvedValue({
              data: mockConversations,
              error: null,
            });
            const mockConvSelect = vi.fn().mockReturnValue({ or: mockConvOr });

            const mockIs = vi.fn().mockResolvedValue({ count: 0, error: null });
            const mockNeq = vi.fn().mockImplementation((field, value) => {
              capturedNeqField = field;
              capturedNeqValue = value;
              return { is: mockIs };
            });
            const mockIn = vi.fn().mockReturnValue({ neq: mockNeq });
            const mockMsgSelect = vi.fn().mockReturnValue({ in: mockIn });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockConvSelect } as any;
              }
              return { select: mockMsgSelect } as any;
            });

            await getUnreadCount(userId);

            expect(capturedNeqField).toBe('sender_id');
            expect(capturedNeqValue).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
