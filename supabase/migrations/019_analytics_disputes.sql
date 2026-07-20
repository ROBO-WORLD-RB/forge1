-- ============================================
-- Forge M6: Analytics events + booking disputes
-- Migration 019
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor (after 018), or `supabase db push`.
--
-- Additive only:
--   • analytics_events — product analytics (replaces sole localStorage reliance)
--   • disputes — booking disputes MVP (open / resolved / closed)
--   • Block escrow release while an open dispute exists
--   • Admin profile list helper (search name / username / phone / email)
-- ============================================

-- --------------------------------------------
-- 1. analytics_events
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_id TEXT,
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx
  ON public.analytics_events (user_id);
CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx
  ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_created_idx
  ON public.analytics_events (created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own analytics events" ON public.analytics_events;
CREATE POLICY "Users can insert own analytics events"
  ON public.analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Anon can insert anonymous analytics events" ON public.analytics_events;
CREATE POLICY "Anon can insert anonymous analytics events"
  ON public.analytics_events
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "Users can view own analytics events" ON public.analytics_events;
CREATE POLICY "Users can view own analytics events"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.analytics_events IS
  'M6: server-side product analytics (page_view, booking_created, apply, favorite, ai_match, …)';

-- --------------------------------------------
-- 2. disputes
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  opener_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'closed')),
  notes TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disputes_booking_id_idx ON public.disputes (booking_id);
CREATE INDEX IF NOT EXISTS disputes_opener_id_idx ON public.disputes (opener_id);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON public.disputes (status);
CREATE INDEX IF NOT EXISTS disputes_created_idx ON public.disputes (created_at DESC);

-- At most one open dispute per booking
CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_open_per_booking_idx
  ON public.disputes (booking_id)
  WHERE status = 'open';

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Booking parties can open a dispute (IN_PROGRESS / COMPLETED / REVIEWED only)
DROP POLICY IF EXISTS "Booking parties can open disputes" ON public.disputes;
CREATE POLICY "Booking parties can open disputes"
  ON public.disputes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = opener_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.customer_user_id = auth.uid() OR b.worker_user_id = auth.uid())
        AND b.status IN ('IN_PROGRESS', 'COMPLETED', 'REVIEWED')
    )
  );

-- Parties + admin can read
DROP POLICY IF EXISTS "Parties and admins can view disputes" ON public.disputes;
CREATE POLICY "Parties and admins can view disputes"
  ON public.disputes
  FOR SELECT
  TO authenticated
  USING (
    opener_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.customer_user_id = auth.uid() OR b.worker_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Opener may update reason/notes only while open (not status — admin resolves)
DROP POLICY IF EXISTS "Opener can update open dispute notes" ON public.disputes;
CREATE POLICY "Opener can update open dispute notes"
  ON public.disputes
  FOR UPDATE
  TO authenticated
  USING (opener_id = auth.uid() AND status = 'open')
  WITH CHECK (opener_id = auth.uid() AND status = 'open');

-- Admin full update (resolve / close / notes)
DROP POLICY IF EXISTS "Admins can update disputes" ON public.disputes;
CREATE POLICY "Admins can update disputes"
  ON public.disputes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.disputes IS
  'M6: booking disputes MVP. Open dispute blocks escrow release until resolved/closed.';

-- --------------------------------------------
-- 3. Block escrow release when open dispute exists
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.release_escrow_hold(
  p_booking_id UUID
)
RETURNS public.escrow_holds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings;
  v_hold public.escrow_holds;
  v_wallet public.wallets;
  v_caller UUID := auth.uid();
  v_open_dispute BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller IS NOT NULL
     AND v_caller IS DISTINCT FROM v_booking.customer_user_id
     AND v_caller IS DISTINCT FROM v_booking.worker_user_id THEN
    RAISE EXCEPTION 'permission denied: not a booking party'
      USING ERRCODE = '42501';
  END IF;

  IF v_booking.status NOT IN ('COMPLETED', 'REVIEWED') THEN
    RAISE EXCEPTION 'cannot release escrow: booking status is %', v_booking.status
      USING ERRCODE = '22023';
  END IF;

  -- M6: pause escrow release while a dispute is open
  SELECT EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.booking_id = p_booking_id AND d.status = 'open'
  ) INTO v_open_dispute;

  IF v_open_dispute THEN
    RAISE EXCEPTION 'cannot release escrow: open dispute on booking'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_hold
  FROM public.escrow_holds
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no escrow hold for booking' USING ERRCODE = 'P0002';
  END IF;

  IF v_hold.status = 'released' THEN
    RETURN v_hold;
  END IF;

  IF v_hold.status IS DISTINCT FROM 'held' THEN
    RAISE EXCEPTION 'cannot release escrow: hold status is %', v_hold.status
      USING ERRCODE = '22023';
  END IF;

  v_wallet := public.ensure_wallet(v_hold.worker_user_id, v_hold.currency);

  UPDATE public.wallets
  SET pending_balance = pending_balance - v_hold.amount,
      available_balance = available_balance + v_hold.amount,
      updated_at = now()
  WHERE id = v_wallet.id
    AND pending_balance >= v_hold.amount
  RETURNING * INTO v_wallet;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient pending balance to release escrow'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.escrow_holds
  SET status = 'released',
      released_at = now(),
      updated_at = now()
  WHERE id = v_hold.id
  RETURNING * INTO v_hold;

  INSERT INTO public.wallet_ledger_entries (
    wallet_id,
    entry_type,
    amount,
    currency,
    direction,
    balance_available_after,
    balance_pending_after,
    booking_id,
    escrow_hold_id,
    provider_txn_id,
    description
  ) VALUES (
    v_wallet.id,
    'escrow_release',
    v_hold.amount,
    v_hold.currency,
    'credit',
    v_wallet.available_balance,
    v_wallet.pending_balance,
    p_booking_id,
    v_hold.id,
    v_hold.provider_txn_id,
    'Escrow released to available balance after job completion'
  );

  UPDATE public.bookings
  SET payment_status = 'released',
      updated_at = now()
  WHERE id = p_booking_id;

  RETURN v_hold;
END;
$$;

REVOKE ALL ON FUNCTION public.release_escrow_hold(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_escrow_hold(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_escrow_hold(UUID) TO service_role;

-- Admin resolve / close dispute (sets resolved_by / resolved_at)
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.disputes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_dispute public.disputes;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_caller AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'permission denied: admin only' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'invalid status: % (use resolved or closed)', p_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.disputes
  SET status = p_status,
      notes = COALESCE(p_notes, notes),
      resolved_by = v_caller,
      resolved_at = now(),
      updated_at = now()
  WHERE id = p_dispute_id
  RETURNING * INTO v_dispute;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'dispute not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_dispute;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) TO authenticated;

-- After admin resolves, try to release escrow if booking already COMPLETED/REVIEWED
CREATE OR REPLACE FUNCTION public.try_release_escrow_after_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('resolved', 'closed')
     AND OLD.status = 'open' THEN
    BEGIN
      PERFORM public.release_escrow_hold(NEW.booking_id);
    EXCEPTION
      WHEN SQLSTATE 'P0002' THEN
        NULL; -- no hold
      WHEN SQLSTATE '22023' THEN
        NULL; -- booking not complete / hold not held / another open dispute
      WHEN OTHERS THEN
        RAISE WARNING 'post-dispute escrow release on booking % failed: %', NEW.booking_id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS disputes_try_release_escrow ON public.disputes;
CREATE TRIGGER disputes_try_release_escrow
  AFTER UPDATE OF status ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.try_release_escrow_after_dispute();

-- --------------------------------------------
-- 4. Admin profile search (name / username / phone / email)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_search_profiles(
  p_query TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  phone TEXT,
  role TEXT,
  country TEXT,
  verified BOOLEAN,
  worker_status TEXT,
  created_at TIMESTAMPTZ,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_q TEXT := NULLIF(trim(COALESCE(p_query, '')), '');
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_caller AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'permission denied: admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.username,
    p.phone,
    p.role,
    p.country,
    p.verified,
    p.worker_status,
    p.created_at,
    u.email::TEXT
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE v_q IS NULL
     OR p.first_name ILIKE '%' || v_q || '%'
     OR p.last_name ILIKE '%' || v_q || '%'
     OR p.username ILIKE '%' || v_q || '%'
     OR p.phone ILIKE '%' || v_q || '%'
     OR COALESCE(u.email, '') ILIKE '%' || v_q || '%'
  ORDER BY p.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_profiles(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_profiles(TEXT, INT) TO authenticated;

COMMENT ON FUNCTION public.admin_search_profiles IS
  'M6: admin-only profile list with auth.users email for Users tab search';
