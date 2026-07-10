# Send Push Notification Edge Function

Server-side FCM delivery for Forge. **Do not** expose the Firebase server key via `VITE_FCM_SERVER_KEY` in production — it is bundled into the browser.

## Deploy

```bash
cd supabase
supabase secrets set FCM_SERVER_KEY=your_firebase_server_key
supabase functions deploy send-push-notification
```

## Usage

Authenticated callers (service role or user JWT) POST:

```json
{
  "userId": "uuid",
  "title": "New booking",
  "body": "You have a new booking request",
  "data": { "bookingId": "uuid" }
}
```

## Client migration

Replace direct `notificationService.sendPushNotification()` FCM calls with an invoke to this function once deployed. In-app notifications (`createInAppNotification`) remain client-safe.
