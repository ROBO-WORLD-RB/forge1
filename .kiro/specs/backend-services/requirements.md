# Requirements Document

## Introduction

This document specifies the requirements for implementing backend services for the BlueCollar marketplace platform serving Ghana and Nigeria. The platform enables blue-collar workers to subscribe to visibility tiers (Free/Basic/Premium) and allows customers to post jobs and book workers. The services include subscription management, booking lifecycle, job postings, messaging, payment webhooks, notifications, reviews, search ranking, and worker verification.

## Glossary

- **BlueCollar System**: The marketplace platform backend services
- **Worker**: A blue-collar service provider who pays for subscription visibility
- **Customer**: A user who posts jobs and books workers (free access)
- **Subscription**: A recurring payment plan that determines worker visibility and features
- **Booking**: A service request from a customer to a worker
- **Job**: A work opportunity posted by a customer
- **Conversation**: A messaging thread between two users
- **Transaction**: A record of a payment event
- **Verification**: The KYC process for worker identity and skill validation
- **GHS**: Ghana Cedis currency
- **NGN**: Nigerian Naira currency
- **FCM**: Firebase Cloud Messaging for push notifications
- **RLS**: Row Level Security for database access control

## Requirements

### Requirement 1: Subscription & Billing Service

**User Story:** As a worker, I want to subscribe to a visibility tier, so that I can be discovered by customers and receive bookings.

#### Acceptance Criteria

1. WHEN a user requests subscription plans THEN the BlueCollar System SHALL return available tiers (Free: GHS 0/NGN 0, Basic: GHS 10/NGN 900, Premium: GHS 20/NGN 1,500) with local pricing based on country
2. WHEN a worker creates a subscription with valid payment THEN the BlueCollar System SHALL create a subscription record with status 'active' and set expiry date to 30 days from creation
3. WHEN a user queries their active subscription THEN the BlueCollar System SHALL return the subscription with current status, tier, and expiry information
4. WHEN a worker cancels their subscription THEN the BlueCollar System SHALL update the subscription status to 'cancelled' and disable auto-renewal
5. WHEN the BlueCollar System checks subscription status THEN the BlueCollar System SHALL return 'active', 'expiring' (within 7 days), or 'expired' based on expiry date
6. WHEN a subscription expires THEN the BlueCollar System SHALL update the worker's visibility to false and subscription status to 'expired'
7. WHEN serializing subscription data for storage THEN the BlueCollar System SHALL encode using JSON format
8. WHEN deserializing subscription data from storage THEN the BlueCollar System SHALL decode JSON and reconstruct the subscription object

### Requirement 2: Booking Service

**User Story:** As a customer, I want to book workers for jobs, so that I can get my work done by qualified professionals.

#### Acceptance Criteria

1. WHEN a customer creates a booking with valid job and worker IDs THEN the BlueCollar System SHALL create a booking record with status 'PENDING' and store customer message
2. WHEN a worker accepts a booking THEN the BlueCollar System SHALL update status from 'PENDING' to 'ACCEPTED' and store worker message
3. WHEN a worker starts a booking THEN the BlueCollar System SHALL update status from 'ACCEPTED' to 'IN_PROGRESS' and record start timestamp
4. WHEN a worker completes a booking THEN the BlueCollar System SHALL update status from 'IN_PROGRESS' to 'COMPLETED' and record completion timestamp
5. WHEN a user cancels a booking THEN the BlueCollar System SHALL update status to 'CANCELLED', record cancellation reason, and timestamp
6. WHEN a worker queries their bookings THEN the BlueCollar System SHALL return bookings filtered by worker ID and optional status
7. WHEN a customer queries their bookings THEN the BlueCollar System SHALL return bookings filtered by customer ID and optional status
8. WHEN a user queries booking details THEN the BlueCollar System SHALL return the booking with associated job and user information
9. WHEN a booking status transition is invalid THEN the BlueCollar System SHALL reject the operation and return an error

### Requirement 3: Job Service

**User Story:** As a customer, I want to post jobs, so that workers can find and apply for my work opportunities.

#### Acceptance Criteria

1. WHEN a customer creates a job with valid data THEN the BlueCollar System SHALL create a job record with status 'open' and store all job details
2. WHEN a customer updates a job THEN the BlueCollar System SHALL update the specified fields and record the update timestamp
3. WHEN a customer deletes a job THEN the BlueCollar System SHALL remove the job record from the database
4. WHEN a user queries a job by ID THEN the BlueCollar System SHALL return the job details including poster information
5. WHEN a user searches jobs with filters THEN the BlueCollar System SHALL return jobs matching category, location, and budget criteria
6. WHEN a customer queries their posted jobs THEN the BlueCollar System SHALL return all jobs posted by that user
7. WHEN serializing job data for storage THEN the BlueCollar System SHALL encode using JSON format
8. WHEN deserializing job data from storage THEN the BlueCollar System SHALL decode JSON and reconstruct the job object

### Requirement 4: Chat/Messaging Service

**User Story:** As a user, I want to message other users, so that I can communicate about jobs and bookings.

#### Acceptance Criteria

1. WHEN two users start a conversation THEN the BlueCollar System SHALL create a conversation record linking both participants
2. WHEN a user sends a message THEN the BlueCollar System SHALL create a message record with sender, body, and optional attachments
3. WHEN a user queries their conversations THEN the BlueCollar System SHALL return all conversations where the user is a participant
4. WHEN a user queries messages in a conversation THEN the BlueCollar System SHALL return messages with pagination support (limit and cursor)
5. WHEN a user marks messages as read THEN the BlueCollar System SHALL update the read_at timestamp for unread messages in that conversation
6. WHEN a user queries unread count THEN the BlueCollar System SHALL return the total count of unread messages across all conversations
7. WHEN serializing message data for storage THEN the BlueCollar System SHALL encode using JSON format
8. WHEN deserializing message data from storage THEN the BlueCollar System SHALL decode JSON and reconstruct the message object

### Requirement 5: Payment Webhook Service

**User Story:** As a system administrator, I want to securely process payment webhooks, so that subscription and booking payments are verified and recorded.

#### Acceptance Criteria

1. WHEN a Paystack webhook is received THEN the BlueCollar System SHALL verify the signature using HMAC-SHA512 with the secret key
2. WHEN signature verification fails THEN the BlueCollar System SHALL reject the webhook and return an error
3. WHEN a valid subscription payment event is received THEN the BlueCollar System SHALL update the subscription status and extend expiry date
4. WHEN a valid booking payment event is received THEN the BlueCollar System SHALL update the booking payment status
5. WHEN any payment event is processed THEN the BlueCollar System SHALL log a transaction record with user, type, amount, currency, provider, and status
6. WHEN serializing transaction data for storage THEN the BlueCollar System SHALL encode using JSON format
7. WHEN deserializing transaction data from storage THEN the BlueCollar System SHALL decode JSON and reconstruct the transaction object

### Requirement 6: Notification Service

**User Story:** As a user, I want to receive notifications, so that I stay informed about bookings, messages, and subscription status.

#### Acceptance Criteria

1. WHEN a push notification is triggered THEN the BlueCollar System SHALL send the notification via FCM to registered device tokens
2. WHEN an in-app notification is created THEN the BlueCollar System SHALL store the notification with type, title, body, and metadata
3. WHEN a user queries notifications THEN the BlueCollar System SHALL return notifications with optional filter for unread only
4. WHEN a user marks a notification as read THEN the BlueCollar System SHALL update the read_at timestamp
5. WHEN a user registers a device token THEN the BlueCollar System SHALL store the token with platform information (ios/android/web)
6. WHEN serializing notification data for storage THEN the BlueCollar System SHALL encode using JSON format
7. WHEN deserializing notification data from storage THEN the BlueCollar System SHALL decode JSON and reconstruct the notification object

### Requirement 7: Ratings & Reviews Service

**User Story:** As a customer, I want to review workers after completed bookings, so that other customers can make informed decisions.

#### Acceptance Criteria

1. WHEN a customer submits a review after a completed booking THEN the BlueCollar System SHALL create a review record with score (1-5) and text
2. WHEN a user queries reviews for a worker THEN the BlueCollar System SHALL return reviews with pagination support
3. WHEN a user queries reviews they have written THEN the BlueCollar System SHALL return all reviews authored by that user
4. WHEN checking review eligibility THEN the BlueCollar System SHALL verify the booking is COMPLETED and no review exists for that booking by that user
5. WHEN a review is submitted THEN the BlueCollar System SHALL recalculate and update the worker's average rating
6. WHEN a review score is outside 1-5 range THEN the BlueCollar System SHALL reject the review and return a validation error
7. WHEN a user attempts to review a non-completed booking THEN the BlueCollar System SHALL reject the review and return an error

### Requirement 8: Search Ranking Enhancement

**User Story:** As a customer, I want to see the most relevant workers first, so that I can quickly find qualified professionals.

#### Acceptance Criteria

1. WHEN searching workers THEN the BlueCollar System SHALL calculate a composite score using tier weight (Premium: 1.0, Basic: 0.6, Free: 0.3)
2. WHEN searching workers THEN the BlueCollar System SHALL include normalized rating (0-1) in the composite score
3. WHEN user location is provided THEN the BlueCollar System SHALL include inverse distance score in the composite score
4. WHEN searching workers THEN the BlueCollar System SHALL apply activity bonus for workers logged in within past 7 days
5. WHEN searching workers THEN the BlueCollar System SHALL include completion rate (completed/accepted bookings) in the composite score
6. WHEN searching workers THEN the BlueCollar System SHALL include response time factor (faster responders rank higher) in the composite score
7. WHEN returning search results THEN the BlueCollar System SHALL sort workers by composite score in descending order

### Requirement 9: Verification Service

**User Story:** As a worker, I want to verify my identity and skills, so that customers trust my profile.

#### Acceptance Criteria

1. WHEN a worker uploads a verification document THEN the BlueCollar System SHALL store the document with type (government_id/skill_certificate/selfie) and file URL
2. WHEN a user queries verification status THEN the BlueCollar System SHALL return the current verification state and document statuses
3. WHEN a worker submits documents for verification THEN the BlueCollar System SHALL update status to 'pending' for review
4. WHEN an admin approves verification THEN the BlueCollar System SHALL update document status to 'approved' and set worker verified flag to true
5. WHEN an admin rejects verification THEN the BlueCollar System SHALL update document status to 'rejected' with reason and record reviewer information
6. WHEN serializing verification document data for storage THEN the BlueCollar System SHALL encode using JSON format
7. WHEN deserializing verification document data from storage THEN the BlueCollar System SHALL decode JSON and reconstruct the document object
