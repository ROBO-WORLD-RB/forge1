-- ============================================
-- Forge: Security hardening — profiles role / status
-- Migration 002
-- ============================================
-- APPLY THIS MIGRATION in Supabase Dashboard → SQL Editor:
--   1. Open your Forge project in https://supabase.com/dashboard
--   2. Go to SQL Editor → New query
--   3. Paste this entire file and click Run
--
-- Alternatively: `supabase db push` if you use the Supabase CLI locally.
--
-- Fixes:
--   • handle_new_user() no longer honors role=admin from signup metadata
--   • RLS + trigger block non-admins from changing role, worker_status, verified
--   • service_role (webhooks) and admins retain full update access
-- ============================================

-- --------------------------------------------
-- 1. Harden signup trigger — never assign admin
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
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';

  IF meta_role IN ('worker', 'customer') THEN
    assigned_role := meta_role;
  ELSE
    assigned_role := 'customer';
  END IF;

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
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    assigned_role,
    NEW.raw_user_meta_data->>'firstName',
    NEW.raw_user_meta_data->>'lastName',
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'country', 'GH'),
    (assigned_role = 'customer'),
    CASE WHEN assigned_role = 'worker' THEN 'pending' ELSE 'active' END,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------
-- 2. Trigger — block privilege escalation on UPDATE
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  -- service_role / server contexts (webhooks) bypass checks
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
    RAISE EXCEPTION 'permission denied: cannot change role'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    RAISE EXCEPTION 'permission denied: cannot change verified status'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    RAISE EXCEPTION 'permission denied: cannot change rating'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.review_count IS DISTINCT FROM OLD.review_count THEN
    RAISE EXCEPTION 'permission denied: cannot change review_count'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.worker_status IS DISTINCT FROM OLD.worker_status THEN
    -- Workers may only advance pending → pending_payment during onboarding
    IF OLD.role = 'worker'
       AND OLD.worker_status = 'pending'
       AND NEW.worker_status = 'pending_payment' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'permission denied: cannot change worker_status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_privilege_limits ON public.profiles;
CREATE TRIGGER enforce_profile_privilege_limits
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- --------------------------------------------
-- 3. RLS — tighten profiles INSERT / UPDATE
-- --------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role IN ('worker', 'customer')
    AND verified = false
    AND worker_status IN ('pending', 'pending_payment', 'active')
  );

CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- --------------------------------------------
-- 4. One-time OAuth / post-signup role assignment
-- --------------------------------------------
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
    -- Profile already has a committed role; no-op
    NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_initial_role(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_initial_role(TEXT) TO authenticated;

-- --------------------------------------------
-- 5. CHECK constraint — role enum at DB level
-- --------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'worker', 'admin'));
