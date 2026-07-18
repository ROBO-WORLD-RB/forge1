# Forge — Start Here

You’re close. Your local config is wired up; the main thing left before the app actually works is **setting up your Supabase database**.

---

## You are here

| Status | Item |
|--------|------|
| ✅ Done | **`.env.local`** exists with Supabase project `siutunqbdteyrycrbzub`, Paystack test key, and Sentry |
| ✅ Done | **`npm install`** — `node_modules` is present |
| ✅ Done | App has been built before (`dist/` exists) |
| ✅ Done | Code fixes are in the repo |
| 👉 **Do this next** | **Database schema** - tables, RLS, and storage (run in Supabase Dashboard) |
| ⬜ Later | Enable Realtime on `messages`, Paystack webhook, first admin user |
| ⏳ Your action | **Production auth redirects** - add https://forge-9ieq.onrender.com/auth/callback and https://forge-9ieq.onrender.com/auth/reset-password in Supabase (see below) |
| ⬜ Optional | Supabase CLI (`supabase link`) — not required if you use the SQL Editor |

> **Bottom line:** Without the database schema, sign-up, worker search, chat, and payments have nothing to talk to. That’s your one blocker right now.

---

## Your next 3 steps

### Step 1 — Run the database schema (≈10 minutes) ← **do this first**

1. Open your project: [Supabase Dashboard](https://supabase.com/dashboard/project/siutunqbdteyrycrbzub)
2. Go to **SQL Editor** → **New query**
3. Run these files **one at a time, in this order** (open each file in this repo, copy all, paste, click **Run**):

   | Order | File |
   |-------|------|
   | 1 | `supabase-schema.sql` |
   | 2 | `supabase/migrations/001_storage_and_rls_fixes.sql` ← **storage buckets + upload RLS (avatars, job-media, verification)** |
   | 3 | `supabase/migrations/add_worker_location.sql` |
   | 4 | `supabase/migrations/002_security_hardening.sql` |
   | 5 | `supabase/migrations/003_signup_profile_and_jobs_fixes.sql` ← phone/username signup + jobs RLS |
   | 6 | `supabase/migrations/004_fix_username_generation.sql` ← **required if signup fails with `profiles_username_key` / `@user000000000000`** |
   | 7 | `supabase/migrations/005_chat_and_worker_apply_rls.sql` ← **workers message/apply to job posters; chat read receipts** |
   | 8 | `supabase/migrations/006_profile_public_read_rls.sql` ← public worker discovery |
   | 9 | `supabase/migrations/007_verification_documents_update_rls.sql` ← **KYC replace/re-upload (fixes hanging Replace)** |
   | 10 | `supabase/migrations/008_customers_only_create_jobs.sql` ← **only customers post projects; workers apply** |

4. *(Optional but helpful)* Run `supabase/seed-categories.sql` so service categories show up in search.

### Fix production signup / jobs (if already live)

If the app is already deployed and you see **"Unable to create your account"** / **"Database error saving new user"** on signup, or **posted jobs disappear** after leaving the Jobs page:

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/siutunqbdteyrycrbzub/sql/new)
2. If you have **not** run 003 yet: paste and **Run** [`supabase/migrations/003_signup_profile_and_jobs_fixes.sql`](./supabase/migrations/003_signup_profile_and_jobs_fixes.sql) (phone uniqueness + jobs RLS). If 003 already ran (even partially), skip to step 3.
3. Paste and **Run** the entire file: [`supabase/migrations/004_fix_username_generation.sql`](./supabase/migrations/004_fix_username_generation.sql) — replaces `handle_new_user()` with collision-proof usernames. **Do not re-run broken 003** to fix `@user000000000000`; run **004** instead.
4. Soft-refresh the production app and retry signup + post a job → leave Jobs → return → **My Posted Jobs** should still list it

**What 003 fixes:** empty `phone` collisions aborting signup, and jobs RLS so posters can SELECT their rows after INSERT.

**What 004 fixes:** username generation that truncated UUID hex to zeros (`@user000000000000`), causing `profiles_username_key` duplicate errors on the next signup.

### Fix worker → job poster messaging / apply (if already live)

If workers can message other workers but **cannot contact a job poster**, or job **Apply** fails with a permission/RLS error:

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/siutunqbdteyrycrbzub/sql/new)
2. Paste and **Run** the entire file: [`supabase/migrations/005_chat_and_worker_apply_rls.sql`](./supabase/migrations/005_chat_and_worker_apply_rls.sql)
3. Soft-refresh production, open a job as a worker → **Message poster** / **Apply**

**What 005 fixes:** workers may INSERT bookings as applicants; conversation participants may UPDATE `last_message_at` and message `read_at`. App UI also opens chat via `location.state.recipientId` using `jobs.poster_user_id`.

**If a storage bucket insert fails:** Dashboard → **Storage** → create `avatars` (public), `job-media` (public), and `verification-documents` (private), then re-run file **001** for the policies.

### Fix image upload hang / KYC replace / workers posting projects (if already live)

If **profile photo or verification upload spins forever**, **Replace** on KYC docs fails, or **workers can still post projects**:

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/siutunqbdteyrycrbzub/sql/new)
2. Confirm storage buckets exist (or re-run [`001_storage_and_rls_fixes.sql`](./supabase/migrations/001_storage_and_rls_fixes.sql))
3. Paste and **Run** [`007_verification_documents_update_rls.sql`](./supabase/migrations/007_verification_documents_update_rls.sql)
4. Paste and **Run** [`008_customers_only_create_jobs.sql`](./supabase/migrations/008_customers_only_create_jobs.sql)
5. Soft-refresh production → worker: upload photo on `/profile/edit` or onboarding → should finish or show an error (never hang). Customer: **Post a Project** → `/jobs?create=1` opens the create form.

**What 007 fixes:** workers can UPDATE their own `verification_documents` rows when replacing a file (RLS previously blocked Replace).

**What 008 fixes:** only `customer` / `admin` roles can INSERT into `jobs` (UI: “projects”). Workers browse/apply only.

### Relaunch: wipe users (force everyone to re-register)

**Irreversible.** Deletes all `auth.users` and related app data (bookings, jobs, messages, profiles, etc.). Keeps `service_categories`. Use only when you intentionally want a clean relaunch.

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/siutunqbdteyrycrbzub/sql/new)
2. Open [`supabase/migrations/011_wipe_all_users_for_relaunch.sql`](./supabase/migrations/011_wipe_all_users_for_relaunch.sql) in this repo → copy **all** → paste → **Run**
3. Confirm **Authentication → Users** is empty and the script’s `auth_users_after` / `profiles_after` are `0`
4. **(Optional)** Supabase → **Storage** → open each bucket (`avatars`, `job-media`, `verification-documents`) → delete all objects. The SQL script cannot clear storage (Supabase blocks direct `DELETE` on `storage.objects`); orphaned files are harmless but use space until you empty buckets.
5. On the live site (and local): **clear site data** or hard-refresh — old JWTs may return 401 until users sign up again
6. Have users **sign up** as new accounts (same email is fine once the old user row is gone)

> If an older copy of the wipe script failed with `Direct deletion from storage tables is not allowed`, **nothing was deleted** (the transaction rolled back). Pull the latest `011` from this repo and run it again.

> Supabase CLI is optional here; Dashboard SQL Editor is enough. Do not commit or paste secrets (`.env.local`, service role keys) when sharing this step.

---

### Step 2 — Turn on live chat + local auth URLs (≈5 minutes)

**Realtime (so messages appear without refresh):**

1. Dashboard → **Database** → **Publications**
2. Open `supabase_realtime`
3. Make sure **`messages`** is checked → **Save**

**Auth redirects (so login, OAuth, and password reset work on your machine):**

1. Dashboard → **Authentication** → **URL Configuration**
2. Set **Site URL** to `http://localhost:3000` (for now)
3. Add **Redirect URLs** (exact paths — Supabase matches these against `redirectTo`):
   - `http://localhost:3000/auth/callback` — Google OAuth return ([`AuthCallback.tsx`](./pages/auth/AuthCallback.tsx))
   - `http://localhost:3000/auth/reset-password` — password reset emails ([`ForgotPassword.tsx`](./pages/auth/ForgotPassword.tsx) sets `redirectTo` to this path)

4. Dashboard → **Authentication** → **Providers** → enable **Email** (minimum to test sign-up)

5. **Instant login after signup (recommended for beta):** Dashboard → **Authentication** → **Providers** → **Email** → turn **OFF** “Confirm email”.  
   - When **Confirm email** is **ON**, Supabase returns a user but **no session** after signup. The app shows a “Check your email” success screen (not the role picker); the user must confirm, then **Sign In**.  
   - When **Confirm email** is **OFF**, signup returns a session and the app navigates immediately: customers → dashboard, workers → `/auth/onboarding`.

**Google OAuth (required for “Continue with Google”):**

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → **Create OAuth client ID** (Web application)
2. **Authorized redirect URI** (Supabase’s callback — not your app URL):
   ```
   https://siutunqbdteyrycrbzub.supabase.co/auth/v1/callback
   ```
   Replace the project ref if you use a different Supabase project.
3. Copy **Client ID** and **Client Secret** into Supabase → **Authentication** → **Providers** → **Google** → enable and paste both fields → **Save**
4. Confirm **Redirect URLs** (step 3 above) include every origin you test from:
   - `http://localhost:3000/auth/callback` — desktop dev
   - `http://10.x.x.x:3000/auth/callback` — phone on same Wi‑Fi ([MOBILE-TEST.md](./MOBILE-TEST.md); use your PC’s LAN IP)
   - Production: `https://<your-domain>/auth/callback`

If Google is not enabled in Supabase, the app shows a clear error instead of failing silently.

> When you deploy, add the same two paths for your production domain (e.g. `https://forge-9ieq.onrender.com/auth/callback` and `.../auth/reset-password`). See [LAUNCH-CHECKLIST.md](./LAUNCH-CHECKLIST.md) for Google OAuth and production URLs.

---

### Step 3 — Run locally and smoke-test (≈5 minutes)

```bash
npm run dev
```

Open **http://localhost:3000**

**Test first:**

1. **Sign up** as a customer (email + password)
2. **Search workers** on the home / search page (categories appear if you ran the seed file)
3. If sign-up works and the page loads without Supabase errors in the browser console — you're unblocked 🎉

**Worker onboarding flow (end-to-end):**

1. Sign up as **Skilled Worker** → set password (no phone/email OTP step)
2. Complete **profile onboarding** (`/auth/onboarding`) — bio, skills, rates
3. Land on **worker dashboard** — `worker_status` is set to `active` on profile completion (no Paystack step for now)

**Forgot password:**

1. Go to `/auth/forgot-password` → enter email → check inbox
2. Link opens `/auth/reset-password` — must be listed in Supabase redirect URLs (see Step 2)
3. Set a new password → redirected to sign in

> **Verification deferred (beta):** Phone OTP and email confirmation gates are **off in the app**. Signup is role → details → (workers: plan) → password → session → `resolvePostAuthPath` (customer dashboard / worker onboarding). Phone is optional. Google OAuth is unchanged.
>
> **Onboarding fee deferred (beta):** The ₵10 / ₦2,000 Paystack onboarding payment is **not required**. Paystack code (`OnboardingPayment`, webhooks) remains in the repo for a later rollout. Apply migration `010_skip_onboarding_payment.sql` (or run its SQL) so existing `pending_payment` workers become `active`.
>
> **Required for instant access:** Supabase → **Authentication** → **Providers** → **Email** → turn **Confirm email OFF**. If Confirm email stays ON, Supabase returns no session after signup and the user must sign in after confirming (or after you disable the setting).
>
> `services/smsService.ts` remains in the repo for a future verification rollout; it is unused by signup/login UI for now.

---

## Run locally (quick reference)

```bash
# Only if node_modules is missing:
npm install

# Start dev server
npm run dev
```

→ **http://localhost:3000**

---

## After local works

Work through the full checklist for payments, admin, and deploy:

→ **[LAUNCH-CHECKLIST.md](./LAUNCH-CHECKLIST.md)**

Highlights still ahead:

- **Paystack webhook** — needs Supabase CLI + `supabase functions deploy paystack-webhook`
- **First admin** — sign up, then in SQL Editor:
  ```sql
  UPDATE profiles SET role = 'admin'
  WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
  ```
- **Deploy** — see [Render deploy](#render-deploy-static-site) below or the full [LAUNCH-CHECKLIST.md](./LAUNCH-CHECKLIST.md)

---

## Live production URL (Render)

| Item | Value |
|------|-------|
| **Platform** | Render (static site `forge`) |
| **Live URL** | [https://forge-9ieq.onrender.com](https://forge-9ieq.onrender.com) |
| **Status** | live (HTTP 200 verified) |
| **Dashboard** | [srv-d9bqtebbc2fs73asbb2g](https://dashboard.render.com/static/srv-d9bqtebbc2fs73asbb2g) |

**Add these in Supabase → Authentication → URL Configuration now:**

1. **Site URL:** `https://forge-9ieq.onrender.com`
2. **Redirect URLs** (add alongside localhost):
   - `https://forge-9ieq.onrender.com/auth/callback`
   - `https://forge-9ieq.onrender.com/auth/reset-password`

Env vars set on Render (names only): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_AI_PROVIDER`, `VITE_OPENROUTER_API_KEY`, `VITE_GEMINI_API_KEY`.

**AI chat (OpenRouter):** Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). Uses pinned free chat models (not `openrouter/free`, which can route to safety classifiers). On Render set `VITE_AI_PROVIDER=openrouter` and `VITE_OPENROUTER_API_KEY`, then **Manual Deploy** (Vite bakes `VITE_*` at build time). Prefer the safer path: `supabase secrets set OPENROUTER_API_KEY=...` + `supabase functions deploy ai-chat` (see `supabase/functions/ai-chat/README.md`). Note: a `VITE_` key is public in the SPA bundle — restrict referrers / rotate on OpenRouter.

**Phone/email verification:** deferred for beta — no Twilio/AT vars required for signup/login. Turn **Confirm email OFF** in Supabase for instant post-signup sessions.

---
## Render deploy (static site)

Forge is a Vite SPA — production is just the `dist/` folder on a static host. This repo ships a [`render.yaml`](./render.yaml) Blueprint for [Render](https://render.com).

### Quick steps

1. Push this repo to GitHub / GitLab / Bitbucket
2. Render Dashboard → **New** → **Blueprint** → select the repo (Render reads `render.yaml`)
3. **Before the first build finishes**, open the **forge** static site → **Environment** and add your `VITE_*` vars (copy from `.env.local`):
   - **Required:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`
   - **Optional:** `VITE_SENTRY_DSN`, AI keys, etc. — see [`.env.local.example`](./.env.local.example)
4. If you missed step 3, add the vars and click **Manual Deploy** (Vite only reads env at build time)
5. In Supabase → **Authentication** → **URL Configuration**, set **Site URL** and add redirect URLs for your Render domain (e.g. `https://forge-9ieq.onrender.com/auth/callback`)

### What `render.yaml` configures

| Setting | Value |
|---------|--------|
| Build | `npm install && npm run build` |
| Publish path | `dist` |
| SPA routing | `/*` → `/index.html` (rewrite) |

Free-tier static sites spin down after 15 minutes of inactivity; first visit may be slow. See [Render free plan limits](https://render.com/docs/free).

---

## Security topics for a later review

Before scaling traffic or payments, schedule a short security pass covering: **service worker update integrity** (subresource hashes in `version.json`, CSP for `sw.js`), **client-exposed API keys** (`VITE_*` vars are public in the browser bundle — prefer Supabase Edge Functions for OpenRouter/FCM/Paystack secrets), **RLS and auth redirect allowlists** on Supabase, and **upload/storage policies** for verification docs. None of these block beta launch, but they should be explicit before production hardening.

---

*You’ve done the hard setup work. One SQL session in the dashboard and you’ll see Forge come alive.*
