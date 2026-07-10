# Forge Marketplace - Threat Model & Security Controls

## STRIDE Threat Model

### 1. Spoofing
| Threat | Impact | Current Controls | Recommendations |
|--------|--------|------------------|-----------------|
| Identity spoofing | Unauthorized access to user accounts | Supabase Auth, JWT tokens | Add 2FA for admin/worker accounts |
| OAuth state injection | Session hijacking | Google OAuth flow | Add CSRF tokens to OAuth flow |

### 2. Tampering
| Threat | Impact | Current Controls | Recommendations |
|--------|--------|------------------|-----------------|
| Message tampering | Privacy breach | RLS on messages table | Consider E2E encryption |
| Booking manipulation | Financial fraud | Database constraints | Add booking version/timestamp |
| Document modification | KYC bypass | Storage bucket policies | Add document integrity checks |

### 3. Repudiation
| Threat | Impact | Current Controls | Recommendations |
|--------|--------|------------------|-----------------|
| Non-repudiation of payments | Disputed transactions | Transaction logging | Add digital signatures |
| Message denial | Chat disputes | Message timestamps | Add message signing |

### 4. Information Disclosure
| Threat | Impact | Current Controls | Recommendations |
|--------|--------|------------------|-----------------|
| PII exposure | Privacy violation | RLS, limited field selection | Add field-level encryption |
| Payment data leak | Financial fraud | Paystack PCI-DSS | Regular security audits |
| Document leak | Identity theft | Storage bucket isolation | Add access logging |

### 5. Denial of Service
| Threat | Impact | Current Controls | Recommendations |
|--------|--------|------------------|-----------------|
| API overload | Service unavailability | None identified | Add rate limiting |
| Database exhaustion | Performance degradation | Supabase managed | Add connection pooling |

### 6. Elevation of Privilege
| Threat | Impact | Current Controls | Recommendations |
|--------|--------|------------------|-----------------|
| Role escalation | Unauthorized admin access | Database CHECK constraints | Add role change audit log |
| Worker status bypass | Unauthorized service provision | Verification service | Add admin approval workflow |

---

## Security Control Matrix

| Control Category | Implementation | Status | Notes |
|------------------|----------------|--------|-------|
| **Authentication** | Supabase Auth | ✅ Implemented | JWT-based, multi-provider |
| **Authorization** | Row Level Security | ✅ Implemented | PostgreSQL policies |
| **Input Validation** | Zod + PostgreSQL | ✅ Implemented | Frontend + database level |
| **Output Encoding** | React escaping | ✅ Built-in | XSS prevention |
| **Payment Security** | Paystack + Webhooks | ✅ Implemented | HMAC verification |
| **Session Management** | Supabase session | ✅ Implemented | Automatic refresh |
| **Error Handling** | Sentry + custom | ✅ Implemented | No sensitive data in errors |
| **Logging** | Sentry + Database | ✅ Implemented | Transaction audit trail |
| **Rate Limiting** | None | ❌ Missing | Recommended |
| **CSP Headers** | None | ❌ Missing | Recommended |
| **HSTS** | None | ❌ Missing | Recommended |
| **Encryption at Rest** | Supabase managed | ⚠️ Partial | Consider field-level encryption |

---

## Data Classification

| Data Type | Classification | Handling Requirements |
|-----------|----------------|----------------------|
| User ID | Internal | JWT token |
| Email | PII | Encrypted in transit |
| Phone | PII | RLS protected |
| Location | PII | RLS protected |
| Budget/Amount | Financial | PCI-DSS considerations |
| Documents | Sensitive | Encrypted storage |
| Messages | Confidential | Access logging |
| AI interactions | Internal | No PII in prompts |

---

## Compliance Considerations

### PCI-DSS (Payments)
- **Requirement 1**: Firewall - Paystack handles this
- **Requirement 2**: No card data storage - ✅ Verified
- **Requirement 3**: No card data transmission - ✅ Client-side only
- **Requirement 6**: Secure development - ✅ Implemented
- **Requirement 10**: Logging - ✅ Transaction logging

### GDPR-like (Data Privacy)
- **Data Minimization**: Only collect necessary fields
- **Right to Access**: Profiles table accessible via API
- **Right to Erasure**: CASCADE delete on profiles
- **Data Portability**: Export via Supabase

---

## Incident Response Plan

### 1. Authentication Breach
1. Force password reset for affected users
2. Invalidate all sessions
3. Review RLS policies
4. Enable 2FA

### 2. Payment Fraud
1. Suspend affected accounts
2. Review transaction history
3. Contact Paystack support
4. File chargeback dispute

### 3. Data Breach
1. Identify breach scope
2. Notify affected users
3. Reset API keys
4. Audit access logs

### 4. Document Leak
1. Revoke document access
2. Review storage bucket policies
3. Rotate storage keys
4. Implement access logging