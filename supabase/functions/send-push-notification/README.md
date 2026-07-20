# Send Push Notification Edge Function

Server-side FCM delivery for Forge. **Do not** expose the Firebase server key via `VITE_FCM_SERVER_KEY` — that pattern is removed from the SPA.

## Auth (required)

Unauthenticated calls are rejected (`401`). Accepted:

| Method | Who |
|--------|-----|
| `Authorization: Bearer <user JWT>` | User may target **own** `userId` only; admins may target any |
| `Authorization: Bearer <service_role>` | Trusted server / other Edge Functions |
| Header `x-cron-secret` or `x-push-secret` | Must match secret `PUSH_CRON_SECRET` or `CRON_SECRET` |

## Deploy

```bash
cd supabase
supabase secrets set FCM_SERVER_KEY=your_firebase_server_key
# optional for cron/service invokes:
# supabase secrets set PUSH_CRON_SECRET=long-random-string
supabase functions deploy send-push-notification
```

## Usage

```json
{
  "userId": "uuid",
  "title": "New booking",
  "body": "You have a new booking request",
  "data": { "bookingId": "uuid" }
}
```

Client: `notificationService.sendPushNotification()` → `supabase.functions.invoke('send-push-notification', …)` with the session JWT.

In-app notifications (`createInAppNotification` → RPC `create_notification`) remain the primary channel until FCM is proven.
