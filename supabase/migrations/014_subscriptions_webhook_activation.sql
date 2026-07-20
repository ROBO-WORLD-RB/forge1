-- ============================================
-- Forge M0: Subscription activation webhook-only
-- Migration 014
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor (after 013), or `supabase db push`.
--
-- Fixes:
--   • Add pending status — client may only create pending rows after Paystack checkout
--   • Clients cannot INSERT/UPDATE subscriptions to active (service role / webhook only)
--   • Users may cancel (active → cancelled) and disable auto_renew
-- ============================================

-- --------------------------------------------
-- 1. Allow pending in status CHECK
-- --------------------------------------------
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending', 'active', 'cancelled', 'expired'));

-- --------------------------------------------
-- 2. Trigger — block client activation / tier abuse
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_subscription_client_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  -- service_role / webhook (auth.uid() null) bypass
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
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'permission denied: subscriptions must be created as pending; activation is webhook-only'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: cannot transition into active from client
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'permission denied: cannot activate subscription from client'
      USING ERRCODE = '42501';
  END IF;

  -- Cannot extend expiry or change tier while impersonating payment success
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    RAISE EXCEPTION 'permission denied: cannot change subscription tier from client'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at
     AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    -- Allow no expiry bump except via service role
    RAISE EXCEPTION 'permission denied: cannot extend subscription expiry from client'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_subscription_activation_limits ON public.subscriptions;
CREATE TRIGGER enforce_subscription_activation_limits
  BEFORE INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_subscription_client_activation();

-- --------------------------------------------
-- 3. RLS — tighten INSERT / UPDATE
-- --------------------------------------------
DROP POLICY IF EXISTS "Users can create subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;

CREATE POLICY "Users can create pending subscriptions"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- Users may cancel (→ cancelled) or abandon pending; cannot set/keep active via client.
-- Trigger still blocks client activation and tier/expiry abuse.
CREATE POLICY "Users can update own non-active subscription fields"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('pending', 'cancelled', 'expired')
  );

-- Admins read all (dashboard stats)
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
