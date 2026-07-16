-- ============================================
-- Forge: Skip worker onboarding fee (beta)
-- Migration 010
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor if not
-- applied via CLI. Workers become active on profile
-- completion; Paystack onboarding fee is deferred.
-- ============================================

-- Allow pending / pending_payment → active during onboarding
-- (privilege trigger previously only allowed pending → pending_payment)
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
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
    -- Beta: skip onboarding fee — allow advance to active from onboarding states
    IF OLD.role = 'worker'
       AND OLD.worker_status IN ('pending', 'pending_payment')
       AND NEW.worker_status IN ('pending_payment', 'active') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'permission denied: cannot change worker_status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Complete onboarding → profile_completed + active (no payment gate)
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
    RAISE EXCEPTION 'not authenticated'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    profile_completed = true,
    worker_status = CASE
      WHEN worker_status IN ('pending', 'pending_payment') THEN 'active'
      ELSE worker_status
    END,
    updated_at = NOW()
  WHERE id = auth.uid()
    AND role = 'worker'
  RETURNING * INTO updated;

  IF updated IS NULL THEN
    RAISE EXCEPTION 'worker profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN updated;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_worker_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_worker_onboarding() TO authenticated;

COMMENT ON FUNCTION public.complete_worker_onboarding() IS
  'Marks the calling worker profile_completed and sets pending/pending_payment → active (onboarding fee deferred for beta).';

-- Activate existing workers stuck on payment gate
UPDATE public.profiles
SET
  worker_status = 'active',
  updated_at = NOW()
WHERE role = 'worker'
  AND profile_completed = true
  AND worker_status = 'pending_payment';
