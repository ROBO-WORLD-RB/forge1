-- ============================================
-- Forge M0: KYC self-approval guard + admin path
-- Migration 013
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor (after 012), or `supabase db push`.
--
-- Fixes:
--   • Owners cannot set status to approved/rejected (file replace → pending only)
--   • Admins can SELECT + UPDATE all verification_documents for KYC review
-- ============================================

-- --------------------------------------------
-- 1. Trigger — block KYC self-approval
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_kyc_self_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  -- service_role / server contexts bypass
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

  -- Owners may replace files / resubmit, but never approve or reject
  IF NEW.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'permission denied: cannot approve or reject own verification documents'
      USING ERRCODE = '42501';
  END IF;

  -- Owner updates always reset review metadata and stay pending
  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_kyc_status_limits ON public.verification_documents;
CREATE TRIGGER enforce_kyc_status_limits
  BEFORE UPDATE ON public.verification_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_kyc_self_approval();

-- --------------------------------------------
-- 2. RLS — owner UPDATE (replace while own row)
-- --------------------------------------------
DROP POLICY IF EXISTS "Users can update own documents" ON public.verification_documents;

CREATE POLICY "Users can update own documents"
  ON public.verification_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- --------------------------------------------
-- 3. RLS — admin SELECT / UPDATE for KYC queue
-- --------------------------------------------
DROP POLICY IF EXISTS "Admins can view all verification documents" ON public.verification_documents;
DROP POLICY IF EXISTS "Admins can update all verification documents" ON public.verification_documents;

CREATE POLICY "Admins can view all verification documents"
  ON public.verification_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all verification documents"
  ON public.verification_documents
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
