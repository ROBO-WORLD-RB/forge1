# Forge — Launch Checklist (User Action Required)

> **Who this is for:** The founder or operator deploying Forge to beta or production.  
> **What Forge is:** A React + Vite SPA backed by Supabase (no custom backend server in this repo).  
> **You cannot skip the P0 items** — the app will not work correctly without them.

**Related docs:** [`PROJECT-EXPLORATION-REFERENCE.md`](./PROJECT-EXPLORATION-REFERENCE.md) · [`docs/CRON.md`](./docs/CRON.md) · [`supabase/functions/paystack-webhook/README.md`](./supabase/functions/paystack-webhook/README.md)

---

## Supabase setup — Vite, not Next.js

Forge is a **React 19 + Vite SPA**. The Supabase dashboard’s **Next.js quickstart does not apply** to this repo.

| Do **not** add | Do **this** instead |
|----------------|---------------------|
| `@supabase/ssr` | `@supabase/supabase-js` (already in `package.json`) |
| `middleware.ts`, server components, `createServerClient` | Client-only client in [`services/supabase.ts`](./services/supabase.ts) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` |

Copy [`.env.local.example`](./.env.local.example) → `.env.local` and set the two `VITE_SUPABASE_*` vars. They are baked in at **build time** — set them before `npm run build` or in your static host’s env vars.

For the client key, use either the **publishable key** (`sb_publishable_...`) or the legacy **anon JWT** from Settings → API — both work with `@supabase/supabase-js` v2.84+.

---

## Quick priority legend

| Priority | Meaning |
|----------|---------|
| **P0** | Blocker — app broken or unsafe without this |
| **P1** | Important for production quality |
| **P2** | Optional / can wait until after beta |

---

## P0 — Supabase (database, storage, realtime)

### Create Supabase project

- [ ] **P0** Create a project at [supabase.com](https://supabase.com)
- [ ] **P0** Note your **Project URL** and **anon (public) key** (Settings → API)

> **YOU MUST DO THIS:** Without a Supabase project, auth, database, chat, payments, and file uploads all fail.

---

### Run database schema

Choose **one** path:

**Option A — Full schema (fresh project, simplest)**

- [ ] **P0** Open **SQL Editor** in Supabase Dashboard
- [ ] **P0** Paste and run the entire [`supabase-schema.sql`](./supabase-schema.sql) file

**Option B — Migrations in order (if you use Supabase CLI)**

- [ ] **P0** Link the project: `supabase link --project-ref <your-project-ref>`
- [ ] **P0** Run migrations **in this order:**
  1. [`supabase/migrations/001_storage_and_rls_fixes.sql`](./supabase/migrations/001_storage_and_rls_fixes.sql) — storage buckets + RLS fixes
  2. [`supabase/migrations/add_worker_location.sql`](./supabase/migrations/add_worker_location.sql) — worker geolocation columns
  3. [`supabase/migrations/002_security_hardening.sql`](./supabase/migrations/002_security_hardening.sql) — signup/admin role hardening + profile RLS
  4. [`supabase/migrations/003_signup_profile_and_jobs_fixes.sql`](./supabase/migrations/003_signup_profile_and_jobs_fixes.sql) — signup trigger (phone) + jobs RLS
  5. [`supabase/migrations/004_fix_username_generation.sql`](./supabase/migrations/004_fix_username_generation.sql) — collision-proof usernames (`@user` + full UUID hex)
- [ ] **P0** If you used Option A (`supabase-schema.sql`) on a fresh DB, still run **001**, **add_worker_location**, **003**, and **004**. Security hardening from **002** is already included in current `supabase-schema.sql`; run **002** only if your DB was created from an older schema copy. **003** fixes empty-phone / jobs RLS; **004** fixes `profiles_username_key` / `@user000000000000` (run **004** even if **003** already applied or partially applied — do not re-run broken username logic from older copies of **003**).

> **YOU MUST DO THIS:** Skipping schema setup means sign-up, bookings, chat, and payments have no tables or policies.

---

### Enable Realtime on the `messages` table

Live chat uses `postgres_changes` on `public.messages` ([`services/chatService.ts`](./services/chatService.ts)). Without replication, messages only appear after a manual refresh.

- [ ] **P0** In Supabase Dashboard, go to **Database** → **Publications**
- [ ] **P0** Open the `supabase_realtime` publication
- [ ] **P0** Ensure **`messages`** is checked (enabled for replication)
- [ ] **P0** If `messages` is missing, add it to the publication and save

**Alternative path (older UI):** Database → **Replication** → enable replication for the `messages` table.

**Verify:** Open two browser sessions, send a message in one — it should appear in the other without refreshing.

> **YOU MUST DO THIS:** Realtime chat is a core feature; this step is easy to miss and has no code fix.

---

### Storage buckets (if migration fails)

Migration **001** creates these buckets automatically. If the SQL `INSERT INTO storage.buckets` fails, create them manually:

| Bucket | Public? | Used for |
|--------|---------|----------|
| `avatars` | Yes | Profile photos ([`ProfileEdit.tsx`](./pages/ProfileEdit.tsx)) |
| `job-media` | Yes | Job listing images ([`Jobs.tsx`](./pages/Jobs.tsx)) |
| `verification-documents` | No | KYC uploads ([`VerificationUpload.tsx`](./components/VerificationUpload.tsx)) |

- [ ] **P0** Dashboard → **Storage** → **New bucket** — create each bucket above with the correct public/private setting
- [ ] **P0** Re-run migration **001** for storage **policies**, or confirm policies exist under Storage → Policies

> **YOU MUST DO THIS:** Without buckets, avatar upload, job photos, and worker verification uploads fail.

---

### Supabase environment variables (frontend)

- [ ] **P0** Copy [`.env.local.example`](./.env.local.example) → `.env.local` (do **not** commit `.env.local`)
- [ ] **P0** Set in `.env.local`:
  - `VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<publishable key (sb_publishable_...) or legacy anon JWT>`

> **YOU MUST DO THIS:** The app cannot connect to your backend without these. They are baked in at **build time** — set them before `npm run build`.

---

## P0 — Paystack (payments & webhooks)

Forge uses Paystack for subscriptions, bookings, and worker onboarding fees. The **secret key must never** go in Vite env vars.

### Get API keys

- [ ] **P0** Sign up / log in at [Paystack](https://paystack.com)
- [ ] **P0** Dashboard → **Settings** → **API Keys & Webhooks**
- [ ] **P0** Start with **test keys** (`pk_test_…`, `sk_test_…`); switch to **live keys** only when going to real production

### Frontend (public key only)

- [ ] **P0** In `.env.local`, set:
  ```env
  VITE_PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
  ```

### Server-side secret (Supabase Edge Function)

- [ ] **P0** Install [Supabase CLI](https://supabase.com/docs/guides/cli) and log in
- [ ] **P0** Link project: `supabase link --project-ref <your-project-ref>`
- [ ] **P0** Set the secret (**no `VITE_` prefix**):
  ```bash
  supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
  ```

### Deploy webhook handler

- [ ] **P0** From repo root:
  ```bash
  cd supabase
  supabase functions deploy paystack-webhook --no-verify-jwt
  ```
- [ ] **P0** Note your webhook URL:
  ```
  https://<project-ref>.supabase.co/functions/v1/paystack-webhook
  ```

### Register webhook in Paystack

- [ ] **P0** Paystack Dashboard → **Settings** → **API Keys & Webhooks** → **Webhooks**
- [ ] **P0** Add URL: `https://<project-ref>.supabase.co/functions/v1/paystack-webhook`
- [ ] **P0** Save and send a test event; confirm the Edge Function logs show success

> **YOU MUST DO THIS:** Without the deployed webhook, successful Paystack charges will **not** update subscriptions, bookings, or worker onboarding status in your database. See [`supabase/functions/paystack-webhook/README.md`](./supabase/functions/paystack-webhook/README.md).

---

## P0 — Authentication

### Enable providers in Supabase

- [ ] **P0** Dashboard → **Authentication** → **Providers**
- [ ] **P0** **Email** — enable (email + password sign-up/login)
- [ ] **P0** **Phone** — enable (OTP login in [`Login.tsx`](./pages/auth/Login.tsx))
- [ ] **P0** **Google** — enable; add **Client ID** and **Client Secret** from [Google Cloud Console](https://console.cloud.google.com/)

### Site URL & redirect URLs

- [ ] **P0** Dashboard → **Authentication** → **URL Configuration**
- [ ] **P0** Set **Site URL** to your production domain (e.g. `https://forge.yourdomain.com`)
- [ ] **P0** Add **Redirect URLs** (all environments you use):
  - `http://localhost:3000/auth/callback` (local dev)
  - `https://forge-9ieq.onrender.com/auth/callback`
  - `http://localhost:3000/auth/reset-password` (password reset)
  - `https://forge-9ieq.onrender.com/auth/reset-password`

### Google OAuth redirect URI (Google Cloud Console)

- [ ] **P0** In Google Cloud → **APIs & Services** → **Credentials** → your OAuth client
- [ ] **P0** Add **Authorized redirect URI**:
  ```
  https://<your-project-ref>.supabase.co/auth/v1/callback
  ```
  (This is Supabase’s callback — **not** your app’s `/auth/callback`. Supabase forwards to your app after auth.)

The app’s OAuth return path is `/auth/callback` ([`App.tsx`](./App.tsx), [`AuthCallback.tsx`](./pages/auth/AuthCallback.tsx)).

> **YOU MUST DO THIS:** Misconfigured redirect URLs cause “redirect_uri_mismatch” or users stuck after Google sign-in.

---

### Create the first admin user

There is no self-serve admin sign-up. Promote a user manually:

- [ ] **P0** Sign up a normal account (email or Google)
- [ ] **P0** In Supabase **SQL Editor**, run (replace email):
  ```sql
  UPDATE profiles
  SET role = 'admin'
  WHERE id = (
    SELECT id FROM auth.users WHERE email = 'you@example.com'
  );
  ```
- [ ] **P0** Sign out and sign back in; confirm `/admin` loads ([`AdminDashboard.tsx`](./pages/admin/AdminDashboard.tsx))

> **YOU MUST DO THIS:** Without an admin, you cannot review verifications, moderate users, or use the admin dashboard.

---

## P0 — Scheduled jobs (subscription expiry)

The SPA **never** calls `handleSubscriptionExpiry()` on its own. Without a cron job, expired worker subscriptions stay “active” in the database.

### Deploy the Edge Function (recommended)

- [ ] **P0** Install [Supabase CLI](https://supabase.com/docs/guides/cli) and link your project (if not already):
  ```bash
  supabase link --project-ref <your-project-ref>
  ```
- [ ] **P0** Optional — set a lightweight cron secret for external schedulers (alternative to service role key):
  ```bash
  supabase secrets set SUBSCRIPTION_CRON_SECRET=your-random-secret-here
  ```
- [ ] **P0** Deploy the subscription expiry cron function:
  ```bash
  cd supabase
  supabase functions deploy subscription-expiry-cron
  ```
- [ ] **P0** Note your cron endpoint:
  ```
  https://<project-ref>.supabase.co/functions/v1/subscription-expiry-cron
  ```
- [ ] **P0** Schedule it in Supabase Dashboard → **Edge Functions** → `subscription-expiry-cron` → **Schedules** → create schedule with cron `0 2 * * *` (daily at 02:00 UTC)

See [`supabase/functions/subscription-expiry-cron/README.md`](./supabase/functions/subscription-expiry-cron/README.md) for manual trigger and external cron examples.

### Alternative scheduling options

- [ ] **P0** Or implement another option in [`docs/CRON.md`](./docs/CRON.md):
  - **Option A:** Supabase `pg_cron` (raw SQL in dashboard — no Edge Function needed)
  - **Option C:** External cron (Render Cron Job, GitHub Actions, etc.) POSTing to the endpoint above with `Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY`

- [ ] **P0** Verify: create a test subscription with `expires_at` in the past → trigger the function manually or wait for the schedule → confirm status becomes `expired` and worker `tier` downgrades to `free`

> **YOU MUST DO THIS:** Premium workers keep paid visibility forever if you skip this.

---

## P0 — Deploy frontend


### Live deployment (updated)

| Item | Value |
|------|-------|
| **Platform** | Render static site `forge` |
| **Live URL** | [https://forge-9ieq.onrender.com](https://forge-9ieq.onrender.com) |
| **Deploy status** | live |
| **Service ID** | `srv-d9bqtebbc2fs73asbb2g` |

**You still must** set Supabase **Site URL** to `https://forge-9ieq.onrender.com` and add redirect URLs:

- `https://forge-9ieq.onrender.com/auth/callback`
- `https://forge-9ieq.onrender.com/auth/reset-password`

Render env vars already set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_AI_PROVIDER`, `VITE_GEMINI_API_KEY`.

Forge builds to static files in `dist/`. There is no Node server in production unless you add one.

### Build locally (or in CI)

- [ ] **P0** Ensure `.env.local` has all required `VITE_*` vars (Supabase, Paystack public key at minimum)
- [ ] **P0** Run:
  ```bash
  npm install
  npm run build
  ```
- [ ] **P0** Confirm `dist/` was created

### Deploy `dist/` to a static host

**Render (recommended — Static Site):**

This repo includes [`render.yaml`](./render.yaml) for Blueprint deploy. It configures build, publish path, and SPA rewrites.

**Option A — Blueprint (from `render.yaml`):**

- [ ] **P0** Push the repo to GitHub, GitLab, or Bitbucket
- [ ] **P0** In [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → connect the repo
- [ ] **P0** **Before the first build**, open the static site service → **Environment** → add all `VITE_*` vars (same values as `.env.local`). Vite bakes them in at compile time — if you add them after the first deploy, trigger a **Manual Deploy**
- [ ] **P0** Minimum required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`
- [ ] **P0** Optional: `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (source maps on build)
- [ ] **P0** After deploy, update Supabase **Site URL** and **Redirect URLs** to your Render URL (e.g. `https://forge-9ieq.onrender.com/auth/callback`)

**Option B — Manual Static Site (no Blueprint):**

- [ ] **P0** Create a **Static Site** on [Render](https://render.com) and connect the repo
- [ ] **P0** Build command: `npm install && npm run build`
- [ ] **P0** Publish directory: `dist`
- [ ] **P0** Add `VITE_*` environment variables in the dashboard **before** the first build (same rule as Option A)
- [ ] **P0** Settings → **Redirects/Rewrites** → add rewrite: `/*` → `/index.html`

**Other hosts:** Netlify, Vercel, Cloudflare Pages, S3 + CloudFront — same pattern: build command + publish `dist/` + SPA fallback.

> **Note on `0.0.0.0`:** Forge’s **dev server** already binds `0.0.0.0` ([`vite.config.ts`](./vite.config.ts)). For **Render Static Sites**, you only deploy `dist/` — no port binding. If you instead run a **Render Web Service** (e.g. `vite preview`), you must listen on `0.0.0.0:$PORT` per [Render port binding](https://render.com/docs/web-services#port-binding). A static site is the normal choice for this app.

- [ ] **P0** After deploy, smoke-test: sign up, login, search workers, open messages, start a Paystack test payment

> **YOU MUST DO THIS:** Users cannot access the app until `dist/` is hosted with correct env vars and SPA fallback routing.

---

## P1 — Optional but recommended

### Error monitoring (Sentry)

- [ ] **P1** Create a project at [sentry.io](https://sentry.io)
- [ ] **P1** In `.env.local`:
  ```env
  VITE_SENTRY_DSN=https://...@sentry.io/...
  SENTRY_AUTH_TOKEN=...      # for source map upload on build
  SENTRY_ORG=your-org
  SENTRY_PROJECT=forge-web
  ```
- [ ] **P1** Rebuild and deploy; trigger a test error to confirm events arrive

### Phone OTP / SMS (production)

**Signup “Verify Your Phone”** uses the app’s custom [`services/smsService.ts`](./services/smsService.ts) (Twilio or Africa’s Talking), **not** Supabase Phone Auth. OTP is stored in the browser for that session; SMS delivery needs provider credentials at **Vite build time** on Render.

**Login “Sign in with OTP”** (separate) uses Supabase Phone auth — configure that in Supabase if you enable it.

- [ ] **P0** On Render → **forge** → **Environment**, add **either** Twilio **or** Africa’s Talking (names only below; values from their dashboards), then **Manual Deploy**:
  - Twilio: `VITE_TWILIO_ACCOUNT_SID` (must start with `AC`), `VITE_TWILIO_AUTH_TOKEN`, `VITE_TWILIO_PHONE_NUMBER`
  - Africa’s Talking: `VITE_AT_API_KEY`, `VITE_AT_USERNAME`
- [ ] **P0** Confirm signup verify: with vars set, SMS arrives and code is **not** shown on-screen; without vars, amber banner shows code (“SMS not configured — use this code”)
- [ ] **P1** Prefer moving SMS secrets to a **Supabase Edge Function** before hard launch — `VITE_*` keys are exposed in the client bundle
- [ ] **P1** (Optional) Supabase Dashboard → **Authentication** → **Providers** → **Phone** — only if you use Login OTP via Supabase

### Seed reference data (optional)

- [ ] **P1** Run [`supabase/seed-categories.sql`](./supabase/seed-categories.sql) for service categories
- [ ] **P2** Run [`supabase/seed-mock-data.sql`](./supabase/seed-mock-data.sql) only for **dev/demo** — not production

---

## P2 — Optional features

### AI chat (Gemini or local Ollama)

- [ ] **P2** For cloud AI, in `.env.local`:
  ```env
  VITE_AI_PROVIDER=gemini
  VITE_GEMINI_API_KEY=your_key_from_google_ai_studio
  ```
- [ ] **P2** For local dev only: `VITE_AI_PROVIDER=ollama` + run `ollama serve` (see `.env.local.example`)

### Push notifications (FCM)

- [ ] **P2** Set up Firebase Cloud Messaging
- [ ] **P2** **Do not rely on `VITE_FCM_SERVER_KEY` in production** — it exposes your server key in the browser bundle ([`notificationService.ts`](./services/notificationService.ts)). For production, deploy the push Edge Function:
  ```bash
  cd supabase
  supabase secrets set FCM_SERVER_KEY=your_firebase_server_key
  supabase functions deploy send-push-notification
  ```
  See [`supabase/functions/send-push-notification/README.md`](./supabase/functions/send-push-notification/README.md).

---

## Security reminders (read before go-live)

- [ ] **P0** **Never commit `.env.local`** or any file containing secrets. It should stay in `.gitignore`.
- [ ] **P0** **Never set `VITE_PAYSTACK_SECRET_KEY`** — use `supabase secrets set PAYSTACK_SECRET_KEY=...` only.
- [ ] **P0** After running migrations, **review Row Level Security (RLS)** in Supabase Dashboard → **Authentication** → **Policies** (or Table Editor → RLS). Migration **001** adds policies for storage, `worker_payments`, and `service_categories` — confirm they are active.
- [ ] **P1** Use Paystack **test keys** until you have completed end-to-end payment and webhook testing.
- [ ] **P1** Rotate any key that was ever committed to git or shared in chat.

---

## Pre-launch smoke test (15 minutes)

- [ ] Sign up with email
- [ ] Sign in with Google (if enabled)
- [ ] Sign in with phone OTP (if SMS configured)
- [ ] Upload avatar → appears on profile
- [ ] Post a job with image → image loads
- [ ] Open Messages → send message → **other user sees it live** (Realtime)
- [ ] Complete a **test** Paystack payment → webhook updates DB (check `transactions` / `subscriptions` tables)
- [ ] Log in as admin → open `/admin`
- [ ] Confirm expired subscription cron (or manual SQL) downgrades worker tier

---

## File reference (what you touch)

| Task | File / location |
|------|-----------------|
| Full DB schema | `supabase-schema.sql` |
| Migrations | `supabase/migrations/001_storage_and_rls_fixes.sql`, `add_worker_location.sql`, `002_security_hardening.sql`, `003_signup_profile_and_jobs_fixes.sql`, `004_fix_username_generation.sql` |
| Env template | `.env.local.example` |
| Paystack webhook deploy | `supabase/functions/paystack-webhook/` |
| Subscription expiry cron | `supabase/functions/subscription-expiry-cron/` |
| Push notifications (server) | `supabase/functions/send-push-notification/` |
| Subscription cron docs | `docs/CRON.md` |
| Build output | `dist/` after `npm run build` |
| Render Blueprint | `render.yaml` |

---

*Last verified against codebase: 2026-07-03.*
