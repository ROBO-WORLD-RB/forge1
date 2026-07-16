-- 006_profile_public_read_rls.sql
-- Fixes profile pages returning empty/error for anon and authenticated users.
-- Run in Supabase SQL Editor after 005 (see START-HERE.md).
--
-- Root cause: missing or role-restricted SELECT policies on profiles / worker_profiles
-- and related tables used by the public profile page.

-- ---------------------------------------------------------------------------
-- profiles — public read (needed for joins and customer fallback view)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- worker_profiles — public read (worker search + /profile/:id)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Worker profiles are viewable by everyone" ON public.worker_profiles;

CREATE POLICY "Worker profiles are viewable by everyone"
  ON public.worker_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Profile page related tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Portfolios are viewable by everyone" ON public.worker_portfolios;

CREATE POLICY "Portfolios are viewable by everyone"
  ON public.worker_portfolios
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Endorsements are viewable by everyone" ON public.worker_endorsements;

CREATE POLICY "Endorsements are viewable by everyone"
  ON public.worker_endorsements
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;

CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);
