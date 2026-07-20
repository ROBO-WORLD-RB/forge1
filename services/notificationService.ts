/**
 * Notification Service
 * Manages in-app notifications and push notifications for the BlueCollar marketplace
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { supabase } from './supabase';
import type {
  Notification,
  NotificationUpdate,
  NotificationType,
  DeviceToken,
  DeviceTokenInsert,
} from '../types/database';
import { handleDatabaseError, DatabaseError, ERROR_CODES } from './databaseErrors';
import { startTransaction, captureError } from './monitoringService';

/**
 * Extended error codes for notification operations
 */
export const NOTIFICATION_ERROR_CODES = {
  NOTIFICATION_NOT_FOUND: 'NOTIF_001',
  DEVICE_TOKEN_NOT_FOUND: 'NOTIF_002',
  FCM_SEND_FAILED: 'NOTIF_003',
  INVALID_NOTIFICATION_TYPE: 'NOTIF_004',
} as const;

/**
 * Result type for notification service operations
 */
export interface NotificationServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * Create an in-app notification via SECURITY DEFINER RPC (migration 015).
 * Direct INSERT on `notifications` is not allowed for clients (anti-spam).
 * Requirements: 6.2
 */
export async function createInAppNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: Record<string, unknown>
): Promise<NotificationServiceResult<Notification>> {
  const transaction = startTransaction('notification.createInAppNotification', 'db');

  try {
    const { data, error } = await (supabase as any).rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: body,
      p_metadata: metadata ?? null,
    });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'createInAppNotification' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Notification,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}


/**
 * Get notifications for a user
 * Returns notifications with optional filter for unread only
 * Requirements: 6.3
 */
/** Lightweight count query for nav badges (avoids fetching full notification rows). */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { count, error } = await (supabase
      .from('notifications') as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getUnreadNotificationCount' } });
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    captureError(error as Error, { tags: { operation: 'getUnreadNotificationCount' } });
    return 0;
  }
}

export async function getNotifications(
  userId: string,
  unreadOnly?: boolean
): Promise<NotificationServiceResult<Notification[]>> {
  const transaction = startTransaction('notification.getNotifications', 'db');

  try {
    let query = (supabase
      .from('notifications') as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getNotifications' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: (data || []) as Notification[],
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Mark a notification as read
 * Updates the read_at timestamp
 * Requirements: 6.4
 */
export async function markNotificationRead(
  notificationId: string
): Promise<NotificationServiceResult<Notification>> {
  const transaction = startTransaction('notification.markNotificationRead', 'db');

  try {
    const updateData: NotificationUpdate = {
      read_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase
      .from('notifications') as any)
      .update(updateData)
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'markNotificationRead' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Notification,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get a single notification by ID
 */
export async function getNotification(
  notificationId: string
): Promise<NotificationServiceResult<Notification>> {
  const { data, error } = await (supabase
    .from('notifications') as any)
    .select('*')
    .eq('id', notificationId)
    .single();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data as Notification,
    error: null,
  };
}

/**
 * Send a push notification via the authenticated `send-push-notification` Edge Function.
 *
 * SECURITY: Never uses VITE_FCM_SERVER_KEY (removed from client paths). FCM_SERVER_KEY
 * must live only as a Supabase Function secret.
 *
 * Requirements: 6.1
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<NotificationServiceResult<void>> {
  const transaction = startTransaction('notification.sendPushNotification', 'fcm');

  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      'send-push-notification',
      {
        body: { userId, title, body, data: data || {} },
      }
    );

    if (fnError) {
      captureError(new Error(fnError.message), {
        tags: { operation: 'sendPushNotification.edge' },
      });
      return {
        data: null,
        error: {
          code: NOTIFICATION_ERROR_CODES.FCM_SEND_FAILED as any,
          message: fnError.message || 'Failed to send push notification',
        },
      };
    }

    // 501 = FCM not configured on Edge — soft-skip (in-app notifications still work)
    if (fnData && typeof fnData === 'object' && (fnData as { error?: string }).error === 'FCM not configured') {
      console.warn(
        'FCM not configured on send-push-notification Edge Function. ' +
          'Set FCM_SERVER_KEY via supabase secrets; in-app notifications remain primary.',
      );
      return { data: undefined, error: null };
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
 * Register a device token for push notifications
 * Stores the token with platform information
 * Requirements: 6.5
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web'
): Promise<NotificationServiceResult<DeviceToken>> {
  const transaction = startTransaction('notification.registerDeviceToken', 'db');

  try {
    // Check if token already exists
    const { data: existingToken, error: checkError } = await (supabase
      .from('device_tokens') as any)
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (checkError) {
      captureError(new Error(checkError.message), { tags: { operation: 'registerDeviceToken.check' } });
      return {
        data: null,
        error: handleDatabaseError(checkError),
      };
    }

    // If token exists, update user_id if different
    if (existingToken) {
      if (existingToken.user_id !== userId) {
        const { data, error } = await (supabase
          .from('device_tokens') as any)
          .update({ user_id: userId })
          .eq('id', existingToken.id)
          .select()
          .single();

        if (error) {
          captureError(new Error(error.message), { tags: { operation: 'registerDeviceToken.update' } });
          return {
            data: null,
            error: handleDatabaseError(error),
          };
        }

        return {
          data: data as DeviceToken,
          error: null,
        };
      }

      return {
        data: existingToken as DeviceToken,
        error: null,
      };
    }

    // Insert new token
    const insertData: DeviceTokenInsert = {
      user_id: userId,
      token,
      platform,
    };

    const { data, error } = await (supabase
      .from('device_tokens') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'registerDeviceToken' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as DeviceToken,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get device tokens for a user
 */
export async function getDeviceTokens(
  userId: string
): Promise<NotificationServiceResult<DeviceToken[]>> {
  const { data, error } = await (supabase
    .from('device_tokens') as any)
    .select('*')
    .eq('user_id', userId);

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: (data || []) as DeviceToken[],
    error: null,
  };
}

/**
 * Remove a device token
 */
export async function removeDeviceToken(
  token: string
): Promise<NotificationServiceResult<void>> {
  const { error } = await (supabase
    .from('device_tokens') as any)
    .delete()
    .eq('token', token);

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: undefined,
    error: null,
  };
}

/**
 * Notification Service interface
 */
export interface NotificationService {
  createInAppNotification(userId: string, type: NotificationType, title: string, body: string, metadata?: Record<string, unknown>): Promise<NotificationServiceResult<Notification>>;
  getNotifications(userId: string, unreadOnly?: boolean): Promise<NotificationServiceResult<Notification[]>>;
  markNotificationRead(notificationId: string): Promise<NotificationServiceResult<Notification>>;
  getNotification(notificationId: string): Promise<NotificationServiceResult<Notification>>;
  sendPushNotification(userId: string, title: string, body: string, data?: Record<string, string>): Promise<NotificationServiceResult<void>>;
  registerDeviceToken(userId: string, token: string, platform: 'ios' | 'android' | 'web'): Promise<NotificationServiceResult<DeviceToken>>;
  getDeviceTokens(userId: string): Promise<NotificationServiceResult<DeviceToken[]>>;
  removeDeviceToken(token: string): Promise<NotificationServiceResult<void>>;
}

// Export as a service object for compatibility with existing code patterns
export const notificationService: NotificationService = {
  createInAppNotification,
  getNotifications,
  markNotificationRead,
  getNotification,
  sendPushNotification,
  registerDeviceToken,
  getDeviceTokens,
  removeDeviceToken,
};

export default notificationService;
