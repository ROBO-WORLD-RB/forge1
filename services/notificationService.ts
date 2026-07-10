/**
 * Notification Service
 * Manages in-app notifications and push notifications for the BlueCollar marketplace
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { supabase } from './supabase';
import type {
  Notification,
  NotificationInsert,
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
 * FCM configuration — DEV / STUB ONLY.
 *
 * SECURITY WARNING: `VITE_FCM_SERVER_KEY` is bundled into the browser at build time.
 * Anyone can extract it from `dist/` and send push notifications on your behalf.
 * Do NOT set this variable in production. Use the `send-push-notification` Edge
 * Function with `FCM_SERVER_KEY` stored as a Supabase secret instead.
 *
 * @see supabase/functions/send-push-notification/
 */
const FCM_SERVER_KEY = import.meta.env.VITE_FCM_SERVER_KEY || '';
const FCM_API_URL = 'https://fcm.googleapis.com/fcm/send';

if (import.meta.env.DEV && FCM_SERVER_KEY) {
  console.warn(
    '[notificationService] VITE_FCM_SERVER_KEY is set — this exposes your FCM server key in the client bundle. ' +
      'Use supabase/functions/send-push-notification for production push delivery.',
  );
}

/**
 * Create an in-app notification
 * Stores the notification with type, title, body, and metadata
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
    const insertData: NotificationInsert = {
      user_id: userId,
      type,
      title,
      body,
      metadata: metadata ?? null,
    };

    const { data, error } = await (supabase
      .from('notifications') as any)
      .insert(insertData)
      .select()
      .single();

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
 * Send a push notification via FCM.
 *
 * SECURITY: This function uses `VITE_FCM_SERVER_KEY` client-side — suitable for local
 * dev only. In production, invoke `supabase/functions/send-push-notification` instead
 * so the Firebase server key never leaves the server.
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
    // Get user's device tokens
    const { data: tokens, error: tokenError } = await (supabase
      .from('device_tokens') as any)
      .select('token')
      .eq('user_id', userId);

    if (tokenError) {
      captureError(new Error(tokenError.message), { tags: { operation: 'sendPushNotification.getTokens' } });
      return {
        data: null,
        error: handleDatabaseError(tokenError),
      };
    }

    if (!tokens || tokens.length === 0) {
      // No device tokens registered, but not an error
      return {
        data: undefined,
        error: null,
      };
    }

    // Send to all registered devices
    const deviceTokens = tokens.map((t: { token: string }) => t.token);

    // If FCM is not configured, skip sending but don't error.
    // In production, route push through send-push-notification Edge Function instead.
    if (!FCM_SERVER_KEY) {
      console.warn(
        'FCM server key not configured, skipping push notification. ' +
          'Set FCM_SERVER_KEY on the send-push-notification Edge Function for production.',
      );
      return {
        data: undefined,
        error: null,
      };
    }

    // Send FCM notification
    const fcmPayload = {
      registration_ids: deviceTokens,
      notification: {
        title,
        body,
      },
      data: data || {},
    };

    const response = await fetch(FCM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify(fcmPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      captureError(new Error(`FCM send failed: ${errorText}`), { 
        tags: { operation: 'sendPushNotification.fcm' } 
      });
      return {
        data: null,
        error: {
          code: NOTIFICATION_ERROR_CODES.FCM_SEND_FAILED as any,
          message: 'Failed to send push notification',
        },
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
