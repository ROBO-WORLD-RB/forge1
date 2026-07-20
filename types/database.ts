/**
 * Database types for Supabase tables
 * Based on the schema defined in the design document
 */

export type UserRole = 'worker' | 'customer' | 'admin';
export type Country = 'GH' | 'NG';
export type Currency = 'GHS' | 'NGN';
export type WorkerTier = 'free' | 'basic' | 'premium';

export interface Profile {
  id: string;
  phone: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  bio: string | null;
  location: string | null;
  country: Country | null;
  avatar_url: string | null;
  profile_completed: boolean;
  worker_status: 'pending' | 'pending_payment' | 'active' | 'suspended';
  rating: number;
  review_count: number;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  name: string;
  role: string;
  location: string;
  location_lat: number | null;
  location_lng: number | null;
  country: Country;
  bio: string | null;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  currency: Currency | null;
  rating: number;
  review_count: number;
  skills: string[];
  tier: WorkerTier;
  verified: boolean;
  experience_years: number | null;
  /** Worker OS: open for new work (M3) */
  accepting_work?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  worker_id: string;
  author_id: string;
  rating: number;
  text: string | null;
  created_at: string;
}

/** Customer OS: saved workers for repeat hire (M2) */
export interface Favorite {
  id: string;
  user_id: string;
  worker_user_id: string;
  created_at: string;
}

export interface FavoriteInsert {
  user_id: string;
  worker_user_id: string;
}

export interface FavoriteWithWorker extends Favorite {
  worker?: WorkerProfile | null;
}

/** M6: product analytics event row */
export interface AnalyticsEventRow {
  id: string;
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown>;
  session_id: string | null;
  page_path: string | null;
  created_at: string;
}

/** M6: booking dispute */
export type DisputeStatus = 'open' | 'resolved' | 'closed';

export interface Dispute {
  id: string;
  booking_id: string;
  opener_id: string;
  reason: string;
  status: DisputeStatus;
  notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisputeInsert {
  booking_id: string;
  opener_id: string;
  reason: string;
  status?: DisputeStatus;
  notes?: string | null;
}

/** Booking payment / escrow surface status (M4) */
export type BookingPaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'held'
  | 'released'
  | 'refunded'
  | 'failed';

export type EscrowHoldStatus = 'held' | 'released' | 'refunded' | 'cancelled';

export type WalletLedgerEntryType =
  | 'escrow_hold'
  | 'escrow_release'
  | 'escrow_refund'
  | 'adjustment'
  | 'withdrawal_request';

/** Worker OS: application to a customer job (M3) */
export type JobApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

/** M4: per-user currency wallet */
export interface Wallet {
  id: string;
  user_id: string;
  currency: Currency;
  available_balance: number;
  pending_balance: number;
  created_at: string;
  updated_at: string;
}

export interface WalletLedgerEntry {
  id: string;
  wallet_id: string;
  entry_type: WalletLedgerEntryType;
  amount: number;
  currency: Currency;
  direction: 'credit' | 'debit';
  balance_available_after: number;
  balance_pending_after: number;
  booking_id: string | null;
  escrow_hold_id: string | null;
  provider_txn_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface EscrowHold {
  id: string;
  booking_id: string;
  customer_user_id: string;
  worker_user_id: string;
  amount: number;
  currency: Currency;
  status: EscrowHoldStatus;
  provider_txn_id: string | null;
  transaction_id: string | null;
  held_at: string;
  released_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutAccount {
  id: string;
  user_id: string;
  provider: string;
  account_status: 'stub' | 'pending' | 'verified' | 'disabled';
  bank_name: string | null;
  account_last4: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  worker_user_id: string;
  booking_id: string | null;
  message: string | null;
  status: JobApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface JobApplicationInsert {
  job_id: string;
  worker_user_id: string;
  booking_id?: string | null;
  message?: string | null;
  status?: JobApplicationStatus;
}

export interface JobApplicationUpdate {
  booking_id?: string | null;
  message?: string | null;
  status?: JobApplicationStatus;
}

export interface JobApplicationWithJob extends JobApplication {
  job?: Job | null;
}

export interface ServiceCategory {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  is_active: boolean;
}

export interface WorkerPayment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_reference: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}


// Insert types (for creating new records)
export interface ProfileInsert {
  id: string;
  phone: string;
  role: UserRole;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  bio?: string | null;
  location?: string | null;
  country?: Country | null;
  avatar_url?: string | null;
  profile_completed?: boolean;
  worker_status?: 'pending' | 'pending_payment' | 'active' | 'suspended';

}

export interface WorkerProfileInsert {
  user_id: string;
  name: string;
  role: string;
  location: string;
  location_lat?: number | null;
  location_lng?: number | null;
  country: Country;
  bio?: string | null;
  hourly_rate_min?: number | null;
  hourly_rate_max?: number | null;
  currency?: Currency | null;
  skills?: string[];
  experience_years?: number | null;
  accepting_work?: boolean;
}

export interface ReviewInsert {
  booking_id: string;
  worker_id: string;
  author_id: string;
  rating: number;
  text?: string | null;
}

export interface ServiceCategoryInsert {
  name: string;
  slug: string;
  icon?: string | null;
  is_active?: boolean;
}

export interface WorkerPaymentInsert {
  user_id: string;
  amount: number;
  currency?: string;
  payment_reference?: string | null;
  status?: string;
  paid_at?: string | null;
}

// Update types (for updating existing records)
export interface ProfileUpdate {
  phone?: string;
  role?: UserRole;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  bio?: string | null;
  location?: string | null;
  country?: Country | null;
  avatar_url?: string | null;
  profile_completed?: boolean;
  worker_status?: 'pending' | 'pending_payment' | 'active' | 'suspended';

}

export interface WorkerProfileUpdate {
  name?: string;
  role?: string;
  location?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  country?: Country;
  bio?: string | null;
  hourly_rate_min?: number | null;
  hourly_rate_max?: number | null;
  currency?: Currency | null;
  skills?: string[];
  tier?: WorkerTier;
  verified?: boolean;
  experience_years?: number | null;
  accepting_work?: boolean;
}

// Supabase Database type definition
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      worker_profiles: {
        Row: WorkerProfile;
        Insert: WorkerProfileInsert;
        Update: WorkerProfileUpdate;
        Relationships: [
          {
            foreignKeyName: 'worker_profiles_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      reviews: {
        Row: Review;
        Insert: ReviewInsert;
        Update: Partial<ReviewInsert>;
        Relationships: [
          {
            foreignKeyName: 'reviews_worker_id_fkey';
            columns: ['worker_id'];
            referencedRelation: 'worker_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      favorites: {
        Row: Favorite;
        Insert: FavoriteInsert;
        Update: Partial<FavoriteInsert>;
        Relationships: [
          {
            foreignKeyName: 'favorites_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorites_worker_user_id_fkey';
            columns: ['worker_user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      analytics_events: {
        Row: AnalyticsEventRow;
        Insert: Omit<AnalyticsEventRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
          properties?: Record<string, unknown>;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'analytics_events_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      disputes: {
        Row: Dispute;
        Insert: DisputeInsert;
        Update: Partial<Pick<Dispute, 'status' | 'notes' | 'resolved_by' | 'resolved_at'>>;
        Relationships: [
          {
            foreignKeyName: 'disputes_booking_id_fkey';
            columns: ['booking_id'];
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'disputes_opener_id_fkey';
            columns: ['opener_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      job_applications: {
        Row: JobApplication;
        Insert: JobApplicationInsert;
        Update: JobApplicationUpdate;
        Relationships: [
          {
            foreignKeyName: 'job_applications_job_id_fkey';
            columns: ['job_id'];
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_applications_worker_user_id_fkey';
            columns: ['worker_user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'job_applications_booking_id_fkey';
            columns: ['booking_id'];
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          }
        ];
      };
      wallets: {
        Row: Wallet;
        Insert: Omit<Wallet, 'id' | 'created_at' | 'updated_at' | 'available_balance' | 'pending_balance'> & {
          available_balance?: number;
          pending_balance?: number;
        };
        Update: Partial<Pick<Wallet, 'available_balance' | 'pending_balance'>>;
        Relationships: [
          {
            foreignKeyName: 'wallets_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      wallet_ledger_entries: {
        Row: WalletLedgerEntry;
        Insert: Omit<WalletLedgerEntry, 'id' | 'created_at'>;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'wallet_ledger_entries_wallet_id_fkey';
            columns: ['wallet_id'];
            referencedRelation: 'wallets';
            referencedColumns: ['id'];
          }
        ];
      };
      escrow_holds: {
        Row: EscrowHold;
        Insert: Omit<EscrowHold, 'id' | 'created_at' | 'updated_at' | 'held_at' | 'released_at' | 'refunded_at'> & {
          held_at?: string;
          released_at?: string | null;
          refunded_at?: string | null;
        };
        Update: Partial<Pick<EscrowHold, 'status' | 'released_at' | 'refunded_at'>>;
        Relationships: [
          {
            foreignKeyName: 'escrow_holds_booking_id_fkey';
            columns: ['booking_id'];
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          }
        ];
      };
      payout_accounts: {
        Row: PayoutAccount;
        Insert: Omit<PayoutAccount, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PayoutAccount, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [
          {
            foreignKeyName: 'payout_accounts_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      service_categories: {
        Row: ServiceCategory;
        Insert: ServiceCategoryInsert;
        Update: Partial<ServiceCategoryInsert>;
        Relationships: [];
      };
      worker_payments: {
        Row: WorkerPayment;
        Insert: WorkerPaymentInsert;
        Update: Partial<WorkerPaymentInsert>;
        Relationships: [
          {
            foreignKeyName: 'worker_payments_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      subscriptions: {
        Row: Subscription;
        Insert: SubscriptionInsert;
        Update: SubscriptionUpdate;
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      jobs: {
        Row: Job;
        Insert: JobInsert;
        Update: JobUpdate;
        Relationships: [
          {
            foreignKeyName: 'jobs_poster_user_id_fkey';
            columns: ['poster_user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      bookings: {
        Row: Booking;
        Insert: BookingInsert;
        Update: BookingUpdate;
        Relationships: [
          {
            foreignKeyName: 'bookings_job_id_fkey';
            columns: ['job_id'];
            referencedRelation: 'jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_worker_user_id_fkey';
            columns: ['worker_user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_customer_user_id_fkey';
            columns: ['customer_user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      conversations: {
        Row: Conversation;
        Insert: ConversationInsert;
        Update: ConversationUpdate;
        Relationships: [
          {
            foreignKeyName: 'conversations_participant_1_fkey';
            columns: ['participant_1'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_participant_2_fkey';
            columns: ['participant_2'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_booking_id_fkey';
            columns: ['booking_id'];
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          }
        ];
      };
      messages: {
        Row: Message;
        Insert: MessageInsert;
        Update: MessageUpdate;
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      transactions: {
        Row: Transaction;
        Insert: TransactionInsert;
        Update: TransactionUpdate;
        Relationships: [
          {
            foreignKeyName: 'transactions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      notifications: {
        Row: Notification;
        Insert: NotificationInsert;
        Update: NotificationUpdate;
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      device_tokens: {
        Row: DeviceToken;
        Insert: DeviceTokenInsert;
        Update: DeviceTokenUpdate;
        Relationships: [
          {
            foreignKeyName: 'device_tokens_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      verification_documents: {
        Row: VerificationDocument;
        Insert: VerificationDocumentInsert;
        Update: VerificationDocumentUpdate;
        Relationships: [
          {
            foreignKeyName: 'verification_documents_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'verification_documents_reviewed_by_fkey';
            columns: ['reviewed_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      worker_portfolios: {
        Row: WorkerPortfolio;
        Insert: WorkerPortfolioInsert;
        Update: WorkerPortfolioUpdate;
        Relationships: [
          {
            foreignKeyName: 'worker_portfolios_worker_id_fkey';
            columns: ['worker_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      worker_endorsements: {
        Row: WorkerEndorsement;
        Insert: WorkerEndorsementInsert;
        Update: Partial<WorkerEndorsementInsert>;
        Relationships: [
          {
            foreignKeyName: 'worker_endorsements_referrer_id_fkey';
            columns: ['referrer_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_endorsements_referee_id_fkey';
            columns: ['referee_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}


// ============================================
// Status Enums for Backend Services
// ============================================

export type SubscriptionStatus = 'pending' | 'active' | 'cancelled' | 'expired';
export type JobStatus = 'open' | 'filled' | 'cancelled';
export type BookingStatus = 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' | 'CANCELLED';
export type NotificationType = 'new_message' | 'booking_request' | 'booking_accepted' | 'booking_completed' | 
  'subscription_expiring' | 'subscription_expired' | 'payment_failed' | 'new_review';
export type DocumentType = 'government_id' | 'skill_certificate' | 'selfie';
export type VerificationDocStatus = 'pending' | 'approved' | 'rejected';
export type TransactionType = 'subscription' | 'booking' | 'refund';

// ============================================
// Subscription Types
// ============================================

export interface Subscription {
  id: string;
  user_id: string;
  tier: WorkerTier;
  currency: Currency;
  amount: number;
  status: SubscriptionStatus;
  payment_provider: string | null;
  provider_subscription_id: string | null;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInsert {
  user_id: string;
  tier: WorkerTier;
  currency: Currency;
  amount: number;
  status?: SubscriptionStatus;
  payment_provider?: string | null;
  provider_subscription_id?: string | null;
  started_at?: string;
  expires_at: string;
  auto_renew?: boolean;
}

export interface SubscriptionUpdate {
  tier?: WorkerTier;
  currency?: Currency;
  amount?: number;
  status?: SubscriptionStatus;
  payment_provider?: string | null;
  provider_subscription_id?: string | null;
  expires_at?: string;
  auto_renew?: boolean;
}

// ============================================
// Job Types
// ============================================

export interface Job {
  id: string;
  poster_user_id: string;
  title: string;
  description: string | null;
  category: string;
  location: string;
  location_lat: number | null;
  location_lng: number | null;
  country: Country;
  budget_min: number | null;
  budget_max: number | null;
  currency: Currency | null;
  status: JobStatus;
  media_urls: string[] | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobInsert {
  poster_user_id: string;
  title: string;
  description?: string | null;
  category: string;
  location: string;
  location_lat?: number | null;
  location_lng?: number | null;
  country: Country;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: Currency | null;
  status?: JobStatus;
  media_urls?: string[] | null;
  scheduled_at?: string | null;
}

export interface JobUpdate {
  title?: string;
  description?: string | null;
  category?: string;
  location?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  country?: Country;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: Currency | null;
  status?: JobStatus;
  media_urls?: string[] | null;
  scheduled_at?: string | null;
}

// ============================================
// Booking Types
// ============================================

export interface Booking {
  id: string;
  job_id: string;
  worker_user_id: string;
  customer_user_id: string;
  status: BookingStatus;
  /** M4: escrow / payment surface */
  payment_status?: BookingPaymentStatus;
  customer_message: string | null;
  worker_message: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingInsert {
  job_id: string;
  worker_user_id: string;
  customer_user_id: string;
  status?: BookingStatus;
  customer_message?: string | null;
  worker_message?: string | null;
  scheduled_at?: string | null;
}

export interface BookingUpdate {
  status?: BookingStatus;
  customer_message?: string | null;
  worker_message?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
}

// ============================================
// Conversation & Message Types
// ============================================

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  booking_id: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface ConversationInsert {
  participant_1: string;
  participant_2: string;
  booking_id?: string | null;
  last_message_at?: string | null;
}

export interface ConversationUpdate {
  last_message_at?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachments: string[] | null;
  read_at: string | null;
  created_at: string;
}

export interface MessageInsert {
  conversation_id: string;
  sender_id: string;
  body: string;
  attachments?: string[] | null;
}

export interface MessageUpdate {
  body?: string;
  attachments?: string[] | null;
  read_at?: string | null;
}

// ============================================
// Transaction Types
// ============================================

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  payment_provider: string;
  provider_txn_id: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TransactionInsert {
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  payment_provider: string;
  provider_txn_id?: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
}

export interface TransactionUpdate {
  status?: string;
  provider_txn_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ============================================
// Notification Types
// ============================================

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationInsert {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
}

export interface NotificationUpdate {
  title?: string;
  body?: string;
  metadata?: Record<string, unknown> | null;
  read_at?: string | null;
}

// ============================================
// Device Token Types
// ============================================

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  created_at: string;
}

export interface DeviceTokenInsert {
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
}

export interface DeviceTokenUpdate {
  token?: string;
  platform?: 'ios' | 'android' | 'web';
}

// ============================================
// Verification Document Types
// ============================================

export interface VerificationDocument {
  id: string;
  user_id: string;
  doc_type: DocumentType;
  file_url: string;
  status: VerificationDocStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface VerificationDocumentInsert {
  user_id: string;
  doc_type: DocumentType;
  file_url: string;
  status?: VerificationDocStatus;
}

export interface VerificationDocumentUpdate {
  file_url?: string;
  status?: VerificationDocStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
}

// ============================================
// Worker Portfolio Types
// ============================================

export interface WorkerPortfolio {
  id: string;
  worker_id: string;
  title: string;
  description: string | null;
  media_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkerPortfolioInsert {
  worker_id: string;
  title: string;
  description?: string | null;
  media_urls?: string[];
}

export interface WorkerPortfolioUpdate {
  title?: string;
  description?: string | null;
  media_urls?: string[];
}

// ============================================
// Worker Endorsement Types
// ============================================

export interface WorkerEndorsement {
  id: string;
  referrer_id: string;
  referee_id: string;
  endorsement_text: string | null;
  created_at: string;
}

export interface WorkerEndorsementInsert {
  referrer_id: string;
  referee_id: string;
  endorsement_text?: string | null;
}
