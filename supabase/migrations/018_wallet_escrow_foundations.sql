-- ============================================
-- Forge M4: Wallet + escrow foundations
-- Migration 018
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor (after 017), or `supabase db push`.
--
-- Additive only:
--   • wallets (per user + currency)
--   • wallet_ledger_entries (append-only)
--   • escrow_holds (booking-linked hold state machine)
--   • payout_accounts (stub for future bank payouts)
--   • bookings.payment_status
--
-- Writes to wallets / ledger / holds: SECURITY DEFINER RPCs or service role only.
-- Users may SELECT own wallet, ledger, and holds they are party to.
--
-- Paystack card refunds are NOT automated here — refund_escrow_hold marks the
-- platform hold refunded; operator may issue a Paystack refund manually later.
-- ============================================

-- --------------------------------------------
-- 1. bookings.payment_status (additive)
-- --------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_payment_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_payment_status_check
      CHECK (payment_status IN (
        'unpaid', 'pending', 'held', 'released', 'refunded', 'failed'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookings_payment_status_idx
  ON public.bookings (payment_status);

-- --------------------------------------------
-- 2. wallets
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('GHS', 'NGN')),
  available_balance NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (available_balance >= 0),
  pending_balance NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (pending_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallets_user_currency_unique UNIQUE (user_id, currency)
);

CREATE INDEX IF NOT EXISTS wallets_user_id_idx ON public.wallets (user_id);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallets" ON public.wallets;
CREATE POLICY "Users can view own wallets"
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for authenticated — RPCs / service role only.

-- --------------------------------------------
-- 3. escrow_holds
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.escrow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('GHS', 'NGN')),
  status TEXT NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'released', 'refunded', 'cancelled')),
  provider_txn_id TEXT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  held_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT escrow_holds_booking_unique UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS escrow_holds_worker_id_idx
  ON public.escrow_holds (worker_user_id);
CREATE INDEX IF NOT EXISTS escrow_holds_customer_id_idx
  ON public.escrow_holds (customer_user_id);
CREATE INDEX IF NOT EXISTS escrow_holds_status_idx
  ON public.escrow_holds (status);
CREATE INDEX IF NOT EXISTS escrow_holds_provider_txn_idx
  ON public.escrow_holds (provider_txn_id)
  WHERE provider_txn_id IS NOT NULL;

ALTER TABLE public.escrow_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parties can view booking escrow holds" ON public.escrow_holds;
CREATE POLICY "Parties can view booking escrow holds"
  ON public.escrow_holds
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = customer_user_id
    OR auth.uid() = worker_user_id
  );

-- --------------------------------------------
-- 4. wallet_ledger_entries (append-only)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'escrow_hold',
    'escrow_release',
    'escrow_refund',
    'adjustment',
    'withdrawal_request'
  )),
  amount NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('GHS', 'NGN')),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  balance_available_after NUMERIC(14, 2) NOT NULL,
  balance_pending_after NUMERIC(14, 2) NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  escrow_hold_id UUID REFERENCES public.escrow_holds(id) ON DELETE SET NULL,
  provider_txn_id TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_ledger_wallet_created_idx
  ON public.wallet_ledger_entries (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_ledger_booking_idx
  ON public.wallet_ledger_entries (booking_id)
  WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wallet_ledger_hold_idx
  ON public.wallet_ledger_entries (escrow_hold_id)
  WHERE escrow_hold_id IS NOT NULL;

ALTER TABLE public.wallet_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet ledger" ON public.wallet_ledger_entries;
CREATE POLICY "Users can view own wallet ledger"
  ON public.wallet_ledger_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.wallets w
      WHERE w.id = wallet_ledger_entries.wallet_id
        AND w.user_id = auth.uid()
    )
  );

-- --------------------------------------------
-- 5. payout_accounts (stub — no real transfers yet)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paystack',
  account_status TEXT NOT NULL DEFAULT 'stub'
    CHECK (account_status IN ('stub', 'pending', 'verified', 'disabled')),
  bank_name TEXT,
  account_last4 TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payout_accounts_user_provider_unique UNIQUE (user_id, provider)
);

ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payout accounts" ON public.payout_accounts;
CREATE POLICY "Users can view own payout accounts"
  ON public.payout_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own payout stubs" ON public.payout_accounts;
CREATE POLICY "Users can upsert own payout stubs"
  ON public.payout_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND account_status = 'stub'
  );

DROP POLICY IF EXISTS "Users can update own payout stubs" ON public.payout_accounts;
CREATE POLICY "Users can update own payout stubs"
  ON public.payout_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND account_status = 'stub'
  );

-- --------------------------------------------
-- 6. Helpers + RPCs (SECURITY DEFINER)
-- --------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_wallet(
  p_user_id UUID,
  p_currency TEXT
)
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets;
BEGIN
  IF p_currency NOT IN ('GHS', 'NGN') THEN
    RAISE EXCEPTION 'invalid currency: %', p_currency USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.wallets (user_id, currency)
  VALUES (p_user_id, p_currency)
  ON CONFLICT (user_id, currency) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = p_currency;

  RETURN v_wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_wallet(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(UUID, TEXT) TO service_role;

-- Fund escrow after verified booking payment (idempotent).
-- Callable by: service role (webhook), or booking customer/worker after payment.
CREATE OR REPLACE FUNCTION public.fund_booking_escrow(
  p_booking_id UUID,
  p_provider_txn_id TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT NULL
)
RETURNS public.escrow_holds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings;
  v_txn public.transactions;
  v_hold public.escrow_holds;
  v_wallet public.wallets;
  v_amount NUMERIC(14, 2);
  v_currency TEXT;
  v_provider_txn TEXT;
  v_caller UUID := auth.uid();
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;

  -- AuthZ: service role (uid null) or booking party
  IF v_caller IS NOT NULL
     AND v_caller IS DISTINCT FROM v_booking.customer_user_id
     AND v_caller IS DISTINCT FROM v_booking.worker_user_id THEN
    RAISE EXCEPTION 'permission denied: not a booking party'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotent: existing hold
  SELECT * INTO v_hold FROM public.escrow_holds WHERE booking_id = p_booking_id;
  IF FOUND THEN
    RETURN v_hold;
  END IF;

  v_provider_txn := NULLIF(trim(COALESCE(p_provider_txn_id, '')), '');

  IF v_provider_txn IS NOT NULL THEN
    SELECT * INTO v_txn
    FROM public.transactions
    WHERE provider_txn_id = v_provider_txn
      AND type = 'booking'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND AND v_provider_txn IS NULL THEN
    SELECT * INTO v_txn
    FROM public.transactions
    WHERE type = 'booking'
      AND (metadata->>'booking_id') = p_booking_id::text
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Authenticated clients must fund from an existing booking transaction (ignore client amount).
  -- Service role (webhook) may supply amount/currency when creating the hold.
  IF v_caller IS NOT NULL THEN
    IF v_txn.id IS NULL THEN
      RAISE EXCEPTION 'cannot fund escrow: booking transaction not found'
        USING ERRCODE = 'P0002';
    END IF;
    IF v_txn.status IS DISTINCT FROM 'success' THEN
      RAISE EXCEPTION 'cannot fund escrow: payment not confirmed yet'
        USING ERRCODE = '42501';
    END IF;
    IF v_txn.user_id IS DISTINCT FROM v_booking.customer_user_id THEN
      RAISE EXCEPTION 'cannot fund escrow: transaction user mismatch'
        USING ERRCODE = '42501';
    END IF;
    v_amount := v_txn.amount;
    v_currency := v_txn.currency;
  ELSE
    v_amount := COALESCE(p_amount, v_txn.amount);
    v_currency := COALESCE(p_currency, v_txn.currency);

    IF v_txn.id IS NOT NULL AND v_txn.status NOT IN ('success', 'pending') THEN
      RAISE EXCEPTION 'cannot fund escrow: transaction status is %', v_txn.status
        USING ERRCODE = '22023';
    END IF;

    IF v_txn.id IS NOT NULL AND v_txn.status = 'pending' THEN
      UPDATE public.transactions
      SET status = 'success',
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('booking_id', p_booking_id)
      WHERE id = v_txn.id;
    END IF;
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'cannot fund escrow: missing amount' USING ERRCODE = '22023';
  END IF;
  IF v_currency IS NULL OR v_currency NOT IN ('GHS', 'NGN') THEN
    RAISE EXCEPTION 'cannot fund escrow: invalid currency' USING ERRCODE = '22023';
  END IF;

  IF v_txn.id IS NOT NULL THEN
    UPDATE public.transactions
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('booking_id', p_booking_id)
    WHERE id = v_txn.id
      AND (metadata->>'booking_id') IS NULL;
  END IF;

  v_wallet := public.ensure_wallet(v_booking.worker_user_id, v_currency);

  UPDATE public.wallets
  SET pending_balance = pending_balance + v_amount,
      updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  INSERT INTO public.escrow_holds (
    booking_id,
    customer_user_id,
    worker_user_id,
    amount,
    currency,
    status,
    provider_txn_id,
    transaction_id,
    held_at
  ) VALUES (
    p_booking_id,
    v_booking.customer_user_id,
    v_booking.worker_user_id,
    v_amount,
    v_currency,
    'held',
    COALESCE(v_provider_txn, v_txn.provider_txn_id),
    v_txn.id,
    now()
  )
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
    'escrow_hold',
    v_amount,
    v_currency,
    'credit',
    v_wallet.available_balance,
    v_wallet.pending_balance,
    p_booking_id,
    v_hold.id,
    v_hold.provider_txn_id,
    'Booking payment held in escrow (pending release)'
  );

  UPDATE public.bookings
  SET payment_status = 'held',
      updated_at = now()
  WHERE id = p_booking_id;

  RETURN v_hold;
END;
$$;

REVOKE ALL ON FUNCTION public.fund_booking_escrow(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fund_booking_escrow(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_booking_escrow(UUID, TEXT, NUMERIC, TEXT) TO service_role;

-- Release held funds to worker available balance (COMPLETED / REVIEWED).
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
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;

  -- Trigger runs as the party who updated status; service role has uid null.
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

-- Mark hold refunded + clear worker pending.
-- Does NOT call Paystack refund API — document as manual/future operator step.
CREATE OR REPLACE FUNCTION public.refund_escrow_hold(
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

  IF v_booking.status IS DISTINCT FROM 'CANCELLED' THEN
    RAISE EXCEPTION 'cannot refund escrow: booking status is %', v_booking.status
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_hold
  FROM public.escrow_holds
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no escrow hold for booking' USING ERRCODE = 'P0002';
  END IF;

  IF v_hold.status = 'refunded' THEN
    RETURN v_hold;
  END IF;

  IF v_hold.status IS DISTINCT FROM 'held' THEN
    RAISE EXCEPTION 'cannot refund escrow: hold status is %', v_hold.status
      USING ERRCODE = '22023';
  END IF;

  v_wallet := public.ensure_wallet(v_hold.worker_user_id, v_hold.currency);

  UPDATE public.wallets
  SET pending_balance = pending_balance - v_hold.amount,
      updated_at = now()
  WHERE id = v_wallet.id
    AND pending_balance >= v_hold.amount
  RETURNING * INTO v_wallet;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient pending balance to refund escrow'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.escrow_holds
  SET status = 'refunded',
      refunded_at = now(),
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
    description,
    metadata
  ) VALUES (
    v_wallet.id,
    'escrow_refund',
    v_hold.amount,
    v_hold.currency,
    'debit',
    v_wallet.available_balance,
    v_wallet.pending_balance,
    p_booking_id,
    v_hold.id,
    v_hold.provider_txn_id,
    'Escrow hold refunded on cancellation (Paystack refund may be manual)',
    jsonb_build_object(
      'paystack_refund', 'manual_or_future',
      'note', 'Platform hold cleared; card refund via Paystack Transfer/Refund API not automated in M4'
    )
  );

  UPDATE public.bookings
  SET payment_status = 'refunded',
      updated_at = now()
  WHERE id = p_booking_id;

  RETURN v_hold;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_escrow_hold(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_escrow_hold(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_escrow_hold(UUID) TO service_role;

-- --------------------------------------------
-- 7. Triggers: auto release / refund with booking FSM
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.booking_escrow_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Release when work is completed
  IF NEW.status IN ('COMPLETED', 'REVIEWED')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      PERFORM public.release_escrow_hold(NEW.id);
    EXCEPTION
      WHEN SQLSTATE 'P0002' THEN
        -- No hold yet (unpaid booking) — ignore
        NULL;
      WHEN OTHERS THEN
        RAISE WARNING 'escrow release on booking % failed: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- Refund when cancelled before work starts (PENDING / ACCEPTED)
  IF NEW.status = 'CANCELLED'
     AND OLD.status IN ('PENDING', 'ACCEPTED') THEN
    BEGIN
      PERFORM public.refund_escrow_hold(NEW.id);
    EXCEPTION
      WHEN SQLSTATE 'P0002' THEN
        NULL;
      WHEN OTHERS THEN
        RAISE WARNING 'escrow refund on booking % failed: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_escrow_on_status_change ON public.bookings;
CREATE TRIGGER booking_escrow_on_status_change
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.booking_escrow_status_trigger();

-- --------------------------------------------
-- 8. updated_at helpers
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallets_set_updated_at ON public.wallets;
CREATE TRIGGER wallets_set_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS escrow_holds_set_updated_at ON public.escrow_holds;
CREATE TRIGGER escrow_holds_set_updated_at
  BEFORE UPDATE ON public.escrow_holds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS payout_accounts_set_updated_at ON public.payout_accounts;
CREATE TRIGGER payout_accounts_set_updated_at
  BEFORE UPDATE ON public.payout_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
