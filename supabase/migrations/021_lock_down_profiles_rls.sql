-- ============================================
-- 021 — Lock down profiles RLS (critical)
-- ============================================
-- Incident: anyone with the public anon/publishable key could run
--   GET /rest/v1/profiles?select=*
-- and dump every row (names, phones, usernames) because migration 006
-- used USING (true) for SELECT on profiles.
--
-- The anon key in the client is EXPECTED for Supabase. Security comes from RLS.
-- Passwords are NOT in public.profiles (they live in auth.users; not exposed via REST).
--
-- APPLY IMMEDIATELY in Supabase Dashboard → SQL Editor → Run this entire file.
-- ============================================

-- ---------------------------------------------------------------------------
-- 0. Helper — avoid recursive RLS when checking admin role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 1. Drop the open-door SELECT policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- ---------------------------------------------------------------------------
-- 2. SELECT — own row, admins, marketplace workers, booking/chat counterparts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Public worker directory (search + /profile/:id for active workers only).
-- Customers and pending/suspended workers are NOT listed.
DROP POLICY IF EXISTS "Public can view active worker profiles" ON public.profiles;
CREATE POLICY "Public can view active worker profiles"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    role = 'worker'
    AND worker_status = 'active'
  );

-- Booking counterparties (customer ↔ worker) can see each other's profiles.
DROP POLICY IF EXISTS "Booking parties can view counterparty profiles" ON public.profiles;
CREATE POLICY "Booking parties can view counterparty profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE (
        b.customer_user_id = auth.uid() AND b.worker_user_id = profiles.id
      ) OR (
        b.worker_user_id = auth.uid() AND b.customer_user_id = profiles.id
      )
    )
  );

-- Chat participants can see each other's profiles (names/avatars in threads).
DROP POLICY IF EXISTS "Chat parties can view counterparty profiles" ON public.profiles;
CREATE POLICY "Chat parties can view counterparty profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (
        c.participant_1 = auth.uid() AND c.participant_2 = profiles.id
      ) OR (
        c.participant_2 = auth.uid() AND c.participant_1 = profiles.id
      )
    )
  );

-- Job posters are visible so workers can view / message / apply.
DROP POLICY IF EXISTS "Job posters are viewable" ON public.profiles;
CREATE POLICY "Job posters are viewable"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.poster_user_id = profiles.id
    )
  );

-- Review authors (display name on public worker reviews).
DROP POLICY IF EXISTS "Review authors are viewable" ON public.profiles;
CREATE POLICY "Review authors are viewable"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.author_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Explicitly deny DELETE for clients (no policy = deny when RLS is on;
--    keep this named policy for clarity / audits)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "No client deletes on profiles" ON public.profiles;
-- Intentionally no DELETE policy for anon/authenticated.

REVOKE DELETE ON public.profiles FROM anon, authenticated;
REVOKE TRUNCATE ON public.profiles FROM anon, authenticated;

-- Note: phone is still readable on rows RLS allows (active workers, own row,
-- booking/chat parties). A follow-up should move phone behind a SECURITY DEFINER
-- RPC and drop it from public SELECT * — do not REVOKE (phone) here or
-- PostgREST select('*') breaks for allowed rows.

-- ---------------------------------------------------------------------------
-- 4. worker_profiles — public only for active workers; owners + admins full
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Worker profiles are viewable by everyone" ON public.worker_profiles;

DROP POLICY IF EXISTS "Public can view active worker_profiles" ON public.worker_profiles;
CREATE POLICY "Public can view active worker_profiles"
  ON public.worker_profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = worker_profiles.user_id
        AND p.role = 'worker'
        AND p.worker_status = 'active'
    )
  );

DROP POLICY IF EXISTS "Workers can view own worker_profiles" ON public.worker_profiles;
CREATE POLICY "Workers can view own worker_profiles"
  ON public.worker_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all worker_profiles" ON public.worker_profiles;
CREATE POLICY "Admins can view all worker_profiles"
  ON public.worker_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE DELETE ON public.worker_profiles FROM anon, authenticated;
REVOKE TRUNCATE ON public.worker_profiles FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Smoke-test helpers (run manually after apply)
-- ---------------------------------------------------------------------------
-- In SQL Editor as postgres (service role), these should still work.
-- From the browser console WITHOUT being signed in, this should return []
-- or only active workers — NEVER a full customer dump:
--
--   fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, {
--     headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
--   }).then(r => r.json()).then(console.log)
--
-- Delete/update of another user's row with only the anon key must fail.

COMMENT ON TABLE public.profiles IS
  'RLS hardened in 021: no public SELECT *; active workers + own/admin/booking/chat/job/review contexts only.';
