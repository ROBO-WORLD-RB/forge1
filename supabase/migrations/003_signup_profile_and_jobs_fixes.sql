-- ============================================
-- Forge: Signup profile reliability + jobs SELECT clarity
-- Migration 003
-- ============================================
-- APPLY THIS MIGRATION in Supabase Dashboard → SQL Editor:
--   1. Open your Forge project in https://supabase.com/dashboard
--   2. Go to SQL Editor → New query
--   3. Paste this entire file and click Run
--
-- Fixes:
--   • handle_new_user() no longer writes phone='' (broke UNIQUE phone on 2nd OAuth/empty-phone user)
--   • Username collisions no longer abort Auth signup ("Database error saving new user")
--   • Partial unique index on phone (NULLs allowed for many users)
--   • Re-affirm jobs SELECT so posters can always reload their own rows
-- ============================================

-- --------------------------------------------
-- 1. Normalize empty phones → NULL (free UNIQUE slots)
-- --------------------------------------------
UPDATE public.profiles
SET phone = NULL
WHERE phone IS NOT NULL AND btrim(phone) = '';

-- Drop full-column UNIQUE if present (name varies by how table was created)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

DROP INDEX IF EXISTS profiles_phone_unique_not_null;
CREATE UNIQUE INDEX profiles_phone_unique_not_null
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND length(btrim(phone)) > 0;

-- --------------------------------------------
-- 2. Harden signup trigger — resilient profile insert
-- --------------------------------------------
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
  id_suffix TEXT;
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

  id_suffix := substr(replace(NEW.id::text, '-', ''), 1, 8);

  base_username := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'username', '')), '');
  IF base_username IS NOT NULL THEN
    base_username := lower(regexp_replace(base_username, '^@+', '', 'g'));
    base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  END IF;

  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user' || id_suffix;
  END IF;

  final_username := '@' || base_username;

  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE username = final_username
  ) THEN
    final_username := '@' || base_username || '_' || id_suffix;
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      id,
      phone,
      role,
      first_name,
      last_name,
      username,
      country,
      profile_completed,
      worker_status,
      verified
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
      -- Phone or username race: still create a profile so Auth signup succeeds
      INSERT INTO public.profiles (
        id,
        phone,
        role,
        first_name,
        last_name,
        username,
        country,
        profile_completed,
        worker_status,
        verified
      )
      VALUES (
        NEW.id,
        NULL,
        assigned_role,
        NEW.raw_user_meta_data->>'firstName',
        NEW.raw_user_meta_data->>'lastName',
        '@user' || id_suffix || substr(replace(NEW.id::text, '-', ''), 9, 4),
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

-- --------------------------------------------
-- 3. Jobs RLS — posters can SELECT (and everyone can browse open jobs)
-- --------------------------------------------
DROP POLICY IF EXISTS "Jobs are viewable by everyone" ON public.jobs;
CREATE POLICY "Jobs are viewable by everyone"
  ON public.jobs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
CREATE POLICY "Users can create jobs"
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = poster_user_id);

DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
CREATE POLICY "Users can update own jobs"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = poster_user_id)
  WITH CHECK (auth.uid() = poster_user_id);

DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;
CREATE POLICY "Users can delete own jobs"
  ON public.jobs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = poster_user_id);
