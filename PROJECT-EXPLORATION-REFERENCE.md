# Forge — Project Exploration Reference

> **Purpose:** Coordinator map for agents and engineers. Actionable index — not a duplicate of `FORGE-COMPLETE-REFERENCE.md`.  
> **Last explored:** 2026-07-03

> **Deploying to beta or production?** Use **[LAUNCH-CHECKLIST.md](./LAUNCH-CHECKLIST.md)** — step-by-step manual tasks (Supabase, Paystack, auth, cron, deploy) with P0/P1/P2 priorities.

---

## 1. Executive Summary

**Forge** is a React 19 + Vite SPA marketplace for skilled workers and customers in **Ghana (GHS)** and **Nigeria (NGN)**, backed entirely by **Supabase** (Auth, Postgres, Storage, Realtime). There is no custom backend server in-repo.

**Strengths:** Mature service layer (~18 services), property-based tests (~180 cases / 20 files), role-based routing, booking FSM, Paystack integration scaffolding, PWA, Sentry, dual AI providers (Ollama/Gemini).

**Critical gaps blocking production:**
1. **`BookingModal` collects Paystack payment but never calls `bookingService.createBooking()`** — paid bookings do not persist.
2. **`paymentWebhookService` has no HTTP endpoint** — no Supabase Edge Function or server to receive Paystack webhooks; subscription/onboarding payment side-effects cannot run in production.
3. **Paystack secret key exposed via `VITE_*` env** — webhook HMAC verification cannot safely run client-side.
4. **Storage buckets** (`avatars`, `job-media`, `verification-documents`) not defined in SQL — manual Supabase setup required.
5. **RLS missing** on `worker_payments` and `service_categories`.

**Next priorities for coordinators:** Wire booking creation post-payment → deploy webhook handler → fix RLS/storage → schedule subscription expiry cron (see `docs/CRON.md`).

---

## 2. Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Table of Contents](#2-table-of-contents)
3. [Project Overview](#3-project-overview)
4. [System Architecture](#4-system-architecture)
5. [Database Layer](#5-database-layer)
6. [Business Logic](#6-business-logic)
7. [Frontend](#7-frontend)
8. [Cross-Cutting Production Gaps](#8-cross-cutting-production-gaps)

**Deep dive:** See `FORGE-COMPLETE-REFERENCE.md` for route tables, env var lists, test inventory, and PWA config detail.

---

## 3. Project Overview

### Stack

| Layer | Tech |
|-------|------|
| UI | React 19, TypeScript 5.8, Tailwind CSS 4 (`forge-*` tokens) |
| Routing | react-router-dom v7 |
| Forms | react-hook-form + zod |
| Backend | Supabase JS v2 (Postgres + Auth + Realtime + Storage) |
| Payments | @paystack/inline-js (client popup) |
| AI | Ollama (local, proxied) + Gemini 2.0 Flash (fallback) |
| Build | Vite 6, vite-plugin-pwa, Sentry vite plugin |
| Tests | vitest + fast-check + @testing-library/react |

### Key Directories

| Path | Role |
|------|------|
| `index.tsx` | Mount point → `App` |
| `App.tsx` | Providers, route guards, layout shell |
| `pages/` | 21 route pages (auth, dashboards, marketplace) |
| `components/` | 15 shared UI (BookingModal, Navigation, AIChat, etc.) |
| `services/` | All Supabase/API business logic + co-located `*.property.test.ts` |
| `context/AuthContext.tsx` | Session + app `User` mapping |
| `types.ts` | App-level interfaces (`User`, `WorkerProfile`) |
| `types/database.ts` | Generated Supabase row types |
| `supabase-schema.sql` | Full DDL, RLS, triggers, indexes (repo root) |
| `supabase/` | Seed SQL only (`seed-categories.sql`, `seed-mock-data.sql`) |
| `src/auth/` | Unused alternate Login/Signup forms (dead code) |
| `utils/` | analytics, crypto, logger, rateLimiter, cssPurge, imageOptimization |
| `tests/` | Integration test harness + setup |

### Entry Points

```
index.tsx → App.tsx → AuthProvider → Router → AppContent (routes + layout)
```

- **Dev:** `npm run dev` (port 3000, host `0.0.0.0`)
- **Build:** `npm run build` → `dist/`
- **Tests:** `npm test` (vitest `--run`)

### Environment (`.env.local.example`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Yes | Supabase client |
| `VITE_AI_PROVIDER`, `VITE_OLLAMA_*`, `VITE_GEMINI_API_KEY` | One AI path | AI chat |
| `VITE_PAYSTACK_PUBLIC_KEY` | Yes (payments) | Client Paystack popup |
| `VITE_PAYSTACK_SECRET_KEY` | ⚠️ Should NOT be client | Webhook HMAC (needs server) |
| `VITE_SENTRY_DSN`, `SENTRY_*` | Optional | Error monitoring + source maps |
| `VITE_TWILIO_*` or `VITE_AT_*` | OTP | Phone verification |
| `VITE_FCM_SERVER_KEY` | Push | FCM (server-side ideally) |

Google OAuth configured in Supabase dashboard — no client env vars.

### Integrations

| Service | Client | Server-side in repo? |
|---------|--------|---------------------|
| Supabase Auth/DB/Realtime | ✅ `services/supabase.ts` | Schema SQL only |
| Paystack popup | ✅ `paystackService.ts` | ❌ Webhook handler not deployed |
| SMS OTP | ✅ `smsService.ts` | Calls Twilio/Africa's Talking from client |
| AI (Ollama/Gemini) | ✅ `aiService.ts` | Ollama proxied via Vite `/ollama` |
| Sentry | ✅ `monitoringService.ts` | Build-time source map upload |
| FCM push | ✅ `notificationService.ts` | Partial — needs server key |

### Testing

- **15 service property test files** + `tests/systemIntegration.test.ts` (in-memory DB mock)
- **Known failing tests:** 3 in `ollamaService.property.test.ts` when Ollama not running (proxy returns 503/500)
- **Coverage:** Strong on services; minimal page/component tests

---

## 4. System Architecture

### Pattern: SPA + BaaS

```
Browser (React SPA)
  ├── AuthContext ← authService ← Supabase Auth (JWT)
  ├── Pages/Components
  └── services/* ← Supabase PostgREST (RLS-enforced)
        └── (intended) Paystack webhooks → Edge Function → paymentWebhookService
```

No Express/Fastify/Edge Functions exist in-repo today.

### Layers

| Layer | Location | Notes |
|-------|----------|-------|
| Presentation | `pages/`, `components/` | Calls services directly; no Redux |
| State | `AuthContext` + local `useState`/`useEffect` | No global store |
| Domain | `services/*.ts` | Primary business logic |
| Data | Supabase Postgres + RLS | `types/database.ts` |
| Infra | `vite.config.ts`, PWA, Sentry | Build/deploy concerns |

### Request Flow (typical)

1. User action in page/component
2. Service function called (e.g. `getBookingsByCustomer`)
3. Supabase client query with user's JWT
4. RLS filters rows server-side
5. `DatabaseError` mapping on failure → UI toast/message

### Route Guards (`App.tsx`)

| Guard | Behavior |
|-------|----------|
| `ProtectedRoute` | Unauthenticated → `/auth/login` |
| `CustomerRoute` | Workers → `/dashboard/worker` |
| `WorkerRoute` | Non-workers → customer dash; `pending_payment` → onboarding payment; incomplete profile → onboarding |
| `AdminRoute` | Non-admin → `/dashboard` |
| `DashboardRedirect` | Role-based dashboard routing |

### Auth State

- **Provider:** `AuthContext` — `user`, `isAuthenticated`, `isLoading`, `login`, `logout`, `refreshUser`
- **Source:** Supabase session via `onAuthStateChange` + `getUserProfile`
- **Mapping:** Supabase profile + OAuth metadata → app `User` (`types.ts`)
- **Roles:** `customer` | `worker` | `admin`; workers have `workerStatus` (`pending_payment` → `active`)

### Architecture Gaps

| Gap | Impact |
|-----|--------|
| No webhook HTTP endpoint | Payments succeed in Paystack but DB not updated |
| Webhook logic in client bundle | Secret key exposure risk |
| `types.ts` vs `types/database.ts` drift | Two type systems; prefer `database.ts` for DB ops |
| `/notifications` route | Redirects to dashboard — no dedicated notifications page |
| OAuth callback path | App uses `/auth/callback` (not `/auth/auth-callback` from older docs) |
| Dead code in `src/auth/` | Unused forms; pages use inline implementations |

---

## 5. Database Layer

### 16 Tables

| # | Table | Primary Service(s) |
|---|-------|-------------------|
| 1 | `profiles` | `authService` |
| 2 | `worker_profiles` | `workerService` |
| 3 | `service_categories` | `workerService.getCategories` |
| 4 | `jobs` | `jobService` |
| 5 | `bookings` | `bookingService` |
| 6 | `reviews` | `reviewService` |
| 7 | `conversations` | `chatService` |
| 8 | `messages` | `chatService` |
| 9 | `subscriptions` | `subscriptionService` |
| 10 | `transactions` | `paymentWebhookService` |
| 11 | `notifications` | `notificationService` |
| 12 | `device_tokens` | `notificationService` |
| 13 | `verification_documents` | `verificationService` |
| 14 | `worker_payments` | `paymentWebhookService.handleOnboardingPayment` |
| 15 | `worker_portfolios` | `workerService` |
| 16 | `worker_endorsements` | `workerService` |

**Schema file:** `supabase-schema.sql` (root). Seeds in `supabase/`.

### RLS Summary

RLS **enabled** on 14 tables. Key policies:
- **Public read:** profiles, worker_profiles, jobs, reviews, portfolios, endorsements
- **Participant-only:** bookings, conversations, messages
- **Owner-only:** subscriptions, notifications, transactions (SELECT), device_tokens, verification_documents

### RLS Gaps

| Table | Issue | Action |
|-------|-------|--------|
| `worker_payments` | RLS not enabled | Add policies: owner read, service-role write |
| `service_categories` | RLS not enabled | Enable + public SELECT policy |
| `transactions` | SELECT only for owner | Webhook inserts need service role |
| `profiles.country` | No CHECK constraint | Add `CHECK (country IN ('GH','NG'))` |

### Triggers & Indexes

- **`handle_new_user()`** — auto-inserts `profiles` row on auth signup
- **9 indexes** — worker skills (GIN), jobs, bookings, messages, notifications

### Storage (not in SQL)

Manual Supabase bucket setup required: `avatars`, `job-media`, `verification-documents`.

---

## 6. Business Logic

### Domain Model (simplified)

```
User (profile) ─┬─ Customer → posts Jobs → creates Bookings
                └─ Worker → worker_profile → accepts/completes Bookings
                              ├── Subscription tier (free/basic/premium)
                              ├── Portfolio + Endorsements
                              └── KYC verification_documents

Booking lifecycle tied to Job; Review requires COMPLETED booking.
Payments: onboarding fee, subscription, booking — all via Paystack.
```

### Services Inventory (18 files)

| Service | Key exports |
|---------|-------------|
| `authService` | signUp, login, OAuth, OTP, profile CRUD |
| `bookingService` | createBooking, accept/start/complete/cancel, FSM validation |
| `jobService` | CRUD, search, getJobsByPoster |
| `workerService` | profiles, ranked search, portfolio, endorsements |
| `chatService` | conversations, paginated messages, read receipts |
| `reviewService` | createReview, rating aggregation |
| `subscriptionService` | plans, create/cancel, expiry batch |
| `paystackService` | popup init, currency helpers |
| `paymentWebhookService` | HMAC verify, event routing, transaction log |
| `notificationService` | in-app + FCM push |
| `verificationService` | KYC upload, approve/reject |
| `aiService` / `geminiService` / `ollamaService` | AI chat with fallback |
| `smsService` | OTP send/verify |
| `monitoringService` | Sentry wrapper |
| `serviceWorker` | PWA registration |
| `databaseErrors` | Supabase error mapping |
| `supabase` | Client init |

### Booking FSM

```
PENDING → ACCEPTED → IN_PROGRESS → COMPLETED → REVIEWED
   └────────── CANCELLED ←────────────┘
```

- Validation: `isValidTransition()` in `bookingService.ts`
- `createBooking(jobId, workerId, message)` requires existing job; status starts `PENDING`
- UI actions in `pages/Bookings.tsx`: accept, start, complete, cancel

### Payments

| Flow | Client | Post-payment (intended) |
|------|--------|------------------------|
| Booking | `BookingModal` → `paystackService.initializePayment` | Webhook → `handleBookingPayment` |
| Onboarding ₵10/₦2,000 | `OnboardingPayment` + `PaymentGateModal` | Webhook → `handleOnboardingPayment` |
| Subscription | `Subscription` page | Webhook → `handleSubscriptionPayment` |

**Pricing:** Free/Basic/Premium — GHS 0/20/50, NGN 0/2000/5000 (30-day subscription).

### Known Business Logic Gaps

| Gap | Detail | Fix direction |
|-----|--------|---------------|
| **BookingModal → no DB booking** | Only calls `paystackService`; `onSuccess` logs to console | Call `createBooking()` before or after payment; link `job_id` |
| **Direct worker booking vs job-based** | Modal books by worker/hours; `createBooking` requires `jobId` | Create implicit job or extend schema for direct bookings |
| **Webhook not wired** | `paymentWebhookService` tested but never invoked over HTTP | Supabase Edge Function + service role |
| **Worker ranking** | `searchWorkersRanked` implemented; verify UI passes lat/lng | Check `WorkerSearch` filter wiring |
| **Subscription expiry** | `handleSubscriptionExpiry()` batch exists; no cron | See **`docs/CRON.md`** — pg_cron, Edge Function schedule, or external cron |

---

## 7. Frontend

### App Shell (`App.tsx`)

- **Providers:** Sentry boundary → ErrorBoundary → HelmetProvider → AuthProvider → Router
- **Layout:** TopNav + BottomNav, OfflineIndicator, UpdatePrompt, InstallPrompt, AIChat (global)
- **Animation:** framer-motion `PageTransition` on most routes
- **21 routes** — public (home, search, worker profile), protected (jobs, bookings, messages, subscription), role dashboards, admin

### Pages by Domain

| Domain | Pages | Service deps |
|--------|-------|--------------|
| Public | `Home`, `WorkerSearch`, `WorkerProfile` | workerService |
| Auth | `Login`, `Signup`, `AuthCallback`, `ForgotPassword`, `ResetPassword`, `WorkerOnboarding`, `OnboardingPayment` | authService, paystackService |
| Customer | `CustomerDashboard`, `Jobs`, `JobDetail`, `Bookings`, `UserProfile`, `ProfileEdit` | jobService, bookingService |
| Worker | `WorkerDashboard`, `Subscription` | bookingService, subscriptionService |
| Admin | `AdminDashboard` | multiple |
| Legacy | `Dashboard.tsx` | redirect helper |

### Key Components

| Component | Used by | Notes |
|-----------|---------|-------|
| `BookingModal` | `WorkerProfile` | 4-step: details → Paystack → success/error |
| `PaymentGateModal` | Worker dashboard flow | Non-dismissible onboarding fee gate |
| `WorkerCard` | `WorkerSearch` | Search result card |
| `Navigation` | App shell | TopNav (desktop) + BottomNav (mobile) |
| `AIChat` | Global floating | aiService |
| `ShareTools` | Worker profile | QR business card |

### Frontend Bugs / Patterns

| Issue | Files affected | Severity |
|-------|----------------|----------|
| `<PageHelmet />` outside JSX return | ~~`Home`, `Bookings`, dashboards, auth pages~~ | **Fixed** — all pages render `<PageHelmet />` inside return fragments |
| `BookingModal.onSuccess` only `console.log`s | `WorkerProfile.tsx` | No booking persistence |
| `/notifications` | App.tsx | Redirect only — no UI |
| Manifest icon | `public/manifest.json` | References `/logo.png`; verify assets |

---

## 8. Cross-Cutting Production Gaps

Priority-ordered checklist for launch readiness:

| P | Gap | Owner hint |
|---|-----|------------|
| P0 | BookingModal does not create bookings | Frontend + bookingService |
| P0 | Deploy Paystack webhook endpoint (Edge Function) | Infra; move secret off `VITE_*` |
| P0 | Storage buckets + upload policies | Supabase dashboard / SQL |
| P1 | RLS on `worker_payments`, `service_categories` | DB migration |
| P1 | ~~Fix `PageHelmet` render pattern across pages~~ | Done |
| P1 | SMS/FCM from client exposes keys | Move to Edge Functions |
| P2 | Ollama proxy fails when daemon down (503) | Dev UX; Gemini fallback |
| P2 | `types.ts` / `database.ts` consolidation | Types refactor |
| P2 | Remove dead `src/auth/` or wire it | Cleanup |
| P2 | Subscription expiry cron | See `docs/CRON.md` |
| P3 | Manifest icon mismatch | Assets |
| P3 | `profiles.country` CHECK constraint | DB migration |
| P3 | Empty `workflows/` / `tools/` (WAT framework) | Future automation |
| P3 | `.env.local` contains live secrets — never commit | Git hygiene |

### Quick Commands

```bash
npm run dev          # Local dev :3000
npm test             # Full test suite
npm run build        # Production build
```

### Reference Files

| Need | File |
|------|------|
| Full route/env/test detail | `FORGE-COMPLETE-REFERENCE.md` |
| DB DDL | `supabase-schema.sql` |
| Service contracts | `services/*.ts` + `*.property.test.ts` |
| Design specs | `.kiro/specs/` |

---

*Generated as coordinator reference. Update after major feature work or production deploy milestones.*
