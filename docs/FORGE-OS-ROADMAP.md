# FORGE OS Evolution Roadmap

**Project:** FORGE (skilled-worker marketplace — Ghana & Nigeria)  
**Repo:** https://github.com/ROBO-WORLD-RB/forge1  
**Stack today:** React 19 + Vite 6 SPA · Supabase BaaS · Edge Functions · Render static + PWA  
**Document status:** Phase 0 / M0 security hardening implemented in code (apply SQL 012–015 + redeploy Edge Functions); M1–M6 not started  

**Audience:** Founder + engineering sessions that implement one milestone at a time

---

## Executive summary

FORGE already runs a working marketplace loop: customers search and book workers, workers maintain profiles and apply to jobs, both sides message and manage bookings, and subscriptions gate worker visibility via Paystack. Dual dashboards and role-aware nav exist; the product is closer to “two operating surfaces on one backend” than a greenfield rebuild.

What is **not** ready for OS expansion is trust integrity. Phase 1 surfaced Critical security gaps: secrets in the Vite client bundle, workers able to self-set `tier` / `verified`, client-side subscription activation without server proof, an unauthenticated push Edge Function, missing notifications INSERT RLS, Service Worker caching of Supabase REST, and admin KYC blocked by RLS. **Phase 0 (security) is mandatory before Customer OS / Worker OS build-out.**

Phases 2–5 define product understanding, a dual-OS target architecture that **extends** the current SPA (not a rewrite), AI features that plug into existing `ai-chat` / OpenRouter, and a milestone backlog for **fresh agent sessions**. Phase 6 (implementation) starts only after founder approval of this document.

---

## Phase 0 — Security & integrity (MUST before OS build)

These items are labeled by severity. Fix Critical before any OS shell work that increases surface area (wallet, escrow, admin, AI tools with write access).

### Critical

| # | Issue | Where | Risk | Required fix (direction) |
|---|--------|--------|------|---------------------------|
| C1 | **Client-bundled secrets** | `VITE_FCM_SERVER_KEY` (`services/notificationService.ts`), Twilio / Africa’s Talking keys (`services/smsService.ts`), any client AI keys | Anyone can extract FCM/SMS/AI credentials from the built JS | Move all privileged keys to Edge Function secrets / server-only env. Client may keep only public anon keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and public Paystack key |
| C2 | **Worker self-escalation of `tier` / `verified`** | `worker_profiles` RLS + `services/workerService.ts` / profile update paths | Free users can mark themselves premium/verified | Strip `tier` and `verified` from client-updatable columns; only service role / webhook / admin RPCs may write them |
| C3 | **KYC self-approval path** | `verification_documents` RLS + `services/verificationService.ts` | Workers can approve their own docs | Workers: INSERT + read own pending only. Status transitions `pending → approved/rejected` admin/service-role only |
| C4 | **Subscription activate from client without Paystack proof** | `services/subscriptionService.ts`, client Paystack success handlers vs `supabase/functions/paystack-webhook` | Paid tier without payment | Treat webhook (or verified server lookup of Paystack transaction) as sole activation authority; client UI only initiates checkout and polls status |
| C5 | **Unauthenticated `send-push-notification` Edge Function** | `supabase/functions/send-push-notification/` | Spam / abuse of push infra | Require Supabase JWT + user ownership of `device_tokens`, or service-role invoke only from trusted functions |
| C6 | **Notifications INSERT RLS missing / weak** | `notifications` table policies | Users can forge inbox items for others | INSERT only via service role / Edge Functions; users UPDATE/SELECT own rows only |
| C7 | **Service Worker caches Supabase REST ~24h** | `services/serviceWorker.ts` / workbox config | Stale auth-scoped data, privacy leaks across sessions | Exclude Supabase REST/Realtime from long-lived cache; network-first or no-store for API |

### High

| # | Issue | Where | Risk | Required fix (direction) |
|---|--------|--------|------|---------------------------|
| H1 | **Admin KYC broken under RLS** | `pages/admin/AdminDashboard.tsx` + verification RLS | Admins cannot approve legit workers; temptation to weaken policies | Admin RPCs / Edge Function with service role; keep client policies strict |
| H2 | **Push pipeline unused / stubbed** | `send-push-notification`, `device_tokens`, FCM client path | Incomplete trust story for booking alerts | After C1/C5: wire server-side send only; keep in-app `notifications` as primary until push is proven |
| H3 | **Onboarding payment skipped for beta** | `App.tsx` `WorkerPaymentRoute`, migration `010_skip_onboarding_payment.sql`, `pages/auth/OnboardingPayment.tsx` | Marketing/trust mismatch if fee re-enabled without webhook path | Document as deferred; re-enable only through same server-verified payment path as C4 |

### Justification

OS features (wallet, escrow, disputes, AI agents with tools) **amplify** every privilege bug. A dual-OS shell that looks finished while workers can self-verify or activate subscriptions destroys marketplace trust. Phase 0 is not optional polish — it is the integrity floor for Ghana/Nigeria payments and KYC.

**Exit criteria for Phase 0:** no privileged secrets in client bundle; `tier`/`verified`/KYC status not client-writable; subscription activation webhook-only; push function authenticated; notifications insert locked; SW does not cache Supabase REST; admin can approve KYC via a secure path.

---

## Phase 1 Discovery summary (brief)

| Lens | Finding |
|------|---------|
| **A — Architecture** | SPA only (no custom Node server). Supabase Auth + Postgres + Storage. Edge Functions: `ai-chat`, `paystack-webhook`, `subscription-expiry-cron`, `send-push-notification` (stub). Roles: `customer` \| `worker` \| `admin`. Domain logic in `services/*.ts`. Deploy: Render static + PWA. Routes owned by `App.tsx` (Home, auth, search, profiles, dual dashboards, jobs, bookings, messages, notifications, subscription, admin, AI chat overlay). |
| **B — Features** | **Complete cores:** worker profiles, messaging, bookings lifecycle, jobs/projects, search, portfolio, subscriptions, PWA, dual dashboards. **Partial:** auth (OTP deferred), notifications (push unused), payments (no escrow), reviews (`UserProfile` still has mocks), KYC, admin (users tab placeholder), settings, AI chat, geolocation, analytics (localStorage). **Missing:** wallet, favorites, disputes, invoices. **Placeholder:** escrow (marketing only). **Deprecated/skipped:** onboarding payment (beta). |
| **C — Database** | 16 tables in `supabase-schema.sql` / `types/database.ts`: `profiles`, `service_categories`, `worker_payments`, `worker_profiles`, `subscriptions`, `jobs`, `bookings`, `reviews`, `conversations`, `messages`, `transactions`, `notifications`, `device_tokens`, `verification_documents`, `worker_portfolios`, `worker_endorsements`. ERD spine: profiles → jobs/bookings → chat/reviews + KYC/subscriptions/transactions. **Gaps:** escrow, wallets, disputes, favorites, invoices, first-class `job_applications`, `analytics_events`. Prefer **additive migrations only**. |
| **D — UI** | Customer vs Worker already partially split in `Navigation.tsx` and dashboards; shared shell. Gaps: `forge-cyan` undefined, `Button`/`Input` underused, crowded `BottomNav`, no Card/Modal primitives, theme-color mismatch. |
| **E — Tech debt** | See Phase 0 — treat as gate before OS expansion. |

Honesty rule for planning: **do not rebuild** search, bookings FSM, chat, or dual dashboards. Extend them.

---

## Phase 2 — Product understanding

### Vision

FORGE is the operating system for blue-collar hiring in GH/NG:

- **Customer OS** — discover trustable skilled workers, post work, hire, track jobs, pay safely, leave proof-of-work reviews.
- **Worker OS** — run a micro-business: profile & portfolio, inbound bookings, outbound job applications, subscription visibility, earnings & payouts (future wallet).
- **Shared platform** — one identity (`profiles`), one messaging fabric, one booking FSM, one payments ledger — two intentional UIs.

AI assists matching and guidance; it does not replace the marketplace or invent a parallel CRM.

### Current journeys (as implemented)

#### 1) Customer hire loop (works today)

1. Land on `Home` → `WorkerSearch` (`/search`) or browse/post via `Jobs`.
2. Open `WorkerProfile` (`/profile/:id` or `/pro/:username`).
3. Create booking via `BookingModal` / `bookingService` → status `PENDING`.
4. Worker accepts → `ACCEPTED` → work → `IN_PROGRESS` → `COMPLETED` → review → `REVIEWED`.
5. Parallel: `Messages` (`chatService` / `conversations` + `messages`), in-app `Notifications`.
6. Hub: `CustomerDashboard` (`/dashboard/customer`).

#### 2) Worker apply / supply loop (works today)

1. Signup role `worker` → `WorkerOnboarding` (`/auth/onboarding`) until `profileCompleted`.
2. Onboarding fee route exists but **beta-skips** to dashboard (`WorkerPaymentRoute`).
3. Maintain profile (`ProfileEdit`, portfolio tables), optional KYC upload (`VerificationUpload` / `verification_documents`).
4. Browse customer projects (`Jobs` / `JobDetail`), apply (today: application logic tied to jobs/bookings — not a first-class `job_applications` table).
5. Manage inbound bookings on `WorkerDashboard` / `Bookings`.
6. Upgrade visibility via `Subscription` + Paystack (`paystackService`, webhook Edge Function, `subscription-expiry-cron`).

#### 3) Messaging (works today)

Authenticated users open `/messages`; conversations link parties around jobs/bookings/profiles. Realtime via Supabase; notification types include `new_message`.

#### 4) Payment today (honest)

| Flow | Reality |
|------|---------|
| Worker subscription (Basic/Premium) | Paystack checkout + `transactions` / `subscriptions`; activation **must** be webhook-proven (Phase 0 C4) |
| Worker onboarding fee | **Skipped for beta**; UI kept for later |
| Booking / job payment | **No escrow**. Money movement for work is off-platform or informal; `TransactionType` includes `'booking'` but escrow UX is marketing-only |
| Wallet / payouts / invoices | **Not built** |
| Refunds | Type exists on transactions; product flow incomplete |

### Roles & permissions (target clarity)

| Role | Can | Cannot (must enforce server-side) |
|------|-----|-----------------------------------|
| **customer** | Search workers, post jobs (`008_customers_only_create_jobs.sql`), book, message, review completed work, manage own profile | Set worker `tier`/`verified`; approve KYC; admin actions |
| **worker** | Edit own worker profile (non-privileged fields), portfolio, apply to jobs, accept/manage bookings, subscribe, upload KYC docs | Self-approve KYC; self-set premium/verified; forge notifications for others |
| **admin** | Approve/reject KYC, moderate users (future), view platform health | Operate via service-role/RPC paths that work under RLS (Phase 0 H1) |

### Booking FSM (source of truth: `services/bookingService.ts`)

```
PENDING ──► ACCEPTED ──► IN_PROGRESS ──► COMPLETED ──► REVIEWED
   │            │             │
   └────────────┴─────────────┴──► CANCELLED
```

Valid transitions are already encoded client-side; OS work should **preserve** this machine and eventually mirror it in DB constraints / RPCs so status cannot jump illegally via direct REST.

### Payment lifecycle (target honesty)

```
Today:     Intent → Paystack (subscription) → webhook → subscriptions.tier + worker_profiles.tier
Missing:   Booking quote → fund escrow → release on COMPLETED / refund on CANCELLED → wallet ledger → payout
```

Do not claim “escrow live” in product copy until M4 ships with ledger tables and webhook-driven state.

---

## Phase 3 — Target architecture: Customer OS + Worker OS

### Model

```
┌─────────────────────────────────────────────────────────┐
│                     FORGE SPA (Vite)                      │
│  ┌────────────────────┐    ┌──────────────────────────┐ │
│  │   Customer OS      │    │      Worker OS           │ │
│  │  /os/customer/*    │    │   /os/worker/*           │ │
│  │  (or /dashboard/*  │    │   + subscription, KYC,   │ │
│  │   evolved)         │    │     earnings)            │ │
│  └─────────┬──────────┘    └────────────┬─────────────┘ │
│            │     Shared shell           │               │
│            │  Navigation · Auth · AI    │               │
│            └─────────────┬──────────────┘               │
└──────────────────────────┼──────────────────────────────┘
                           │
              Supabase (Auth · Postgres · Storage · Realtime)
                           │
        Edge: ai-chat · paystack-webhook · crons · push · (future escrow)
```

**One backend, two OS surfaces.** No second monorepo. No custom Node API unless escrow/wallet forces a narrow Edge Function set (preferred over a long-lived server).

### What extends vs what stays

| Stays (extend in place) | Extends / re-homes in OS IA | Does not rewrite |
|-------------------------|-----------------------------|------------------|
| `services/*` domain APIs | Role-specific nav density (`Navigation.tsx`, BottomNav) | Auth provider (`AuthContext`) |
| Booking FSM | Customer OS home = hire pipeline; Worker OS home = business pipeline | Chat schema |
| Dual dashboards as seeds | Deeper IA: Favorites, Wallet, Disputes, Invoices (new routes) | Job/booking core tables (additive columns OK) |
| `ai-chat` Edge Function | Assistants with tool-scoped prompts + future tool calls | Marketplace matching as a separate product |

### Information architecture

#### Customer OS

| Area | Primary routes / surfaces | Purpose |
|------|---------------------------|---------|
| Home / Hub | Evolve `CustomerDashboard` | Active bookings, suggested workers, open jobs |
| Discover | `/search`, WorkerProfile | Hire |
| Projects | `/jobs`, create job | Demand side |
| Bookings | `/bookings` | Lifecycle |
| Messages | `/messages` | Coordination |
| Trust | Reviews (real data on UserProfile), favorites (new) | Repeat hire |
| Money (later) | Wallet view, invoices, escrow status | Safe pay |
| Account | `/my-profile`, privacy settings | Identity |

#### Worker OS

| Area | Primary routes / surfaces | Purpose |
|------|---------------------------|---------|
| Home / Hub | Evolve `WorkerDashboard` | Pipeline: requests, active jobs, applications |
| Supply | Profile edit, portfolio, endorsements | Win work |
| Demand board | `/jobs` browse + applications (first-class) | Outbound |
| Bookings | `/bookings` | Delivery |
| Growth | `/subscription`, KYC status | Visibility & trust |
| Money (later) | Earnings, wallet, payouts | Get paid |
| Account | Privacy, notifications prefs | Ops |

Shared chrome: logo, auth, unread badges, PWA install/update, Forge AI entry — but **BottomNav items differ by role** (fix crowded shared bar).

### Worker profile field matrix (current vs OS-ready)

| Field / concern | Current (`worker_profiles` + related) | Customer OS needs | Worker OS needs | Notes |
|-----------------|----------------------------------------|-------------------|-----------------|-------|
| Identity: name, role/trade, bio | Yes | Display | Edit | Keep |
| Location + lat/lng, country | Yes | Distance / trust | Edit + geolocation assist | Extend search ranking later |
| Rates + currency (GHS/NGN) | Yes | Filter/sort | Edit | Keep |
| Skills[] | Yes | Match | Edit | Feed AI matching |
| Rating / review_count | Yes | Sort | Read-only aggregate | Server-maintained |
| `tier` | Yes | Badge | Read-only (pay to change) | **Phase 0: not client-writable** |
| `verified` | Yes | Badge | Read-only via KYC | **Phase 0** |
| Portfolio | `worker_portfolios` | Gallery | CRUD | Keep |
| Endorsements | `worker_endorsements` | Social proof | Limited | Keep |
| KYC docs | `verification_documents` | Trust signal | Upload + status | Admin approve only |
| Response time / completion rate | Missing | Ranking | Analytics | Future derived metrics |
| Service radius / availability calendar | Missing | Booking UX | Edit | Future |
| Insurance / licenses metadata | Partial via cert docs | Trust | Upload | Extend KYC types |

---

## Phase 4 — AI features design

Principle: **plug into** `supabase/functions/ai-chat` (OpenRouter, server-side `OPENROUTER_API_KEY`) and thin clients (`components/AIChat.tsx`, `services/aiService.ts` / `openrouterService.ts`). Do **not** fork a second marketplace brain or rewrite search/bookings.

| Capability | User value | Integration approach | Priority |
|------------|------------|----------------------|----------|
| **Matching engine** | Better worker ↔ job fits | Retrieval: query `worker_profiles` + `jobs` + skills/geo; LLM ranks shortlist with explainable reasons; UI injects into Customer search / job detail “Suggested workers” and Worker “Jobs for you” | High (M5) |
| **Worker assistant** | Bid help, profile polish, schedule language | Same Edge Function with `mode=worker` system prompt + read-only context (own profile, open jobs). Optional later: draft application text inserted into UI fields | High (M5) |
| **Customer assistant** | Scope work, budget bands (GHS/NGN), hire checklist | Existing Forge AI prompt expanded with `mode=customer`; deep-link suggestions to `/search` filters | High (M5) |
| **Fraud / abuse signals** | Reduce fake KYC, payment gaming, spam bookings | Rules first (velocity, duplicate docs, self-review attempts); LLM as secondary classifier via Edge Function invoked service-side only — never trust client verdicts | Medium → harden in M6 |
| **Recommendations** | Repeat engagement | Hybrid: SQL recency/category + lightweight LLM re-rank; persist events in `analytics_events` (not only localStorage `utils/analytics.ts`) | Medium (M5–M6) |

### Guardrails

- No client AI secrets (Phase 0).
- Assistants **propose**; users confirm bookings/payments.
- Tool-calling (future) must use JWT-scoped RPCs — never service role from the browser.
- Keep free-model fallbacks in `ai-chat` until paid models are budgeted; product behavior must degrade gracefully.

---

## Phase 5 — Implementation plan (NO CODE YET)

### Gap analysis tables

#### Product / domain

| Area | Existing | Missing | Modified |
|------|----------|---------|----------|
| Auth & roles | Supabase auth, role gates in `App.tsx` | OTP (deferred), stronger admin tooling | Post-auth redirects already role-aware |
| Worker profiles | Full CRUD-ish + portfolio | Derived reputation metrics | Lock privileged fields |
| Jobs | CRUD, customer-create constraint | First-class applications | Application UX |
| Bookings | Full FSM in `bookingService` | Escrow-linked states | Optional payment_status column |
| Messaging | Conversations/messages | — | Minor OS entry points |
| Reviews | Service + modal | Kill mocks on `UserProfile` | Wire real aggregates |
| Subscriptions | Plans, Paystack, cron docs | Client-proof activation | Webhook-only activation |
| Notifications | In-app list | Secure insert + real push | RLS + Edge Function auth |
| Payments | Subscription + transaction rows | Escrow, wallet, invoices, disputes | Ledger model |
| Admin | Dashboard shell, KYC UI | Users tab, secure approve | RPC path |
| Analytics | localStorage page tracking | `analytics_events`, funnels | Server-side events |
| PWA | Install, SW, offline indicator | Correct API cache policy | SW allowlist |

#### Dual OS shell / UI

| Area | Existing | Missing | Modified |
|------|----------|---------|----------|
| Dashboards | `CustomerDashboard`, `WorkerDashboard` | OS-level IA depth | Nav + denser hubs |
| Navigation | Role-aware TopNav/BottomNav | Per-OS bottom bars, less clutter | Link sets |
| Design system | `Button`, `Input`, forge-orange/navy | Card/Modal primitives, `forge-cyan`, theme-color sync | Tokens in CSS/Tailwind |
| Favorites / wallet / disputes / invoices | — | Full features | New pages under OS routes |

### New DB tables (additive)

All **new migrations**; do not drop or rewrite the 16-table core.

| Table | Purpose | Milestone |
|-------|---------|-----------|
| `job_applications` | First-class worker → job applications (status, message, timestamps) | M3 |
| `favorites` | Customer saved workers (and optionally jobs) | M2 |
| `wallets` | Per-user balance + currency | M4 |
| `wallet_ledger` | Immutable credit/debit entries | M4 |
| `escrow_accounts` / `escrow_holds` | Booking-linked holds, state machine | M4 |
| `invoices` | Customer/worker-facing invoice records | M4–M6 |
| `disputes` | Booking disputes, status, evidence refs | M6 |
| `analytics_events` | Server-safe product analytics | M6 |

Optional columns (additive on existing tables): `bookings.payment_status`, `bookings.escrow_id`, `jobs.application_count`, `worker_profiles` availability fields.

### API / Edge Function changes

| Function / surface | Change | Priority |
|--------------------|--------|----------|
| `paystack-webhook` | Sole authority for subscription (and later escrow fund/release) state | High — M0/M4 |
| `subscription-expiry-cron` | Keep; document in `docs/CRON.md` | High — exists |
| `send-push-notification` | AuthN/Z; remove client FCM key path | High — M0 |
| `ai-chat` | Add `mode` + structured context; later tool hooks | Medium — M5 |
| **New** `escrow-paystack` (or extend webhook handlers) | Verify payments, move ledger | High — M4 |
| **New** `admin-kyc` RPC/function | Approve/reject under service role | High — M0 |
| Client `services/*` | Remove privileged writes; call functions instead | High — M0 |

### UI changes per OS

**Customer OS:** hub focused on hire pipeline; favorites; honest payment status; reviews without mocks; thinner BottomNav (Home, Search, Jobs, Bookings, Messages/More).

**Worker OS:** hub focused on requests + applications + earnings placeholder; KYC status clarity; subscription CTA; BottomNav (Home, Projects, Bookings, Messages, Profile/More).

**Shared:** design tokens (`forge-cyan` or remove references), theme-color alignment, prefer shared `Button`/`Input`, introduce Card/Modal only where interaction needs a container (not decorative card spam).

### Security strategy

- Phase 0 exit criteria are non-negotiable before M1+.
- RLS default-deny; privilege via Edge Functions + service role.
- Never reintroduce `VITE_*` secrets for FCM/Twilio/AI.
- Audit `WorkerProfileUpdate` / profile edit forms so privileged fields cannot be smuggled in PATCH bodies.

### Migration strategy

- Additive SQL only under `supabase/migrations/`.
- Expand → migrate reads → migrate writes → constrain.
- Seed/mock scripts (`supabase/seed-*.sql`) updated only when needed for local/dev; no production wipes except explicit founder-approved ops (note: `011_wipe_all_users_for_relaunch.sql` is ops, not product).

### Deploy strategy

- Continue Render static SPA + Supabase cloud.
- Deploy Edge Functions before enabling client calls that depend on them.
- Set Render env to public Vite keys only; secrets only in Supabase Function secrets.
- Use existing PWA update prompt (`UpdatePrompt` / `usePWA`) after deploys; do not cache API.

### Test strategy

- Keep Vitest property tests on services (`bookingService`, `subscriptionService`, etc.).
- Add regression tests for: illegal booking transitions, rejected client tier updates, webhook signature paths (`paystackCrypto`), notifications RLS expectations where testable.
- Manual GH/NG currency smoke: subscription plans, booking statuses, AI assistant modes.

### Rollback strategy

- Feature flags / route toggles for new OS pages; keep legacy `/dashboard/*` working.
- DB: additive tables can sit unused; avoid destructive CHECK changes without dual-write window.
- Edge Functions: redeploy previous version; webhook handlers must stay idempotent.
- SW: version bump + skipWaiting already part of update UX — ensure API routes excluded so rollback is not poisoned by stale REST cache.

### Prioritized backlog

Labels: **High** | **Medium** | **Future**

#### M0 — Security hardening — **High** (session 1) — **DONE (code)**

- [x] Remove client FCM/Twilio/AI secrets; server-only send paths — **High**
- [x] RLS: block client updates to `worker_profiles.tier` / `verified` — **High**
- [x] RLS: KYC status changes admin/service only — **High**
- [x] Subscription activation webhook-only; client cannot set `active` — **High**
- [x] Authenticate `send-push-notification` — **High**
- [x] Notifications INSERT policy fix — **High**
- [x] Stop SW caching Supabase REST — **High**
- [x] Admin KYC approve via secure RPC/function — **High**

> **Apply SQL:** run migrations `012`–`015` in Supabase SQL Editor. Redeploy Edge Functions `send-push-notification` and `paystack-webhook`.

#### M1 — Dual OS shell & navigation — **High** (session 2)

- [ ] Role-specific BottomNav / IA without removing working routes — **High**
- [ ] Evolve dashboards into OS hubs (layout + entry points only) — **High**
- [ ] Design tokens: fix cyan/theme-color; standardize Button/Input usage — **Medium**
- [ ] Shared Modal/Card primitives for real interactions — **Medium**

#### M2 — Customer OS hiring loop — **High** (session 3)

- [ ] Favorites table + UI — **Medium**
- [ ] Replace UserProfile review mocks with live data — **High**
- [ ] Hire-loop polish: search → profile → book → track (UX continuity) — **High**
- [ ] Customer notification clarity for booking FSM — **Medium**

#### M3 — Worker OS business loop — **High** (session 4)

- [ ] `job_applications` first-class + JobDetail/WorkerDashboard UX — **High**
- [ ] KYC status UX (post–secure admin) — **High**
- [ ] Portfolio/profile completeness checklist — **Medium**
- [ ] Subscription state honesty in Worker OS — **High**

#### M4 — Payments: escrow & wallet foundations — **High** (session 5)

- [ ] Additive wallet + ledger + escrow tables — **High**
- [ ] Paystack escrow fund/release via Edge/webhook only — **High**
- [ ] Booking payment_status surfacing in both OS — **High**
- [ ] Invoices MVP — **Medium**
- [ ] Re-enable onboarding fee only if product requires — **Future**

#### M5 — AI matching & assistants — **Medium** (session 6)

- [ ] `ai-chat` modes: customer / worker / general — **High**
- [ ] Matching shortlist endpoints or RPC + UI slots — **High**
- [ ] Recommendations using skills/geo/history — **Medium**
- [ ] Fraud rules v1 (non-LLM) — **Medium**

#### M6 — Analytics, disputes, polish — **Medium** (session 7+)

- [ ] `analytics_events` + retire sole reliance on localStorage — **Medium**
- [ ] Disputes table + OS surfaces — **Medium**
- [ ] Admin users tab beyond placeholder — **Medium**
- [ ] OTP auth if still required — **Future**
- [ ] Availability calendar / service radius — **Future**

### Explicit rule for execution

> **Each milestone = a new agent / engineering session.**  
> Do not one-shot implement M0–M6 in a single pass.  
> **Preserve working features** (search, bookings FSM, messaging, dual dashboards, subscriptions UX).  
> **Extend, do not rewrite** the marketplace.  
> Land Phase 0 before any milestone that adds money movement or privileged AI tools.

---

## Approval gate

**Phase 6 (implementation of this roadmap) starts ONLY after the founder explicitly approves this document** (`docs/FORGE-OS-ROADMAP.md`).

Until approval:

- No Customer OS / Worker OS product feature build from this plan.
- Security hotfixes (Phase 0 / M0) may proceed if the founder prioritizes them independently — they are prerequisites, not optional OS scope.
- Marketing copy must not claim live escrow, wallet, or push reliability until the corresponding milestones ship.

**Approval checklist (founder):**

1. Accept Phase 0 as a hard gate.  
2. Accept dual-OS-on-one-backend (no rewrite).  
3. Accept milestone session model (M0→M6).  
4. Accept honest payments narrative until M4.  
5. Reply with approval (or requested edits) to unlock Phase 6 implementation sessions.

---

*End of roadmap — discovery synthesis only; no product code in this change.*
