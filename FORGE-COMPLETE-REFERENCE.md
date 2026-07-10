# FORGE Marketplace — Complete Project Reference

## 1. PROJECT OVERVIEW

**Forge** is a premium localized service marketplace connecting skilled workers and customers in Ghana (GH) and Nigeria (NG). Built as a React 19 SPA with Supabase backend.

### Core Features
- Dual-role system (Customer / Worker) with role-based dashboards
- Manual auth (email/phone + password) + Google OAuth
- Phone OTP verification via Supabase/Twilio/Africa's Talking
- Paystack payment integration (GHS/NGN currencies)
- Worker onboarding with ₵10 fee gate
- Subscription tiers (Free/Basic/Premium) with local pricing
- Real-time chat (Supabase Realtime)
- Booking lifecycle (PENDING → ACCEPTED → IN_PROGRESS → COMPLETED → REVIEWED)
- AI assistant (Ollama local + Gemini cloud fallback)
- Worker search with composite ranking algorithm
- KYC document verification system
- PWA with offline support
- Sentry error monitoring
- Property-based testing (fast-check + vitest)

---

## 2. TECH STACK

| Layer | Technology |
|-------|------------|
| UI | React 19, TypeScript 5.8 |
| Styling | Tailwind CSS 4 (custom forge-* tokens) |
| Icons | lucide-react |
| Animations | framer-motion |
| Forms | react-hook-form + zod + @hookform/resolvers |
| Routing | react-router-dom v7 |
| Auth/DB | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Payments | @paystack/inline-js |
| AI | @google/genai (Gemini 2.0 Flash) + Ollama (Gemma 3 4B) |
| Monitoring | @sentry/react |
| Build | Vite 6 + vite-plugin-pwa + vite-imagetools |
| Testing | vitest + fast-check + @testing-library/react |
| Path Alias | `@/` → project root |

---

## 3. DIRECTORY STRUCTURE

```
forge/
├── App.tsx                    # Root app: routing, providers, layout
├── index.tsx                  # Entry point
├── constants.ts               # App constants
├── types.ts                   # Core TypeScript interfaces (User, WorkerProfile, etc.)
├── package.json               # Dependencies & scripts
├── vite.config.ts             # Build config (PWA, Sentry, proxy, chunking)
├── tailwind.config.js         # Tailwind theme (forge colors, fonts)
├── postcss.config.js          # PostCSS config
├── tsconfig.json              # TypeScript config
├── vitest.config.ts           # Test runner config
├── .env.local                 # Live secrets (gitignored)
├── .env.local.example         # Template
├── metadata.json              # Project metadata
├── types/
│   ├── database.ts            # Full DB type definitions (Row/Insert/Update)
│   └── payment.ts             # Paystack payment types
├── services/
│   ├── supabase.ts            # Client init
│   ├── authService.ts         # Signup, login, OAuth, OTP
│   ├── bookingService.ts      # Booking lifecycle state machine
│   ├── chatService.ts         # Conversations, messages, read receipts
│   ├── jobService.ts          # Job CRUD + search
│   ├── workerService.ts       # Worker profiles + ranking algorithm
│   ├── reviewService.ts       # Reviews + rating calculation
│   ├── notificationService.ts # In-app + FCM push notifications
│   ├── subscriptionService.ts # Tier management + expiry
│   ├── paymentWebhookService.ts # Paystack webhook verification
│   ├── paystackService.ts     # Client-side payment init
│   ├── verificationService.ts # KYC document management
│   ├── aiService.ts           # AI provider abstraction + fallback
│   ├── geminiService.ts       # Gemini 2.0 Flash
│   ├── ollamaService.ts       # Ollama Gemma 3
│   ├── smsService.ts          # OTP via Twilio / Africa's Talking
│   ├── monitoringService.ts   # Sentry integration
│   ├── serviceWorker.ts       # PWA registration
│   └── databaseErrors.ts      # Structured error types
├── context/
│   └── AuthContext.tsx         # Auth state provider
├── hooks/
│   ├── useAnalytics.ts        # Page tracking
│   ├── useOnlineStatus.ts     # Network state
│   └── usePWA.ts              # PWA update lifecycle
├── components/ (13)
│   ├── AIChat.tsx             # Floating AI chatbot
│   ├── BookingModal.tsx       # 4-step booking + payment
│   ├── Button.tsx             # 4 variants, 3 sizes
│   ├── ErrorBoundary.tsx      # React error boundary
│   ├── Input.tsx              # Labeled input w/ icon + error
│   ├── Navigation.tsx         # TopNav (desktop) + BottomNav (mobile)
│   ├── OfflineIndicator.tsx   # Online/offline banners
│   ├── PageTransition.tsx     # Framer Motion wrapper
│   ├── PasswordStrengthMeter.tsx # Password requirements checklist
│   ├── PaymentGateModal.tsx   # Non-dismissible onboarding fee gate
│   ├── ShareTools.tsx         # SVG business card + QR + download
│   ├── UpdatePrompt.tsx       # PWA update notification
│   └── WorkerCard.tsx         # Worker search result card
├── pages/ (21)
│   ├── Home.tsx               # Landing page
│   ├── Dashboard.tsx          # Combined legacy dashboard
│   ├── WorkerSearch.tsx       # Search with filters + ranking
│   ├── WorkerProfile.tsx      # Public worker profile
│   ├── UserProfile.tsx        # Own profile (3 tabs)
│   ├── ProfileEdit.tsx        # Edit profile form
│   ├── Jobs.tsx               # Browse + Create + My Jobs
│   ├── JobDetail.tsx          # Single job view + media gallery
│   ├── Bookings.tsx           # Booking list with status filters
│   ├── Messages.tsx           # Chat UI
│   ├── Subscription.tsx       # Plans + Paystack payment
│   ├── auth/Login.tsx         # Password or OTP login
│   ├── auth/Signup.tsx        # 4-step wizard
│   ├── auth/AuthCallback.tsx  # OAuth redirect handler
│   ├── auth/ForgotPassword.tsx
│   ├── auth/ResetPassword.tsx
│   ├── auth/WorkerOnboarding.tsx # 3-step worker setup
│   ├── auth/OnboardingPayment.tsx # ₵10 fee payment
│   ├── dashboard/CustomerDashboard.tsx
│   ├── dashboard/WorkerDashboard.tsx
│   └── admin/AdminDashboard.tsx
├── utils/
│   ├── analytics.ts           # localStorage event queue
│   ├── crypto.ts              # PBKDF2 (frontend)
│   ├── cssPurge.ts            # Unused CSS removal
│   ├── imageOptimization.ts   # Compression estimation
│   ├── logger.ts              # localStorage log buffer
│   └── rateLimiter.ts         # Sliding window (3 presets)
├── tests/
│   ├── setup.ts               # Vitest globals + localStorage mock
│   └── systemIntegration.test.ts # E2E with in-memory DB mock
├── supabase/
│   ├── supabase-schema.sql    # Full schema + RLS + triggers + indexes
│   ├── seed-categories.sql    # 17 service categories
│   └── seed-mock-data.sql     # 4 workers + 2 customers + sample data
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── offline.html           # Offline fallback page
│   ├── logo.png               # App logo
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
├── .kiro/specs/               # Design specifications
│   ├── backend-services/      # design.md, requirements.md, tasks.md
│   ├── infrastructure-enhancements/
│   └── ollama-proxy-fix/
├── workflows/                 # WAT framework (empty)
└── tools/                     # WAT framework (empty)
```

---

## 4. ROUTING STRUCTURE

| Route | Component | Access |
|-------|-----------|--------|
| `/` | Home | Public |
| `/auth/login` | Login | Public |
| `/auth/signup` | Signup | Public |
| `/auth/auth-callback` | AuthCallback | Public (OAuth) |
| `/auth/forgot-password` | ForgotPassword | Public |
| `/auth/reset-password` | ResetPassword | Public |
| `/search` | WorkerSearch | Public |
| `/profile/:id` | WorkerProfile | Public |
| `/pro/:username` | WorkerProfile | Public |
| `/dashboard` | DashboardRedirect | Protected |
| `/dashboard/customer` | CustomerDashboard | Customer |
| `/dashboard/worker` | WorkerDashboard | Worker (active) |
| `/messages` | Messages | Protected |
| `/jobs` | Jobs | Protected |
| `/jobs/:id` | JobDetail | Protected |
| `/my-jobs` | Jobs | Protected |
| `/bookings` | Bookings | Protected |
| `/subscription` | Subscription | Protected |
| `/notifications` | DashboardRedirect | Protected |
| `/my-profile` | UserProfile | Protected |
| `/profile/edit` | ProfileEdit | Protected |
| `/auth/onboarding` | WorkerOnboarding | Protected |
| `/auth/onboarding/payment` | OnboardingPayment | Protected (pending_payment) |
| `/admin` | AdminDashboard | Admin only |

### Route Guards
- **ProtectedRoute**: Redirects to `/auth/login` if not authenticated
- **CustomerRoute**: Redirects workers to `/dashboard/worker`
- **WorkerRoute**: Redirects non-workers to `/dashboard/customer`, pending_payment to `/auth/onboarding/payment`, incomplete profile to `/auth/onboarding`
- **AdminRoute**: Redirects non-admins to `/dashboard`

---

## 5. DATABASE SCHEMA (16 Tables)

### Core Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User metadata, roles, location | id (PK → auth.users), role, worker_status, country, specialties |
| `worker_profiles` | Professional data | user_id (FK → profiles), hourly_rate_min/max, tier, skills[], verified |
| `jobs` | Customer job postings | poster_user_id (FK), category, status, budget_min/max, location_lat/lng |
| `bookings` | Service engagements | job_id, worker_user_id, customer_user_id, status (state machine) |
| `reviews` | Worker ratings | booking_id, worker_id, author_id, rating (1-5), text |

### Supporting Tables
| Table | Purpose |
|-------|---------|
| `service_categories` | Dynamic category list (name, slug, icon) |
| `subscriptions` | Worker tier subscriptions with expiry |
| `transactions` | Payment records (subscription, booking, refund) |
| `conversations` | Chat thread participants |
| `messages` | Chat messages with read_at |
| `notifications` | In-app notifications (8 types) |
| `device_tokens` | FCM push notification tokens |
| `verification_documents` | KYC documents (government_id, skill_certificate, selfie) |
| `worker_payments` | Onboarding fee payments |
| `worker_portfolios` | Worker project showcase |
| `worker_endorsements` | Peer endorsements |

### RLS Policies
RLS enabled on all tables. Key policies:
- **profiles**: Public SELECT, owner UPDATE/INSERT
- **bookings**: SELECT only for participants (worker_user_id OR customer_user_id)
- **messages**: SELECT only if user is conversation participant
- **conversations**: SELECT only if user is participant_1 OR participant_2
- **notifications**: owner only
- **subscriptions**: owner only
- **worker_profiles**: Public SELECT, owner INSERT/UPDATE

### Trigger: `handle_new_user()`
Auto-creates `profiles` row on `auth.users` INSERT. Maps metadata (firstName, lastName, role, country, username, phone).

### Indexes (9 B-tree/GIN)
- `idx_worker_profiles_country`, `idx_worker_profiles_skills` (GIN)
- `idx_jobs_status`, `idx_jobs_country`, `idx_jobs_category`
- `idx_bookings_worker`, `idx_bookings_customer`
- `idx_messages_conversation`
- `idx_notifications_user`

---

## 6. AUTHENTICATION FLOW

### Signup (Email/Password)
1. Role selection (Worker/Customer)
2. Details form (name, email, phone, country, avatar)
3. Worker only: Subscription plan selection
4. Phone OTP verification (6-digit, auto-focus inputs)
5. Password creation (strength meter: 8+ chars, upper, lower, number, special)
6. `authService.signUp()` → Supabase Auth → trigger creates profile → worker gets `pending_payment`

### Signup (Google OAuth)
1. Role selection → Google OAuth → redirected to Google
2. Role + country stored in localStorage pre-redirect
3. Callback: `completeOAuthSignup()` reads stored values, creates profile

### Login
- **Password mode**: Email or phone + password (auto-detect via `@`)
- **OTP mode**: Phone + country → Supabase OTP → 6-digit code verification
- Smart redirect: Based on role, profile completion, worker payment status

### Session Management
- JWT tokens via Supabase (`access_token` + `refresh_token`)
- `autoRefreshToken: true`, `persistSession: true`
- `AuthContext` provides `user`, `login`, `logout`, `refreshUser`, `isAuthenticated`, `isLoading`
- `onAuthStateChange` subscribes to SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED

---

## 7. PAYMENT FLOW

### Booking Payment
1. `BookingModal` opens → user selects hours, sees total
2. `paystackService.initializePayment()` → loads Paystack inline script → opens popup
3. Paystack processes → sends webhook to server
4. `paymentWebhookService.verifyPaystackSignature()` (HMAC-SHA512, constant-time)
5. `handlePaystackWebhook()` routes by event type
6. Transaction logged via `logTransaction()`

### Worker Onboarding Fee (₵10 / ₦2,000)
1. Worker signs up → `worker_status: pending_payment`
2. `PaymentGateModal` blocks dashboard (non-dismissible)
3. Paystack mobile money payment → webhook → `handleOnboardingPayment()` → sets `worker_status: active`

### Subscription Payment
1. User selects plan (Free/Basic/Premium)
2. Paystack popup → webhook → `handleSubscriptionPayment()` → extends by 30 days
3. `handleSubscriptionExpiry()` batch processes expired → resets tier to `free`

### Pricing
| Tier | Ghana (GHS) | Nigeria (NGN) |
|------|-------------|---------------|
| Free | 0 | 0 |
| Basic | 20 | 2,000 |
| Premium | 50 | 5,000 |

---

## 8. WORKER RANKING ALGORITHM

Composite score (`searchWorkersRanked`):

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Tier | 0.25 | premium: 1.0, basic: 0.6, free: 0.3 |
| Rating | 0.25 | rating / 5 (normalized 0-1) |
| Distance | 0.15 | Haversine → e^(-dist/100km) |
| Activity | 0.10 | 0.1 if logged in within 7 days |
| Completion | 0.15 | completed / accepted (default 0.5) |
| Response | 0.10 | Inverse of normalized response time (0-120 min) |

---

## 9. AI INTEGRATION

### Architecture
```
aiService.ts (abstraction, fallback logic)
  ├── geminiService.ts (gemini-2.0-flash)
  └── ollamaService.ts (gemma3:4b local)
```

- Default provider: Ollama (local, free, private)
- Fallback: If Ollama fails → tries Gemini
- Rate limit: Shared `aiLimiter` (10 req/min)
- Ollama proxied via Vite (`/ollama` → `http://127.0.0.1:11434`)
- **Known bug**: Ollama proxy returns HTTP 500 (missing Vite proxy config fix)
- Gemini has optional Google Search grounding (web citations)
- AI assistant available as floating chatbot (`AIChat` component)

---

## 10. BOOKING STATE MACHINE

```
PENDING ──→ ACCEPTED ──→ IN_PROGRESS ──→ COMPLETED ──→ REVIEWED
  │             │              │
  └──→ CANCELLED ←──┴──────────────┘
```

Validated by `isValidTransition(current, new)` in bookingService.

---

## 11. KEY SERVICES SUMMARY

| Service | Responsibility |
|---------|---------------|
| `supabase.ts` | Client init with typed `Database` schema |
| `authService.ts` | Signup, login, OAuth, OTP, profile CRUD |
| `bookingService.ts` | Booking lifecycle state machine |
| `chatService.ts` | Conversations, cursor-paginated messages, read receipts, unread counts |
| `jobService.ts` | Job CRUD, search with category/location/country/budget filters |
| `workerService.ts` | Profile CRUD, search, composite ranking, portfolio/endorsements |
| `reviewService.ts` | Create review (validates completed booking), update rating |
| `notificationService.ts` | In-app + FCM push, device token management |
| `subscriptionService.ts` | Plans, create/cancel, expiry batch processing |
| `paymentWebhookService.ts` | HMAC-SHA512 verification, event routing, transaction logging |
| `paystackService.ts` | Client-side Paystack popup, currency formatting |
| `verificationService.ts` | KYC document upload, approve/reject workflow |
| `aiService.ts` | Provider abstraction with fallback |
| `geminiService.ts` | Gemini 2.0 Flash with optional search grounding |
| `ollamaService.ts` | Ollama chat + health check + model listing |
| `smsService.ts` | OTP generation, Twilio/Africa's Talking, phone formatting |
| `monitoringService.ts` | Sentry init, error capture, transaction, sensitive data redaction |
| `serviceWorker.ts` | PWA registration with callbacks |
| `databaseErrors.ts` | Structured DatabaseError mapping Supabase codes → user-friendly messages |

---

## 12. UTILITIES

| Utility | Purpose |
|---------|---------|
| `analytics.ts` | Client analytics queue (localStorage, max 500 events) |
| `crypto.ts` | PBKDF2 password hashing (Web Crypto API, 100K iterations) |
| `cssPurge.ts` | Extracts/removes unused CSS selectors |
| `imageOptimization.ts` | Compression ratio estimates, imagetools URL builder |
| `logger.ts` | Client logging (console + localStorage, max 100 entries) |
| `rateLimiter.ts` | Sliding window (apiLimiter: 30/min, authLimiter: 5/5min, aiLimiter: 10/min) |

---

## 13. PWA CONFIGURATION

- **Plugin**: `vite-plugin-pwa` with Workbox
- **Manifest**: standalone display, #FF6B2E theme, portrait-primary
- **Precache**: `**/*.{js,css,html,svg,png,ico,woff,woff2}`
- **Offline fallback**: `/offline.html`
- **Runtime caching**:
  - Supabase REST API: StaleWhileRevalidate (24h, 100 entries)
  - Google Fonts: CacheFirst (1 year, 10 entries)
  - Images: CacheFirst (30 days, 50 entries)
- **Notes**: PWA update prompt via `UpdatePrompt` component, offline indicator via `OfflineIndicator`

---

## 14. TESTING

### Framework: vitest + fast-check (property-based) + @testing-library/react

**~180 test cases across 20 test files, 48 numbered properties:**

| Domain | Test File | Properties |
|--------|-----------|------------|
| Auth | `authService.property.test.ts` | Registration round-trip, login session |
| Workers | `workerService.property.test.ts` | Profile persistence, search, DB errors, RLS, ranking (largest file) |
| Jobs | `jobService.property.test.ts` | Deletion, search, poster query |
| Bookings | `bookingService.property.test.ts` | Creation, state transitions, queries |
| Chat | `chatService.property.test.ts` | Conversations, messages, pagination, read receipts |
| Reviews | `reviewService.property.test.ts` | Creation, pagination, eligibility, rating update |
| Subscriptions | `subscriptionService.property.test.ts` | Plans, creation, cancellation, status, expiry |
| Payments | `paystackService.property.test.ts` | References, currency, booking payment (19 tests) |
| Webhooks | `paymentWebhookService.property.test.ts` | Signature verification, event routing |
| Notifications | `notificationService.property.test.ts` | Creation, query, read, device tokens |
| Verification | `verificationService.property.test.ts` | Upload, status, approve/reject |
| Monitoring | `monitoringService.property.test.ts` | Error capture, transactions, data filtering |
| Service Worker | `serviceWorker.property.test.ts` | Cache strategies |
| Ollama | `ollamaService.property.test.ts` | **3 failing tests** documenting HTTP 500 bug |
| Types | `database.property.test.ts` | Round-trip serialization |
| Crypto | `crypto.property.test.ts` | Password hash round-trip |
| CSS | `cssPurge.property.test.ts` | Purge effectiveness |
| Images | `imageOptimization.property.test.ts` | Optimization output |
| Logger | `logger.test.ts` (example-based) | 7 standard tests |
| Rate Limiter | `rateLimiter.test.ts` (example-based) | 6 tests with fake timers |
| Integration | `systemIntegration.test.ts` | E2E with in-memory DB mock (4 tests) |
| Supabase Client | `supabase.property.test.ts` | Client init (3 tests) |

### Known Bug
- **Ollama proxy HTTP 500**: `/ollama/api/tags` and `/ollama/api/chat` return 500 due to missing Vite proxy configuration. 3 tests document this failure.

---

## 15. ENVIRONMENT VARIABLES

```env
# Required
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>

# AI (at least one)
VITE_AI_PROVIDER=ollama|gemini
VITE_GEMINI_API_KEY=<key>
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=gemma3:4b

# Payments
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxxx

# Monitoring (optional)
VITE_SENTRY_DSN=<dsn>
SENTRY_AUTH_TOKEN=<token>
SENTRY_ORG=intelligent-systems-inc
SENTRY_PROJECT=forge-web

# SMS (one of)
VITE_TWILIO_ACCOUNT_SID=VAxxxx
VITE_TWILIO_AUTH_TOKEN=<token>
VITE_TWILIO_PHONE_NUMBER=+233xxxx
VITE_AT_API_KEY=<key>
VITE_AT_USERNAME=<username>
```

---

## 16. KNOWN ISSUES & GAPS

1. **Ollama proxy broken** — HTTP 500 on `/ollama/*` endpoints (test file documents this)
2. **Manifest icon mismatch** — `manifest.json` references `/logo.png` but only SVGs exist in `public/icons/`
3. **No storage bucket SQL** — `avatars`, `job-media`, `verification-documents` buckets need manual Supabase setup
4. **`worker_payments` table has no RLS policies**
5. **`profiles.country` has no CHECK constraint** (defaults to 'GH' but allows invalid values)
6. **`.env.local` contains live secrets** — Supabase anon key, Paystack test key, Twilio creds, Gemini API key, Sentry DSN/token — should not be committed
7. **Workflows/ and tools/ directories are empty** — WAT framework not populated yet
8. **Country detection** — `profiles` table lacks CHECK constraint unlike all other tables
9. **Type coverage gap** — `types.ts` has a simpler `User` interface but `types/database.ts` has the full generated types
