-- ============================================
-- 022 — Togo/XOF support + non-recursive profile updates
-- ============================================
-- Safe to run on an existing database. GH/GHS and NG/NGN remain valid.

BEGIN;

-- Country is the durable account preference. Currency is stored on monetary rows.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_country_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_country_check
  CHECK (country IS NULL OR country IN ('GH', 'NG', 'TG')) NOT VALID;

ALTER TABLE public.worker_profiles
  DROP CONSTRAINT IF EXISTS worker_profiles_country_check,
  DROP CONSTRAINT IF EXISTS worker_profiles_currency_check;
ALTER TABLE public.worker_profiles
  ADD CONSTRAINT worker_profiles_country_check CHECK (country IN ('GH', 'NG', 'TG')),
  ADD CONSTRAINT worker_profiles_currency_check CHECK (currency IS NULL OR currency IN ('GHS', 'NGN', 'XOF'));
ALTER TABLE public.worker_profiles DROP CONSTRAINT IF EXISTS worker_profiles_country_currency_check;
ALTER TABLE public.worker_profiles
  ADD CONSTRAINT worker_profiles_country_currency_check CHECK (
    currency IS NULL OR
    (country = 'GH' AND currency = 'GHS') OR
    (country = 'NG' AND currency = 'NGN') OR
    (country = 'TG' AND currency = 'XOF')
  ) NOT VALID;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_country_check,
  DROP CONSTRAINT IF EXISTS jobs_currency_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_country_check CHECK (country IN ('GH', 'NG', 'TG')),
  ADD CONSTRAINT jobs_currency_check CHECK (currency IS NULL OR currency IN ('GHS', 'NGN', 'XOF'));
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_country_currency_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_country_currency_check CHECK (
    currency IS NULL OR
    (country = 'GH' AND currency = 'GHS') OR
    (country = 'NG' AND currency = 'NGN') OR
    (country = 'TG' AND currency = 'XOF')
  ) NOT VALID;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_currency_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_currency_check CHECK (currency IN ('GHS', 'NGN', 'XOF'));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_currency_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_currency_check CHECK (currency IN ('GHS', 'NGN', 'XOF'));

ALTER TABLE public.worker_payments DROP CONSTRAINT IF EXISTS worker_payments_currency_check;
ALTER TABLE public.worker_payments
  ADD CONSTRAINT worker_payments_currency_check CHECK (currency IN ('GHS', 'NGN', 'XOF'));

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_currency_check;
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_currency_check CHECK (currency IN ('GHS', 'NGN', 'XOF'));

ALTER TABLE public.escrow_holds DROP CONSTRAINT IF EXISTS escrow_holds_currency_check;
ALTER TABLE public.escrow_holds
  ADD CONSTRAINT escrow_holds_currency_check CHECK (currency IN ('GHS', 'NGN', 'XOF'));

ALTER TABLE public.wallet_ledger_entries DROP CONSTRAINT IF EXISTS wallet_ledger_entries_currency_check;
ALTER TABLE public.wallet_ledger_entries
  ADD CONSTRAINT wallet_ledger_entries_currency_check CHECK (currency IN ('GHS', 'NGN', 'XOF'));

-- SECURITY DEFINER bypasses profiles RLS for the role lookup. A policy on
-- profiles must never query profiles directly or PostgreSQL recurses forever.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

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
  IF p_currency NOT IN ('GHS', 'NGN', 'XOF') THEN
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

-- Replace the escrow funding RPC so an XOF transaction can be held without
-- being rejected by the old two-currency validation branch.
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

  IF v_caller IS NOT NULL
     AND v_caller IS DISTINCT FROM v_booking.customer_user_id
     AND v_caller IS DISTINCT FROM v_booking.worker_user_id THEN
    RAISE EXCEPTION 'permission denied: not a booking party' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_hold FROM public.escrow_holds WHERE booking_id = p_booking_id;
  IF FOUND THEN RETURN v_hold; END IF;

  v_provider_txn := NULLIF(trim(COALESCE(p_provider_txn_id, '')), '');
  IF v_provider_txn IS NOT NULL THEN
    SELECT * INTO v_txn FROM public.transactions
    WHERE provider_txn_id = v_provider_txn AND type = 'booking'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF NOT FOUND AND v_provider_txn IS NULL THEN
    SELECT * INTO v_txn FROM public.transactions
    WHERE type = 'booking' AND (metadata->>'booking_id') = p_booking_id::text
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_caller IS NOT NULL THEN
    IF v_txn.id IS NULL THEN
      RAISE EXCEPTION 'cannot fund escrow: booking transaction not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_txn.status IS DISTINCT FROM 'success' THEN
      RAISE EXCEPTION 'cannot fund escrow: payment not confirmed yet' USING ERRCODE = '42501';
    END IF;
    IF v_txn.user_id IS DISTINCT FROM v_booking.customer_user_id THEN
      RAISE EXCEPTION 'cannot fund escrow: transaction user mismatch' USING ERRCODE = '42501';
    END IF;
    v_amount := v_txn.amount;
    v_currency := v_txn.currency;
  ELSE
    v_amount := COALESCE(p_amount, v_txn.amount);
    v_currency := COALESCE(p_currency, v_txn.currency);
    IF v_txn.id IS NOT NULL AND v_txn.status NOT IN ('success', 'pending') THEN
      RAISE EXCEPTION 'cannot fund escrow: transaction status is %', v_txn.status USING ERRCODE = '22023';
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
  IF v_currency IS NULL OR v_currency NOT IN ('GHS', 'NGN', 'XOF') THEN
    RAISE EXCEPTION 'cannot fund escrow: invalid currency' USING ERRCODE = '22023';
  END IF;

  IF v_txn.id IS NOT NULL THEN
    UPDATE public.transactions
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('booking_id', p_booking_id)
    WHERE id = v_txn.id AND (metadata->>'booking_id') IS NULL;
  END IF;

  v_wallet := public.ensure_wallet(v_booking.worker_user_id, v_currency);
  UPDATE public.wallets
  SET pending_balance = pending_balance + v_amount, updated_at = now()
  WHERE id = v_wallet.id RETURNING * INTO v_wallet;

  INSERT INTO public.escrow_holds (
    booking_id, customer_user_id, worker_user_id, amount, currency, status,
    provider_txn_id, transaction_id, held_at
  ) VALUES (
    p_booking_id, v_booking.customer_user_id, v_booking.worker_user_id,
    v_amount, v_currency, 'held', COALESCE(v_provider_txn, v_txn.provider_txn_id),
    v_txn.id, now()
  ) RETURNING * INTO v_hold;

  INSERT INTO public.wallet_ledger_entries (
    wallet_id, entry_type, amount, currency, direction,
    balance_available_after, balance_pending_after, booking_id,
    escrow_hold_id, provider_txn_id, description
  ) VALUES (
    v_wallet.id, 'escrow_hold', v_amount, v_currency, 'credit',
    v_wallet.available_balance, v_wallet.pending_balance, p_booking_id,
    v_hold.id, v_hold.provider_txn_id,
    'Booking payment held in escrow (pending release)'
  );

  UPDATE public.bookings SET payment_status = 'held', updated_at = now()
  WHERE id = p_booking_id;
  RETURN v_hold;
END;
$$;

REVOKE ALL ON FUNCTION public.fund_booking_escrow(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fund_booking_escrow(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_booking_escrow(UUID, TEXT, NUMERIC, TEXT) TO service_role;

COMMENT ON CONSTRAINT profiles_country_check ON public.profiles IS
  'Supported signup countries. Currency is derived in the app and copied to monetary rows.';

COMMIT;
