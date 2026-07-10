# Forge Marketplace - Security Architecture Case Study

## Executive Summary

Forge is a localized service marketplace platform connecting skilled workers and customers in Ghana and Nigeria. This document provides a comprehensive security analysis for the cybersecurity team to understand the system architecture and build appropriate security controls.

---

## 1. System Overview

### 1.1 Purpose
A premium, localized service marketplace facilitating connections between professionals (electricians, plumbers, developers, etc.) and customers seeking their services.

### 1.2 Geographic Scope
- **Primary Markets**: Ghana (GH) and Nigeria (NG)
- **Currencies**: GHS (Ghanaian Cedi) and NGN (Nigerian Naira)

### 1.3 Key Features
- Dual AI Integration (Google Gemini cloud + Ollama local)
- Localized payments with Paystack
- Real-time chat/messaging
- Worker KYC verification system
- Progressive Web App (PWA) with offline support

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Web App   │  │ Mobile App  │  │   Desktop   │              │
│  │  (React)    │  │   (PWA)     │  │   Browser   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REVERSE PROXY / API GATEWAY                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     Vite Dev Server                        │  │
│  │  - /ollama → Ollama Proxy (port 11434)                     │  │
│  │  - Proxy error handling for Ollama availability            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Auth/Authz  │  │   Payment   │  │    Chat     │              │
│  │   (Supabase)│  │  (Paystack) │  │   (Supabase)│              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Booking   │  │  AI Service │  │ Monitoring  │              │
│  │   (Supabase)│  │ (Gemini/Ollama)│ (Sentry)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Supabase Postgres                       │  │
│  │  - profiles, worker_profiles, jobs, bookings,              │  │
│  │  - messages, conversations, transactions,                │  │
│  │  - verification_documents, notifications,                  │  │
│  │  - device_tokens                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Security Implications |
|-------|------------|----------------------|
| Frontend | React 19, Vite, Tailwind CSS | Client-side validation, XSS prevention |
| Backend-as-a-Service | Supabase (PostgreSQL, Auth) | Row Level Security, JWT authentication |
| Authentication | Supabase Auth, Google OAuth | Token-based auth, session management |
| Payments | Paystack | PCI-DSS compliance, webhook security |
| AI Services | Google Gemini, Ollama | API key management, data privacy |
| Monitoring | Sentry | Error tracking, security event logging |
| Infrastructure | PWA, Service Workers | Offline data storage, cache security |

---

## 3. Data Architecture

### 3.1 Entity Relationship Diagram

```
┌─────────────┐       ┌────────────────┐
│  profiles   │──────▶│ worker_profiles│
└─────────────┘       └────────────────┘
      │                      │
      ▼                      ▼
┌─────────────┐       ┌─────────────┐  ┌─────────────┐
│    jobs     │──────▶│  bookings   │──▶│   reviews   │
└─────────────┘       └─────────────┘  └─────────────┘
      │                      │
      ▼                      ▼
┌─────────────┐       ┌─────────────┐  ┌─────────────┐
│ conversations│──────▶│  messages   │  │transactions │
└─────────────┘       └─────────────┘  └─────────────┘
      │                      │
      ▼                      ▼
┌─────────────┐       ┌─────────────┐  ┌─────────────┐
│notifications│       │device_tokens│  │ verif_docs  │
└─────────────┘       └─────────────┘  └─────────────┘
```

### 3.2 Core Tables & Security Considerations

| Table | Purpose | Security Concerns |
|-------|---------|-------------------|
| `profiles` | User metadata, roles, location | PII, role escalation |
| `worker_profiles` | Professional data, rates, skills | Financial data exposure |
| `jobs` | Customer service postings | Location data, budget info |
| `bookings` | Service engagement lifecycle | Financial transactions |
| `messages` | Real-time chat | Message confidentiality |
| `transactions` | Payment records | Financial fraud, PCI-DSS |
| `verification_documents` | KYC documents | Sensitive document storage |
| `device_tokens` | Push notifications | Token hijacking |

---

## 4. Authentication & Authorization

### 4.1 Authentication Flow

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   User  │    │Frontend  │    │ Supabase │    │Database  │
└───┬─────┘    └────┬─────┘    └───┬──────┘    └────┬─────┘
    │               │               │                │
    │ Signup        │               │                │
    │──────────────▶│               │                │
    │               │               │                │
    │               │ SignUp()      │                │
    │               │──────────────▶│                │
    │               │               │                │
    │               │               │ Create Profile │
    │               │               │ Trigger        │
    │               │               │───────────────▶│
    │               │               │                │
    │ Response      │               │                │
    │◀──────────────│◀──────────────│                │
    │               │               │                │
    │ Redirect      │               │                │
    │◀──────────────│               │                │
```

### 4.2 OAuth Integration (Google)

- **Redirect URI**: `http://localhost:3000/auth/callback` (dev)
- **Metadata Storage**: Role, country stored in localStorage before redirect
- **Security Consideration**: localStorage is accessible to XSS attacks

### 4.3 Session Management

- **JWT Tokens**: Supabase provides `access_token` and `refresh_token`
- **Session Persistence**: Browser storage (localStorage/sessionStorage)
- **Token Refresh**: Automatic via Supabase client

### 4.4 Role-Based Access Control

```typescript
export type UserRole = 'worker' | 'customer' | 'admin';
```

| Role | Permissions |
|------|-------------|
| customer | Create jobs, book workers, leave reviews |
| worker | Post availability, accept bookings, complete jobs |
| admin | Full system access, user management, verification approval |

---

## 5. Security Controls

### 5.1 Row Level Security (RLS)

Implemented via Supabase PostgreSQL policies:

```sql
-- Profiles: Publicly viewable, owner-editable
CREATE POLICY "Users can update own profile" ON profiles 
FOR UPDATE USING (auth.uid() = id);

-- Messages: Only sender/recipient can view
CREATE POLICY "Users can view messages in their conversations" ON messages
FOR SELECT USING (EXISTS (
  SELECT 1 FROM conversations 
  WHERE id = messages.conversation_id 
  AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
));

-- Bookings: Only participants can access
CREATE POLICY "Users can view own bookings" ON bookings
FOR SELECT USING (auth.uid() = worker_user_id OR auth.uid() = customer_user_id);
```

### 5.2 Input Validation

| Layer | Technology | Implementation |
|-------|------------|----------------|
| Frontend | Zod | Schema validation for forms, passwords |
| Backend | PostgreSQL | CHECK constraints, NOT NULL, type safety |

### 5.3 Payment Security

#### 5.3.1 Webhook Verification

```typescript
// HMAC-SHA512 signature verification
export function verifyPaystackSignature(
  payload: string,
  signature: string,
  secretKey?: string
): boolean
```

- **Signature Algorithm**: HMAC-SHA512
- **Constant-time comparison**: Prevents timing attacks
- **Error handling**: Graceful failure for invalid signatures

#### 5.3.2 Payment Flow

1. Client requests payment initialization
2. Paystack popup opens (client-side)
3. Webhook receives payment event
4. Server verifies signature
5. Database updates payment status

### 5.4 Document Verification System

#### 5.4.1 Document Types

```typescript
export type DocumentType = 'government_id' | 'skill_certificate' | 'selfie';
export type VerificationDocStatus = 'pending' | 'approved' | 'rejected';
```

#### 5.4.2 Verification Workflow

```
User Uploads → Status: pending → Admin Review → 
  ├── Approve → worker_profile.verified = true
  └── Reject → worker_profile.verified = false
```

### 5.5 AI Service Security

#### 5.5.1 Provider Abstraction

```typescript
export type AIProvider = 'gemini' | 'ollama';
```

- **Local (Ollama)**: Data stays on-premises
- **Cloud (Gemini)**: External API with key management

#### 5.5.2 Fallback Mechanism

- If Ollama fails, automatically falls back to Gemini
- Provider status checking before request

---

## 6. Data Flow Security

### 6.1 Authentication Data Flow

```
User Credential
      │
      ▼
┌─────────────┐
│   Client    │ (Frontend validation)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Supabase    │ (JWT generation, password hashing)
│ Auth        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │ (Profile creation via trigger)
│ Database    │
└─────────────┘
```

### 6.2 Payment Data Flow

```
User Payment
      │
      ▼
┌─────────────┐
│ Paystack    │ (Client-side popup, PCI-DSS)
│ Inline JS   │
└──────┬──────┘
       │ Webhook
       ▼
┌─────────────┐
│ Webhook     │ (Signature verification)
│ Handler     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Database    │ (Transaction logging)
└─────────────┘
```

### 6.3 Chat Data Flow

```
Message Send
      │
      ▼
┌─────────────┐
│ Frontend    │ (Input validation, rate limiting)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Supabase    │ (RLS enforced)
│ Realtime    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Recipient   │ (Push notification)
└─────────────┘
```

---

## 7. Security Considerations & Recommendations

### 7.1 Critical Security Areas

| Area | Risk | Mitigation |
|------|------|------------|
| Authentication | Session hijacking | JWT with short expiry, secure cookies |
| Payments | Fraud, chargebacks | Webhook verification, transaction logging |
| Documents | Data breach | Encrypted storage, access logging |
| Chat | Message interception | End-to-end encryption consideration |
| AI API Keys | Key exposure | Environment variables, key rotation |

### 7.2 Identified Risks

1. **PII Exposure**: Phone numbers, locations in profiles
2. **Financial Data**: Transaction records, payment metadata
3. **Document Storage**: KYC documents in storage buckets
4. **XSS/CSRF**: Client-side vulnerabilities
5. **Rate Limiting**: No explicit rate limiting on API endpoints

### 7.3 Recommended Security Enhancements

#### 7.3.1 Immediate Actions

- [ ] Implement rate limiting on authentication endpoints
- [ ] Add Content Security Policy (CSP) headers
- [ ] Enable HTTP Strict Transport Security (HSTS)
- [ ] Implement secure session management (httpOnly cookies)

#### 7.3.2 Medium-term Actions

- [ ] End-to-end encryption for chat messages
- [ ] Audit logging for sensitive operations
- [ ] Two-factor authentication for admin accounts
- [ ] Data encryption at rest for sensitive fields

#### 7.3.3 Long-term Actions

- [ ] Penetration testing
- [ ] Security headers audit
- [ ] Compliance audit (PCI-DSS, GDPR-like requirements)
- [ ] Bug bounty program

---

## 8. Environment Configuration

### 8.1 Required Environment Variables

```env
# Supabase (Authentication & Database)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Services
VITE_GEMINI_API_KEY=your_gemini_key
VITE_AI_PROVIDER=ollama  # or 'gemini'

# Payments (if client-side needed)
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key

# Monitoring
SENTRY_AUTH_TOKEN=your_sentry_token
```

### 8.2 Supabase Configuration

Required providers:
- Email/Password auth
- Phone auth
- Google OAuth

Required storage buckets:
- `avatars` - User profile pictures
- `job-media` - Job posting images
- `verification-documents` - KYC documents

---

## 9. Third-Party Integrations

### 9.1 Supabase

- **Services Used**: Auth, PostgreSQL, Storage, Realtime
- **Security Model**: JWT-based, RLS policies
- **Compliance**: SOC 2, ISO 27001 certified infrastructure

### 9.2 Paystack

- **Services Used**: Payment processing, Webhooks
- **Compliance**: PCI-DSS Level 1
- **Security**: HMAC webhook verification required

### 9.3 Google Gemini

- **Services Used**: AI text generation
- **Security**: API key authentication
- **Data**: Text-only, no persistent storage

### 9.4 Sentry

- **Services Used**: Error tracking, performance monitoring
- **Security**: Source map upload (source maps deleted after upload)
- **Data**: Error messages, stack traces

---

## 10. Operational Security

### 10.1 Logging

- **Error Logging**: Sentry integration
- **Transaction Logging**: All payments logged to `transactions` table
- **Audit Trail**: Timestamps on all sensitive operations

### 10.2 Monitoring

- **Error Tracking**: Sentry for frontend/backend errors
- **Performance**: Vite bundle analysis
- **Uptime**: Supabase managed infrastructure

### 10.3 Incident Response

- **Error Handling**: Structured error responses
- **Transaction Rollback**: Database constraints prevent orphaned data
- **User Notification**: Real-time notifications for critical events

---

## 11. Appendices

### 11.1 Database Schema Reference

See `supabase-schema.sql` for complete schema with RLS policies.

### 11.2 API Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/signup` | POST | No | User registration |
| `/auth/signin` | POST | No | User login |
| `/auth/callback` | GET | No | OAuth callback |
| `/jobs` | GET/POST | Yes | Job CRUD |
| `/bookings` | GET/POST | Yes | Booking management |
| `/messages` | GET/POST | Yes | Chat messaging |
| `/webhook/paystack` | POST | No* | Payment webhook |
| `/ai/chat` | POST | Yes | AI assistant |

*Note: Webhook requires signature verification, not user auth.

### 11.3 Security Contacts

- **Platform Security**: Review RLS policies in `supabase-schema.sql`
- **Payment Security**: Review `paymentWebhookService.ts`
- **Authentication Security**: Review `authService.ts`
- **Document Security**: Review `verificationService.ts`