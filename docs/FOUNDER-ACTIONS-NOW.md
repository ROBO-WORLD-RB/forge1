# Founder actions — needs your hands

Code-side polish from the system check is in the repo. Everything below needs **your** Supabase / Render / Paystack access. Do them in order.

Direct SQL editor for this project:  
https://supabase.com/dashboard/project/siutunqbdteyrycrbzub/sql/new

---

## 1. CRITICAL — Lock down profiles (do first)

1. Open the SQL Editor link above.
2. Paste the **entire** file: [`supabase/migrations/021_lock_down_profiles_rls.sql`](../supabase/migrations/021_lock_down_profiles_rls.sql)
3. Run it.
4. Verify in browser console (or API):  
   `GET /rest/v1/profiles?select=*` with the anon key should **not** return every customer/worker row. Active public workers only.

Details: [`docs/SECURITY-PROFILES-RLS.md`](./SECURITY-PROFILES-RLS.md)

---

## 2. Confirm money / marketplace SQL is live

In SQL Editor, run any of these that are **not yet applied** (safe to skip if already run — most are idempotent):

| # | File | Unlocks |
|---|------|---------|
| 12 | `012_worker_profiles_privilege_guard.sql` | Block self-set tier/verified |
| 13 | `013_verification_kyc_and_admin.sql` | KYC + admin |
| 14 | `014_subscriptions_webhook_activation.sql` | Subscriptions pending-only |
| 15 | `015_notifications_secure_insert.sql` | Secure notify RPC |
| 16 | `016_favorites.sql` | Saved workers |
| 17 | `017_job_applications.sql` | Job applications |
| 18 | `018_wallet_escrow_foundations.sql` | Wallet + escrow |
| 19 | `019_analytics_disputes.sql` | Analytics + disputes |

If you are unsure what already ran, start at **012** and continue through **019**, then confirm **021** (step 1).

---

## 3. Edge Functions + secrets

From a machine with [Supabase CLI](https://supabase.com/docs/guides/cli) logged in and linked to this project:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_or_test_...
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...

supabase functions deploy paystack-webhook --no-verify-jwt
supabase functions deploy subscription-expiry-cron
supabase functions deploy ai-chat
```

Then in **Paystack Dashboard → Settings → Webhooks**, set the webhook URL to your deployed `paystack-webhook` function URL.

Schedule expiry cron (pick one):

- Supabase Dashboard → Edge Functions → `subscription-expiry-cron` → Cron, or  
- Follow [`docs/CRON.md`](./CRON.md) (e.g. `0 2 * * *`)

---

## 4. Realtime chat

Supabase → **Database** → **Publications** → `supabase_realtime` → enable **`messages`**.

---

## 5. Auth URLs + admin user

**Authentication → URL Configuration**

- Site URL: `https://forge-9ieq.onrender.com`
- Redirect URLs:
  - `https://forge-9ieq.onrender.com/auth/callback`
  - `https://forge-9ieq.onrender.com/auth/reset-password`

**Authentication → Providers → Email**

- Confirm email: **OFF** (beta)

**Promote yourself to admin** (replace email):

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'YOUR_EMAIL@example.com';
```

Then open `/admin` and smoke-test KYC.

---

## 6. Render env cleanup

Dashboard: https://dashboard.render.com/static/srv-d9bqtebbc2fs73asbb2g

1. **Keep:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`
2. **Delete** if present: `VITE_OPENROUTER_API_KEY`, `VITE_GEMINI_API_KEY` (after `ai-chat` secret is set)
3. **Manual Deploy** so the next build does not bake old keys into JS

---

## 7. Smoke test after the above

- [ ] Signup / login
- [ ] Search workers (customers not dumped publicly)
- [ ] Post job → worker apply → customer sees booking
- [ ] Chat messages appear live (two sessions)
- [ ] Paystack test payment (subscription or booking escrow)
- [ ] `/admin` KYC approve
- [ ] Wallet page loads (withdraw still “coming soon” — expected)

---

## Not ready yet (do not market as live)

| Feature | Status |
|---------|--------|
| Bank withdrawals | Stub — “coming soon” |
| Automated card refunds | Manual via Paystack |
| Phone OTP | Deferred |
| Push (FCM) | Needs FCM + client tokens |
| Togo | Not in app yet — GH/NG only |

---

## Already handled in code (no action from you)

- Home CTA “Find Workers” + mobile sidebar padding
- PWA silent auto-update (no update popup)
- ForgeReel composition + audio
- Closing beat centered credit
- Job-apply booking sync warning surfaced in UI
- Docs aligned: GH/NG (not Togo), migration list includes 012–021
