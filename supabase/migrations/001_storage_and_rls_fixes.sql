-- ============================================
-- Forge: Storage buckets + RLS fixes
-- Migration 001
-- ============================================
-- Run via Supabase CLI (`supabase db push`) or SQL Editor.
-- Buckets can also be created in Dashboard → Storage if INSERT fails
-- (requires service_role / dashboard access).
-- ============================================

-- --------------------------------------------
-- STORAGE BUCKETS
-- --------------------------------------------
-- Path conventions used by the app:
--   avatars:                  {user_id}/avatar-{timestamp}.{ext}     (ProfileEdit.tsx)
--   job-media:                {user_id}/{timestamp}-{random}.{ext}   (Jobs.tsx)
--   verification-documents:   {user_id}/{doc_type}-{timestamp}.{ext} (KYC uploads)

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('job-media', 'job-media', true),
  ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public;

-- --------------------------------------------
-- STORAGE POLICIES — avatars (public bucket)
-- --------------------------------------------
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------
-- STORAGE POLICIES — job-media (public bucket)
-- --------------------------------------------
DROP POLICY IF EXISTS "Job media is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own job media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own job media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own job media" ON storage.objects;

CREATE POLICY "Job media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-media');

CREATE POLICY "Users can upload own job media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own job media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'job-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own job media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'job-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------
-- STORAGE POLICIES — verification-documents (private)
-- --------------------------------------------
DROP POLICY IF EXISTS "Users can read own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own verification documents" ON storage.objects;

CREATE POLICY "Users can read own verification documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can read all verification documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can upload own verification documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own verification documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own verification documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------
-- RLS — worker_payments
-- --------------------------------------------
ALTER TABLE worker_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own worker payments" ON worker_payments;
DROP POLICY IF EXISTS "Users can create own worker payments" ON worker_payments;
DROP POLICY IF EXISTS "Admins can view all worker payments" ON worker_payments;
DROP POLICY IF EXISTS "Admins can update worker payments" ON worker_payments;

CREATE POLICY "Users can view own worker payments"
  ON worker_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own worker payments"
  ON worker_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all worker payments"
  ON worker_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update worker payments"
  ON worker_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Webhook / server handlers that update payment status must use the
-- Supabase service_role key (bypasses RLS).

-- --------------------------------------------
-- RLS — service_categories (public read, admin write)
-- --------------------------------------------
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service categories are viewable by everyone" ON service_categories;
DROP POLICY IF EXISTS "Admins can insert service categories" ON service_categories;
DROP POLICY IF EXISTS "Admins can update service categories" ON service_categories;
DROP POLICY IF EXISTS "Admins can delete service categories" ON service_categories;

CREATE POLICY "Service categories are viewable by everyone"
  ON service_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert service categories"
  ON service_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update service categories"
  ON service_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete service categories"
  ON service_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- --------------------------------------------
-- RLS — transactions INSERT (and service-role note)
-- --------------------------------------------
DROP POLICY IF EXISTS "Users can create own transactions" ON transactions;

CREATE POLICY "Users can create own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- paymentWebhookService.logTransaction() and webhook status updates run
-- server-side and must use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) so
-- Paystack callbacks can INSERT/UPDATE rows for any user_id.
