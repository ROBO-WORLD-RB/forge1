-- ============================================
-- 022 — Fix OAuth worker role assignment
-- ============================================
-- assign_initial_role() was blocked by prevent_profile_privilege_escalation()
-- whenever it tried to promote a new OAuth user from customer → worker.
-- Run in Supabase SQL Editor after 021.
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
  -- One-time OAuth / signup role assignment (assign_initial_role)
  IF current_setting('app.assign_initial_role', true) = '1' THEN
    RETURN NEW;
  END IF;

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

  PERFORM set_config('app.assign_initial_role', '1', true);

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
    AND created_at > NOW() - INTERVAL '7 days';

  PERFORM set_config('app.assign_initial_role', '0', true);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_initial_role(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_initial_role(TEXT) TO authenticated;

COMMENT ON FUNCTION public.assign_initial_role(TEXT) IS
  'One-time OAuth/signup role assignment. Bypasses privilege trigger via app.assign_initial_role session flag.';
