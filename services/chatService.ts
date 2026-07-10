/**
 * Chat/Messaging Service
 * Manages conversations and messages for the BlueCollar marketplace
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Conversation,
  ConversationInsert,
  ConversationUpdate,
  Message,
  MessageInsert,
  MessageUpdate,
} from '../types/database';
import { handleDatabaseError, DatabaseError, ERROR_CODES } from './databaseErrors';
import { startTransaction, captureError } from './monitoringService';

/**
 * Extended error codes for chat operations
 */
export const CHAT_ERROR_CODES = {
  CONVERSATION_NOT_FOUND: 'CHAT_001',
  MESSAGE_NOT_FOUND: 'CHAT_002',
  INVALID_PARTICIPANT: 'CHAT_003',
  CONVERSATION_EXISTS: 'CHAT_004',
} as const;

/**
 * Result type for chat service operations
 */
export interface ChatServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * Paginated messages result
 */
export interface PaginatedMessages {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Create a new conversation between two users
 * Creates a conversation record linking both participants
 * Requirements: 4.1
 */
export async function createConversation(
  user1Id: string,
  user2Id: string,
  bookingId?: string
): Promise<ChatServiceResult<Conversation>> {
  const transaction = startTransaction('chat.createConversation', 'db');


  try {
    // Check if conversation already exists between these users
    const { data: existingConversation, error: checkError } = await (supabase
      .from('conversations') as any)
      .select('*')
      .or(`and(participant_1.eq.${user1Id},participant_2.eq.${user2Id}),and(participant_1.eq.${user2Id},participant_2.eq.${user1Id})`)
      .maybeSingle();

    if (checkError) {
      captureError(new Error(checkError.message), { tags: { operation: 'createConversation.check' } });
      return {
        data: null,
        error: handleDatabaseError(checkError),
      };
    }

    // Return existing conversation if found
    if (existingConversation) {
      return {
        data: existingConversation as Conversation,
        error: null,
      };
    }

    const insertData: ConversationInsert = {
      participant_1: user1Id,
      participant_2: user2Id,
      booking_id: bookingId ?? null,
    };

    const { data, error } = await (supabase
      .from('conversations') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'createConversation' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Conversation,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Send a message in a conversation
 * Creates a message record with sender, body, and optional attachments
 * Requirements: 4.2
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  attachments?: string[]
): Promise<ChatServiceResult<Message>> {
  const transaction = startTransaction('chat.sendMessage', 'db');

  try {
    // Verify conversation exists
    const { data: conversation, error: convError } = await (supabase
      .from('conversations') as any)
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return {
        data: null,
        error: {
          code: CHAT_ERROR_CODES.CONVERSATION_NOT_FOUND as any,
          message: 'Conversation not found',
        },
      };
    }

    // Verify sender is a participant
    if (conversation.participant_1 !== senderId && conversation.participant_2 !== senderId) {
      return {
        data: null,
        error: {
          code: CHAT_ERROR_CODES.INVALID_PARTICIPANT as any,
          message: 'Sender is not a participant in this conversation',
        },
      };
    }

    const insertData: MessageInsert = {
      conversation_id: conversationId,
      sender_id: senderId,
      body,
      attachments: attachments ?? null,
    };

    const { data, error } = await (supabase
      .from('messages') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'sendMessage' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    // Update conversation's last_message_at
    await (supabase
      .from('conversations') as any)
      .update({ last_message_at: new Date().toISOString() } as ConversationUpdate)
      .eq('id', conversationId);

    return {
      data: data as Message,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get all conversations for a user
 * Returns all conversations where the user is a participant
 * Requirements: 4.3
 */
export async function getConversations(
  userId: string
): Promise<ChatServiceResult<Conversation[]>> {
  const transaction = startTransaction('chat.getConversations', 'db');

  try {
    const { data, error } = await (supabase
      .from('conversations') as any)
      .select('*')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getConversations' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: (data || []) as Conversation[],
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get messages in a conversation with pagination
 * Returns messages with pagination support (limit and cursor)
 * Requirements: 4.4
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  cursor?: string
): Promise<ChatServiceResult<PaginatedMessages>> {
  const transaction = startTransaction('chat.getMessages', 'db');

  try {
    let query = (supabase
      .from('messages') as any)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more

    if (cursor) {
      // Cursor is the created_at timestamp of the last message
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getMessages' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    const messages = (data || []) as Message[];
    const hasMore = messages.length > limit;
    
    // Remove the extra message used for pagination check
    if (hasMore) {
      messages.pop();
    }

    const nextCursor = hasMore && messages.length > 0
      ? messages[messages.length - 1].created_at
      : null;

    return {
      data: {
        messages,
        nextCursor,
        hasMore,
      },
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Mark messages as read in a conversation
 * Updates the read_at timestamp for unread messages from the other participant
 * Requirements: 4.5
 */
export async function markAsRead(
  conversationId: string,
  userId: string
): Promise<ChatServiceResult<void>> {
  const transaction = startTransaction('chat.markAsRead', 'db');

  try {
    // Update all unread messages in this conversation that were NOT sent by this user
    const { error } = await (supabase
      .from('messages') as any)
      .update({ read_at: new Date().toISOString() } as MessageUpdate)
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('read_at', null);

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'markAsRead' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: undefined,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get unread message count for a user
 * Returns the total count of unread messages across all conversations
 * Requirements: 4.6
 */
export async function getUnreadCount(
  userId: string
): Promise<ChatServiceResult<number>> {
  const transaction = startTransaction('chat.getUnreadCount', 'db');

  try {
    // First get all conversations where user is a participant
    const { data: conversations, error: convError } = await (supabase
      .from('conversations') as any)
      .select('id')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

    if (convError) {
      captureError(new Error(convError.message), { tags: { operation: 'getUnreadCount.conversations' } });
      return {
        data: null,
        error: handleDatabaseError(convError),
      };
    }

    if (!conversations || conversations.length === 0) {
      return {
        data: 0,
        error: null,
      };
    }

    const conversationIds = conversations.map((c: { id: string }) => c.id);

    // Count unread messages where sender is not the user
    const { count, error } = await (supabase
      .from('messages') as any)
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .neq('sender_id', userId)
      .is('read_at', null);

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getUnreadCount' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: count ?? 0,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get or create a conversation between two users.
 * Returns an existing conversation when one already exists.
 */
export async function getOrCreateConversation(
  user1Id: string,
  user2Id: string,
  bookingId?: string
): Promise<ChatServiceResult<Conversation>> {
  return createConversation(user1Id, user2Id, bookingId);
}

/**
 * Subscribe to realtime INSERT events for messages in a conversation.
 * Returns an unsubscribe function — call it on unmount or conversation change.
 */
export function subscribeToMessages(
  conversationId: string,
  onInsert: (message: Message) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onInsert(payload.new as Message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(
  conversationId: string
): Promise<ChatServiceResult<Conversation>> {
  const { data, error } = await (supabase
    .from('conversations') as any)
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data as Conversation,
    error: null,
  };
}

/**
 * Get a single message by ID
 */
export async function getMessage(
  messageId: string
): Promise<ChatServiceResult<Message>> {
  const { data, error } = await (supabase
    .from('messages') as any)
    .select('*')
    .eq('id', messageId)
    .single();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data as Message,
    error: null,
  };
}

/**
 * Chat Service interface
 */
export interface ChatService {
  createConversation(user1Id: string, user2Id: string, bookingId?: string): Promise<ChatServiceResult<Conversation>>;
  getOrCreateConversation(user1Id: string, user2Id: string, bookingId?: string): Promise<ChatServiceResult<Conversation>>;
  sendMessage(conversationId: string, senderId: string, body: string, attachments?: string[]): Promise<ChatServiceResult<Message>>;
  getConversations(userId: string): Promise<ChatServiceResult<Conversation[]>>;
  getMessages(conversationId: string, limit?: number, cursor?: string): Promise<ChatServiceResult<PaginatedMessages>>;
  markAsRead(conversationId: string, userId: string): Promise<ChatServiceResult<void>>;
  getUnreadCount(userId: string): Promise<ChatServiceResult<number>>;
  getConversation(conversationId: string): Promise<ChatServiceResult<Conversation>>;
  getMessage(messageId: string): Promise<ChatServiceResult<Message>>;
  subscribeToMessages(conversationId: string, onInsert: (message: Message) => void): () => void;
}

// Export as a service object for compatibility with existing code patterns
export const chatService: ChatService = {
  createConversation,
  getOrCreateConversation,
  sendMessage,
  getConversations,
  getMessages,
  markAsRead,
  getUnreadCount,
  getConversation,
  getMessage,
  subscribeToMessages,
};

export default chatService;
