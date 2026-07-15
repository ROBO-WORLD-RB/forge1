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
   | 2 | `supabase/migrations/001_storage_and_rls_fixes.sql` |
   | 3 | `supabase/migrations/add_worker_location.sql` |
   | 4 | `supabase/migrations/002_security_hardening.sql` |
   | 5 | `supabase/migrations/003_signup_profile_and_jobs_fixes.sql` ← phone/username signup + jobs RLS |
   | 6 | `supabase/migrations/004_fix_username_generation.sql` ← **required if signup fails with `profiles_username_key` / `@user000000000000`** |

4. *(Optional but helpful)* Run `supabase/seed-categories.sql` so service categories show up in search.

### Fix production signup / jobs (if already live)

If the app is already deployed and you see **"Unable to create your account"** / **"Database error saving new user"** on signup, or **posted jobs disappear** after leaving the Jobs page:

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/siutunqbdteyrycrbzub/sql/new)
2. If you have **not** run 003 yet: paste and **Run** [`supabase/migrations/003_signup_profile_and_jobs_fixes.sql`](./supabase/migrations/003_signup_profile_and_jobs_fixes.sql) (phone uniqueness + jobs RLS). If 003 already ran (even partially), skip to step 3.
3. Paste and **Run** the entire file: [`supabase/migrations/004_fix_username_generation.sql`](./supabase/migrations/004_fix_username_generation.sql) — replaces `handle_new_user()` with collision-proof usernames. **Do not re-run broken 003** to fix `@user000000000000`; run **004** instead.
4. Soft-refresh the production app and retry signup + post a job → leave Jobs → return → **My Posted Jobs** should still list it

**What 003 fixes:** empty `phone` collisions aborting signup, and jobs RLS so posters can SELECT their rows after INSERT.

**What 004 fixes:** username generation that truncated UUID hex to zeros (`@user000000000000`), causing `profiles_username_key` duplicate errors on the next signup.

**If a storage bucket insert fails:** Dashboard → **Storage** → create `avatars` (public), `job-media` (public), and `verification-documents` (private), then re-run file **001** for the policies.

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

1. Sign up as **Skilled Worker** → verify phone OTP → set password
2. Complete **profile onboarding** (`/auth/onboarding`) — bio, skills, rates
3. Pay the **onboarding fee** (`/auth/onboarding/payment`) via Paystack test mode
4. Land on **worker dashboard** once `worker_status` becomes `active` (webhook or manual SQL in dev)

**Forgot password:**

1. Go to `/auth/forgot-password` → enter email → check inbox
2. Link opens `/auth/reset-password` — must be listed in Supabase redirect URLs (see Step 2)
3. Set a new password → redirected to sign in

> **Phone OTP (signup verify step):** Uses the app’s `smsService` (Twilio or Africa’s Talking), **not** Supabase Phone Auth.
>
> - If SMS env vars are missing or send fails, the **6-digit code is shown on-screen** (dev and production beta) — use **Fill code**.
> - When Twilio/AT is configured and SMS succeeds, the code is **hidden** (user receives SMS only).
>
> **Render env vars for real SMS** (Dashboard → `forge` → Environment → rebuild after adding). Use **either** Twilio **or** Africa’s Talking:
>
> | Provider | Variable names |
> |----------|----------------|
> | Twilio (preferred) | `VITE_TWILIO_ACCOUNT_SID` (must start with `AC`), `VITE_TWILIO_AUTH_TOKEN`, `VITE_TWILIO_PHONE_NUMBER` |
> | Africa’s Talking | `VITE_AT_API_KEY`, `VITE_AT_USERNAME` |
>
> Values come from your Twilio / Africa’s Talking dashboard — do not commit them. Note: `VITE_*` keys are baked into the client bundle; move to an Edge Function before hard launch.

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

Env vars set on Render (names only): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_AI_PROVIDER`, `VITE_GEMINI_API_KEY`.

**Still needed for real SMS** (signup “Verify Your Phone”): add Twilio **or** AT vars above, then **Manual Deploy** (Vite reads env at build time). Without them, users see an on-screen beta code instead of an SMS.

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

*You’ve done the hard setup work. One SQL session in the dashboard and you’ll see Forge come alive.*
