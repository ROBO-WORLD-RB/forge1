-- ============================================
-- FORGE Marketplace Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  username TEXT UNIQUE,
  phone TEXT,
  bio TEXT,
  location TEXT,
  country TEXT DEFAULT 'GH',
  role TEXT CHECK (role IN ('customer', 'worker', 'admin')),
  profile_completed BOOLEAN DEFAULT false,
  worker_status TEXT DEFAULT 'pending' CHECK (worker_status IN ('pending', 'pending_payment', 'active', 'suspended')),
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  specialties TEXT[],
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SERVICE CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS service_categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true
);

-- ============================================
-- WORKER PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS worker_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'GHS',
  payment_reference TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKER PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS worker_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT NOT NULL,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  country TEXT NOT NULL CHECK (country IN ('GH', 'NG')),
  bio TEXT,
  hourly_rate_min DECIMAL(10,2),
  hourly_rate_max DECIMAL(10,2),
  currency TEXT CHECK (currency IN ('GHS', 'NGN')),
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  skills TEXT[] DEFAULT '{}',
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'premium')),
  verified BOOLEAN DEFAULT FALSE,
  experience_years INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'premium')),
  currency TEXT NOT NULL CHECK (currency IN ('GHS', 'NGN')),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  payment_provider TEXT,
  provider_subscription_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poster_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  country TEXT NOT NULL CHECK (country IN ('GH', 'NG')),
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  currency TEXT CHECK (currency IN ('GHS', 'NGN')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  media_urls TEXT[],
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  worker_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELLED')),
  customer_message TEXT,
  worker_message TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, author_id)
);

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_1 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachments TEXT[],
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('subscription', 'booking', 'refund')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('GHS', 'NGN')),
  payment_provider TEXT NOT NULL,
  provider_txn_id TEXT,
  status TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_message', 'booking_request', 'booking_accepted', 'booking_completed', 'subscription_expiring', 'subscription_expired', 'payment_failed', 'new_review')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEVICE TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- ============================================
-- VERIFICATION DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('government_id', 'skill_certificate', 'selfie')),
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_worker_profiles_country ON worker_profiles(country);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_skills ON worker_profiles USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
-- Partial unique: many users may have NULL phone (OAuth); only real numbers must be unique
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_not_null
  ON profiles (phone)
  WHERE phone IS NOT NULL AND length(btrim(phone)) > 0;

CREATE INDEX IF NOT EXISTS idx_jobs_country ON jobs(country);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_bookings_worker ON bookings(worker_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles (hardened — see migrations/002_security_hardening.sql)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = id
  AND role IN ('worker', 'customer')
  AND verified = false
  AND worker_status IN ('pending', 'pending_payment', 'active')
);
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Worker Profiles
DROP POLICY IF EXISTS "Worker profiles are viewable by everyone" ON worker_profiles;
DROP POLICY IF EXISTS "Workers can update own profile" ON worker_profiles;
DROP POLICY IF EXISTS "Workers can insert own profile" ON worker_profiles;
CREATE POLICY "Worker profiles are viewable by everyone" ON worker_profiles FOR SELECT USING (true);
CREATE POLICY "Workers can update own profile" ON worker_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Workers can insert own profile" ON worker_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Jobs (UI: "Projects"; workers apply — only customers/admins create)
DROP POLICY IF EXISTS "Jobs are viewable by everyone" ON jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON jobs;
DROP POLICY IF EXISTS "Customers can create jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete own jobs" ON jobs;
CREATE POLICY "Jobs are viewable by everyone" ON jobs FOR SELECT USING (true);
CREATE POLICY "Customers can create jobs" ON jobs FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = poster_user_id
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('customer', 'admin'))
);
CREATE POLICY "Users can update own jobs" ON jobs FOR UPDATE TO authenticated USING (auth.uid() = poster_user_id) WITH CHECK (auth.uid() = poster_user_id);
CREATE POLICY "Users can delete own jobs" ON jobs FOR DELETE TO authenticated USING (auth.uid() = poster_user_id);

-- Bookings
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Participants can update bookings" ON bookings;
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (auth.uid() = worker_user_id OR auth.uid() = customer_user_id);
CREATE POLICY "Users can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = customer_user_id OR auth.uid() = worker_user_id);
CREATE POLICY "Participants can update bookings" ON bookings FOR UPDATE USING (auth.uid() = worker_user_id OR auth.uid() = customer_user_id);

-- Reviews
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Users can update own conversations" ON conversations FOR UPDATE USING (auth.uid() = participant_1 OR auth.uid() = participant_2) WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT 
  USING (EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND (participant_1 = auth.uid() OR participant_2 = auth.uid())));
CREATE POLICY "Users can send messages" ON messages FOR INSERT 
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND (participant_1 = auth.uid() OR participant_2 = auth.uid())));
CREATE POLICY "Users can update messages in their conversations" ON messages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND (participant_1 = auth.uid() OR participant_2 = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND (participant_1 = auth.uid() OR participant_2 = auth.uid())));

-- Subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can create subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create subscriptions" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);

-- Device Tokens
DROP POLICY IF EXISTS "Users can manage own device tokens" ON device_tokens;
CREATE POLICY "Users can manage own device tokens" ON device_tokens FOR ALL USING (auth.uid() = user_id);

-- Verification Documents
DROP POLICY IF EXISTS "Users can view own documents" ON verification_documents;
DROP POLICY IF EXISTS "Users can upload documents" ON verification_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON verification_documents;
CREATE POLICY "Users can view own documents" ON verification_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upload documents" ON verification_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON verification_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_worker_profiles_updated_at ON worker_profiles;
CREATE TRIGGER update_worker_profiles_updated_at BEFORE UPDATE ON worker_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Auto-create profile on signup (hardened — never assign admin)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role TEXT;
  assigned_role TEXT;
  final_phone TEXT;
  base_username TEXT;
  final_username TEXT;
  id_hex TEXT;
  attempt INT := 0;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';

  IF meta_role IN ('worker', 'customer') THEN
    assigned_role := meta_role;
  ELSE
    assigned_role := 'customer';
  END IF;

  -- Never store '' for phone — UNIQUE treats '' as a real value (one empty slot only)
  final_phone := NULLIF(
    btrim(COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '')),
    ''
  );

  -- Full UUID without dashes (32 hex chars) — unique per auth.users row
  id_hex := replace(NEW.id::text, '-', '');

  base_username := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'username', '')), '');
  IF base_username IS NOT NULL THEN
    base_username := lower(regexp_replace(base_username, '^@+', '', 'g'));
    base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  END IF;

  IF base_username IS NULL OR base_username = '' THEN
    -- Guaranteed unique: @user + full 32-char hex of the auth user id
    final_username := '@user' || id_hex;
  ELSE
    final_username := '@' || base_username;
  END IF;

  -- Resolve collisions (chosen username taken, or rare race)
  WHILE EXISTS (
    SELECT 1 FROM public.profiles WHERE username = final_username
  ) AND attempt < 32
  LOOP
    attempt := attempt + 1;
    IF attempt = 1 THEN
      final_username :=
        '@' || COALESCE(NULLIF(base_username, ''), 'user')
        || '_' || id_hex;
    ELSE
      final_username :=
        '@' || COALESCE(NULLIF(base_username, ''), 'user')
        || '_' || substr(id_hex, 1, 8)
        || substr(md5(random()::text || clock_timestamp()::text || attempt::text), 1, 8);
    END IF;
  END LOOP;

  BEGIN
    INSERT INTO public.profiles (
      id, phone, role, first_name, last_name, username, country,
      profile_completed, worker_status, verified
    )
    VALUES (
      NEW.id,
      final_phone,
      assigned_role,
      NEW.raw_user_meta_data->>'firstName',
      NEW.raw_user_meta_data->>'lastName',
      final_username,
      COALESCE(NEW.raw_user_meta_data->>'country', 'GH'),
      (assigned_role = 'customer'),
      CASE WHEN assigned_role = 'worker' THEN 'pending' ELSE 'active' END,
      false
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.profiles (
        id, phone, role, first_name, last_name, username, country,
        profile_completed, worker_status, verified
      )
      VALUES (
        NEW.id,
        NULL,
        assigned_role,
        NEW.raw_user_meta_data->>'firstName',
        NEW.raw_user_meta_data->>'lastName',
        '@user' || id_hex || '_'
          || substr(md5(random()::text || clock_timestamp()::text), 1, 8),
        COALESCE(NEW.raw_user_meta_data->>'country', 'GH'),
        (assigned_role = 'customer'),
        CASE WHEN assigned_role = 'worker' THEN 'pending' ELSE 'active' END,
        false
      )
      ON CONFLICT (id) DO NOTHING;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCTION: Block privilege escalation on profile UPDATE
-- ============================================
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'permission denied: cannot change role' USING ERRCODE = '42501';
  END IF;

  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    RAISE EXCEPTION 'permission denied: cannot change verified status' USING ERRCODE = '42501';
  END IF;

  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    RAISE EXCEPTION 'permission denied: cannot change rating' USING ERRCODE = '42501';
  END IF;

  IF NEW.review_count IS DISTINCT FROM OLD.review_count THEN
    RAISE EXCEPTION 'permission denied: cannot change review_count' USING ERRCODE = '42501';
  END IF;

  IF NEW.worker_status IS DISTINCT FROM OLD.worker_status THEN
    IF OLD.role = 'worker'
       AND OLD.worker_status = 'pending'
       AND NEW.worker_status = 'pending_payment' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'permission denied: cannot change worker_status' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_privilege_limits ON public.profiles;
CREATE TRIGGER enforce_profile_privilege_limits
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- ============================================
-- FUNCTION: Complete worker onboarding (atomic)
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_worker_onboarding()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    profile_completed = true,
    worker_status = CASE
      WHEN worker_status = 'pending' THEN 'pending_payment'
      ELSE worker_status
    END,
    updated_at = NOW()
  WHERE id = auth.uid()
    AND role = 'worker'
  RETURNING * INTO updated;

  IF updated IS NULL THEN
    RAISE EXCEPTION 'worker profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN updated;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_worker_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_worker_onboarding() TO authenticated;

-- ============================================
-- FUNCTION: One-time OAuth / post-signup role assignment
-- ============================================
CREATE OR REPLACE FUNCTION public.assign_initial_role(p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role IN ('worker', 'customer') THEN
    valid_role := p_role;
  ELSE
    valid_role := 'customer';
  END IF;

  UPDATE public.profiles
  SET
    role = valid_role,
    profile_completed = (valid_role = 'customer'),
    worker_status = CASE
      WHEN valid_role = 'worker' THEN 'pending'
      ELSE 'active'
    END
  WHERE id = auth.uid()
    AND role = 'customer'
    AND worker_status IN ('pending', 'active')
    AND created_at > NOW() - INTERVAL '24 hours';

  IF NOT FOUND THEN
    NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_initial_role(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_initial_role(TEXT) TO authenticated;

-- Named CHECK constraint for role enum (matches migration 002)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'worker', 'admin'));

-- ============================================
-- WORKER PORTFOLIOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS worker_portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  media_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKER ENDORSEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS worker_endorsements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endorsement_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referee_id)
);

-- Enable RLS
ALTER TABLE worker_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_endorsements ENABLE ROW LEVEL SECURITY;

-- Portfolios Policies
DROP POLICY IF EXISTS "Portfolios are viewable by everyone" ON worker_portfolios;
DROP POLICY IF EXISTS "Workers can manage own portfolios" ON worker_portfolios;
CREATE POLICY "Portfolios are viewable by everyone" ON worker_portfolios FOR SELECT USING (true);
CREATE POLICY "Workers can manage own portfolios" ON worker_portfolios FOR ALL USING (auth.uid() = worker_id);

-- Endorsements Policies
DROP POLICY IF EXISTS "Endorsements are viewable by everyone" ON worker_endorsements;
DROP POLICY IF EXISTS "Workers can manage own endorsements" ON worker_endorsements;
CREATE POLICY "Endorsements are viewable by everyone" ON worker_endorsements FOR SELECT USING (true);
CREATE POLICY "Workers can manage own endorsements" ON worker_endorsements FOR ALL USING (auth.uid() = referrer_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_worker_portfolios_updated_at ON worker_portfolios;
CREATE TRIGGER update_worker_portfolios_updated_at BEFORE UPDATE ON worker_portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

