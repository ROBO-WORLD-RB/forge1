# Implementation Plan

- [x] 1. Set up database types and extend existing type definitions






  - [x] 1.1 Add new types to types/database.ts

    - Add Subscription, Job, Booking, Conversation, Message, Transaction, Notification, DeviceToken, VerificationDocument interfaces
    - Add status enums: SubscriptionStatus, JobStatus, BookingStatus, NotificationType, DocumentType, VerificationDocStatus
    - Add insert and update types for each entity
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.5, 6.2, 9.1_

  - [x] 1.2 Write property test for type serialization round-trip

    - **Property 3: Subscription Round-Trip Persistence**
    - **Property 14: Job Round-Trip Persistence**
    - **Property 24: Message Round-Trip Persistence**
    - **Validates: Requirements 1.7, 1.8, 3.7, 3.8, 4.7, 4.8**

- [x] 2. Implement Subscription Service






  - [x] 2.1 Create services/subscriptionService.ts with core functions

    - Implement getSubscriptionPlans(country) with GH/NG pricing
    - Implement createSubscription(userId, planId, paymentMethod)
    - Implement getActiveSubscription(userId)
    - Implement cancelSubscription(subscriptionId)
    - Implement checkSubscriptionStatus(userId)
    - Implement handleSubscriptionExpiry()
    - Use existing Supabase client and error handling patterns
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.2 Write property tests for subscription service

    - **Property 1: Subscription Plans Return Correct Pricing by Country**
    - **Property 2: Subscription Creation Sets Active Status and 30-Day Expiry**
    - **Property 4: Subscription Cancellation Updates Status and Auto-Renew**
    - **Property 5: Subscription Status Calculation Based on Expiry Date**
    - **Property 6: Subscription Expiry Updates Worker Visibility**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6**

- [x] 3. Implement Job Service





  - [x] 3.1 Create services/jobService.ts with CRUD operations


    - Implement createJob(posterId, jobData)
    - Implement updateJob(jobId, updates)
    - Implement deleteJob(jobId)
    - Implement getJob(jobId)
    - Implement searchJobs(filters) with category, location, budget filtering
    - Implement getJobsByPoster(userId)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Write property tests for job service

    - **Property 13: Job Creation Sets Open Status**
    - **Property 15: Job Deletion Removes Record**
    - **Property 16: Job Search Returns Matching Results**
    - **Property 17: Job Query by Poster Returns Only Poster's Jobs**
    - **Validates: Requirements 3.1, 3.3, 3.5, 3.6**

- [x] 4. Implement Booking Service





  - [x] 4.1 Create services/bookingService.ts with lifecycle management


    - Implement createBooking(jobId, workerId, customerMessage)
    - Implement acceptBooking(bookingId, workerMessage)
    - Implement startBooking(bookingId)
    - Implement completeBooking(bookingId)
    - Implement cancelBooking(bookingId, reason)
    - Implement state transition validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.9_

  - [x] 4.2 Implement booking query functions

    - Implement getBookingsByWorker(workerId, status?)
    - Implement getBookingsByCustomer(customerId, status?)
    - Implement getBookingDetails(bookingId) with job and user joins
    - _Requirements: 2.6, 2.7, 2.8_

  - [x] 4.3 Write property tests for booking service

    - **Property 7: Booking Creation Sets PENDING Status**
    - **Property 8: Booking Valid State Transitions**
    - **Property 9: Booking Invalid State Transitions Rejected**
    - **Property 10: Booking Query by Worker Returns Only Worker's Bookings**
    - **Property 11: Booking Query by Customer Returns Only Customer's Bookings**
    - **Property 12: Booking Details Round-Trip**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

- [x] 5. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Chat/Messaging Service





  - [x] 6.1 Create services/chatService.ts with conversation management


    - Implement createConversation(user1Id, user2Id, bookingId?)
    - Implement sendMessage(conversationId, senderId, body, attachments?)
    - Implement getConversations(userId)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Implement message retrieval and read tracking

    - Implement getMessages(conversationId, limit?, cursor?) with pagination
    - Implement markAsRead(conversationId, userId)
    - Implement getUnreadCount(userId)
    - _Requirements: 4.4, 4.5, 4.6_

  - [x] 6.3 Write property tests for chat service

    - **Property 18: Conversation Creation Links Participants**
    - **Property 19: Message Creation Stores Sender and Body**
    - **Property 20: Conversation Query Returns User's Conversations**
    - **Property 21: Message Pagination Works Correctly**
    - **Property 22: Mark as Read Updates Timestamp**
    - **Property 23: Unread Count Matches Actual Unread**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

- [x] 7. Implement Payment Webhook Service





  - [x] 7.1 Create services/paymentWebhookService.ts with signature verification

    - Implement verifyPaystackSignature(payload, signature) using HMAC-SHA512
    - Implement handlePaystackWebhook(event) event router
    - _Requirements: 5.1, 5.2_

  - [x] 7.2 Implement payment event handlers

    - Implement handleSubscriptionPayment(reference, status)
    - Implement handleBookingPayment(reference, status)
    - Implement logTransaction(userId, type, amount, currency, provider, status)
    - _Requirements: 5.3, 5.4, 5.5_


  - [x] 7.3 Write property tests for payment webhook service

    - **Property 25: Webhook Signature Verification Correctness**
    - **Property 26: Subscription Payment Updates Subscription**
    - **Property 27: Booking Payment Updates Booking**
    - **Property 28: Payment Processing Logs Transaction**
    - **Property 29: Transaction Round-Trip Persistence**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

- [x] 8. Implement Notification Service





  - [x] 8.1 Create services/notificationService.ts with in-app notifications


    - Implement createInAppNotification(userId, type, title, body, metadata?)
    - Implement getNotifications(userId, unreadOnly?)
    - Implement markNotificationRead(notificationId)
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 8.2 Implement push notifications and device token management
    - Implement sendPushNotification(userId, title, body, data?) via FCM
    - Implement registerDeviceToken(userId, token, platform)

    - _Requirements: 6.1, 6.5_
  - [x] 8.3 Write property tests for notification service

    - **Property 30: Notification Creation Stores All Fields**
    - **Property 31: Notification Query with Filter**
    - **Property 32: Notification Mark as Read Updates Timestamp**
    - **Property 33: Device Token Registration**
    - **Property 34: Notification Round-Trip Persistence**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

- [x] 9. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Review Service





  - [x] 10.1 Create services/reviewService.ts with review management


    - Implement createReview(bookingId, raterId, ratedId, score, text) with validation
    - Implement getReviewsForWorker(workerId, limit?, cursor?) with pagination
    - Implement getReviewsByUser(userId)
    - Implement canReview(bookingId, userId) eligibility check
    - Implement updateWorkerRating(workerId) average calculation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 10.2 Write property tests for review service

    - **Property 35: Review Creation After Completed Booking**
    - **Property 36: Review Pagination for Worker**
    - **Property 37: Review Query by Author Returns Author's Reviews**
    - **Property 38: Review Eligibility Check**
    - **Property 39: Review Updates Worker Average Rating**
    - **Property 40: Invalid Review Rejection**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**

- [x] 11. Implement Search Ranking Enhancement






  - [x] 11.1 Enhance services/workerService.ts with ranking logic

    - Implement calculateCompositeScore(worker, factors) with weighted factors
    - Implement searchWorkersRanked(filters, userLocation?) with sorting
    - Add tier weight calculation (Premium: 1.0, Basic: 0.6, Free: 0.3)
    - Add normalized rating score (0-1)
    - Add inverse distance score when location provided
    - Add activity bonus for recent logins (7 days)
    - Add completion rate calculation
    - Add response time factor
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 11.2 Write property tests for search ranking

    - **Property 41: Search Ranking Composite Score Calculation**
    - **Property 42: Search Results Sorted by Score Descending**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

- [x] 12. Implement Verification Service






  - [x] 12.1 Create services/verificationService.ts with document management

    - Implement uploadVerificationDocument(userId, docType, fileUrl)
    - Implement getVerificationStatus(userId)
    - Implement submitForVerification(userId)
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 12.2 Implement admin verification workflow
    - Implement approveVerification(userId, adminId)
    - Implement rejectVerification(userId, adminId, reason)
    - Update worker verified flag on approval
    - _Requirements: 9.4, 9.5_
  - [x] 12.3 Write property tests for verification service


    - **Property 43: Verification Document Upload**
    - **Property 44: Verification Status Query**
    - **Property 45: Verification Submission Sets Pending**
    - **Property 46: Verification Approval Sets Approved and Verified**
    - **Property 47: Verification Rejection Sets Rejected with Reason**
    - **Property 48: Verification Document Round-Trip Persistence**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**




- [x] 13. Final Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.
