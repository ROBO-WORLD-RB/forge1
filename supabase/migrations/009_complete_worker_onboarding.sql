-- ============================================
-- Forge: Atomic worker onboarding completion
-- Migration 009
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor if not
-- applied via CLI. Ensures profile_completed + 
-- worker_status advance together for the caller.
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
    RAISE EXCEPTION 'not authenticated'
      USING ERRCODE = '42501';
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
    RAISE EXCEPTION 'worker profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN updated;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_worker_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_worker_onboarding() TO authenticated;

COMMENT ON FUNCTION public.complete_worker_onboarding() IS
  'Marks the calling worker profile_completed and advances pending → pending_payment.';
