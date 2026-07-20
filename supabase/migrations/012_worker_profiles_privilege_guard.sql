-- ============================================
-- Forge M0: Block worker self-escalation of tier / verified
-- Migration 012
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor (after 011), or `supabase db push`.
--
-- Mirrors profiles privilege trigger (002): non-admins cannot change
-- worker_profiles.tier or worker_profiles.verified. Service-role / webhook
-- contexts (auth.uid() IS NULL) and admins retain write access.
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_worker_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  -- service_role / server contexts (webhooks, Edge Functions) bypass checks
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

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.tier, 'free') IS DISTINCT FROM 'free' THEN
      RAISE EXCEPTION 'permission denied: cannot set worker tier'
        USING ERRCODE = '42501';
    END IF;
    IF COALESCE(NEW.verified, false) IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'permission denied: cannot set verified status'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    RAISE EXCEPTION 'permission denied: cannot change worker tier'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    RAISE EXCEPTION 'permission denied: cannot change verified status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_worker_profile_privilege_limits ON public.worker_profiles;
CREATE TRIGGER enforce_worker_profile_privilege_limits
  BEFORE INSERT OR UPDATE ON public.worker_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_worker_profile_privilege_escalation();
