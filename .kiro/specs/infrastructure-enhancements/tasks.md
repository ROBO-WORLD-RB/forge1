# Implementation Plan

- [x] 1. Set up testing infrastructure





  - [x] 1.1 Install and configure Vitest with React Testing Library


    - Install vitest, @testing-library/react, @testing-library/jest-dom, jsdom, fast-check
    - Create vitest.config.ts with jsdom environment and coverage settings
    - Create tests/setup.ts with global test configuration
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.2 Write property test for crypto utility round trip

    - **Property: Encryption round trip**
    - Test that for any string, encrypt then decrypt returns original value
    - _Requirements: 2.3_
  - [x] 1.3 Write unit tests for existing utilities


    - Test rateLimiter.ts functionality
    - Test logger.ts log levels and formatting
    - _Requirements: 2.3_

- [x] 2. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Set up Supabase integration






  - [x] 3.1 Install Supabase client and create configuration

    - Install @supabase/supabase-js
    - Create services/supabase.ts with client initialization
    - Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.example
    - _Requirements: 1.1_

  - [x] 3.2 Write property test for Supabase client initialization

    - **Property 1: User Registration Round Trip (partial - client init)**
    - Test that client initializes without error with valid config
    - **Validates: Requirements 1.1**

  - [x] 3.3 Create database types from schema

    - Create types/database.ts with Supabase-generated types
    - Define Profile, WorkerProfile, Review table types
    - _Requirements: 1.2, 1.4_

- [x] 4. Implement Auth Service with Supabase






  - [x] 4.1 Create authService.ts with Supabase Auth

    - Implement signUp with user metadata storage
    - Implement signIn with session management
    - Implement signOut and getUser
    - Implement onAuthStateChange subscription
    - _Requirements: 1.2, 1.3_

  - [x] 4.2 Write property test for user registration round trip

    - **Property 1: User Registration Round Trip**
    - **Validates: Requirements 1.2**
  - [x] 4.3 Write property test for login session validity


    - **Property 2: Login Returns Valid Session**
    - **Validates: Requirements 1.3**
  - [x] 4.4 Update AuthContext to use new authService


    - Replace mockAuth imports with new authService
    - Handle auth state changes with onAuthStateChange
    - _Requirements: 1.2, 1.3_

- [x] 5. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Worker Service with Supabase






  - [x] 6.1 Create workerService.ts with CRUD operations

    - Implement createProfile with Supabase insert
    - Implement updateProfile with Supabase update
    - Implement getProfile with Supabase select
    - Implement searchProfiles with filtering support
    - _Requirements: 1.4, 1.5_
  - [x] 6.2 Write property test for worker profile persistence


    - **Property 3: Worker Profile Persistence Round Trip**
    - **Validates: Requirements 1.4**

  - [x] 6.3 Write property test for search filter correctness

    - **Property 4: Worker Search Filter Correctness**
    - **Validates: Requirements 1.5**

  - [x] 6.4 Create structured error handling for database operations

    - Implement handleDatabaseError function
    - Define ERROR_CODES constant
    - Map Supabase errors to user-friendly messages

    - _Requirements: 1.6_
  - [x] 6.5 Write property test for error structure

    - **Property 5: Database Error Structure**
    - **Validates: Requirements 1.6**

- [x] 7. Implement Row Level Security testing






  - [x] 7.1 Write property test for RLS enforcement

    - **Property 6: Row Level Security Enforcement**
    - Test that users cannot update profiles they don't own
    - **Validates: Requirements 1.7**

- [x] 8. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Set up Sentry monitoring






  - [x] 9.1 Install and configure Sentry SDK

    - Install @sentry/react and @sentry/vite-plugin
    - Create services/monitoringService.ts with initialization
    - Add VITE_SENTRY_DSN to .env.local.example
    - _Requirements: 4.1_

  - [x] 9.2 Implement error capture with context

    - Implement captureError with stack trace preservation
    - Implement setUser for user context attachment
    - Implement sensitive data filtering (beforeSend hook)
    - _Requirements: 4.2, 4.4, 4.5_

  - [x] 9.3 Write property test for error capture completeness

    - **Property 9: Error Capture Completeness**
    - **Validates: Requirements 4.2**

  - [x] 9.4 Write property test for error context attachment

    - **Property 11: Error Context Attachment**
    - **Validates: Requirements 4.4**

  - [x] 9.5 Write property test for sensitive data filtering

    - **Property 12: Sensitive Data Filtering**
    - **Validates: Requirements 4.5**

  - [x] 9.6 Implement performance monitoring

    - Implement startTransaction for key user actions
    - Add performance tracking to auth and worker operations
    - _Requirements: 4.3_

  - [x] 9.7 Write property test for transaction recording

    - **Property 10: Performance Transaction Recording**
    - **Validates: Requirements 4.3**


  - [x] 9.8 Integrate Sentry ErrorBoundary in App





    - Wrap App component with Sentry.ErrorBoundary
    - Update existing ErrorBoundary to report to Sentry
    - _Requirements: 4.2_

- [x] 10. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement PWA and Service Worker





  - [x] 11.1 Create PWA manifest and icons


    - Create public/manifest.json with app metadata
    - Add manifest link to index.html
    - Create placeholder icons (192x192, 512x512)
    - _Requirements: 3.3_

  - [x] 11.2 Install and configure Vite PWA plugin

    - Install vite-plugin-pwa
    - Configure workbox strategies in vite.config.ts
    - Set up precaching for static assets
    - _Requirements: 3.1_

  - [x] 11.3 Implement service worker with caching strategies

    - Configure CacheFirst for static assets
    - Configure StaleWhileRevalidate for API routes
    - Implement offline fallback page
    - _Requirements: 3.2, 3.5_

  - [x] 11.4 Write property test for offline cache serving

    - **Property 7: Offline Cache Serving**
    - **Validates: Requirements 3.2**

  - [x] 11.5 Write property test for stale-while-revalidate
    - **Property 8: Stale-While-Revalidate Strategy**
    - **Validates: Requirements 3.5**

  - [x] 11.6 Implement update notification

    - Add service worker update detection
    - Create UI prompt for app update
    - _Requirements: 3.4_

  - [x] 11.7 Enhance OfflineIndicator component

    - Integrate with useOnlineStatus hook
    - Add visual notification styling
    - _Requirements: 3.6_

- [x] 12. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Configure CDN and asset optimization





  - [x] 13.1 Configure Vite build optimization


    - Enable code splitting for routes with dynamic imports
    - Configure chunk naming with content hashes
    - Set up CSS minification and purging
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 13.2 Write property test for CSS purge effectiveness

    - **Property 14: CSS Purge Effectiveness**
    - **Validates: Requirements 5.5**
  - [x] 13.3 Set up image optimization


    - Install vite-imagetools or similar plugin
    - Configure WebP generation for images
    - _Requirements: 5.3_

  - [x] 13.4 Write property test for image optimization

    - **Property 13: Image Optimization Output**
    - **Validates: Requirements 5.3**
  - [x] 13.5 Configure cache headers and bundle analysis


    - Add rollup-plugin-visualizer for bundle analysis
    - Configure preview server cache headers
    - _Requirements: 5.4, 5.6_


  - [x] 13.6 Configure Sentry source map upload
    - Add sentryVitePlugin to vite.config.ts
    - Configure source map upload in build process
    - _Requirements: 4.6_

- [x] 14. Update application pages to use new services





  - [x] 14.1 Update Login page to use Supabase auth


    - Replace mockAuth calls with authService
    - Handle Supabase auth errors
    - _Requirements: 1.3_

  - [x] 14.2 Update Signup page to use Supabase auth

    - Replace mockAuth calls with authService
    - Store user metadata in profiles table
    - _Requirements: 1.2_


  - [x] 14.3 Update WorkerOnboarding to use workerService
    - Replace mockAuth.createWorkerProfile with workerService
    - Handle database errors with user-friendly messages

    - _Requirements: 1.4_
  - [x] 14.4 Update WorkerSearch to use workerService

    - Replace mock data with workerService.searchProfiles
    - Implement filter UI connected to service
    - _Requirements: 1.5_

  - [x] 14.5 Update WorkerProfile to use workerService

    - Fetch profile data from Supabase
    - Handle loading and error states
    - _Requirements: 1.4_

- [x] 15. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
