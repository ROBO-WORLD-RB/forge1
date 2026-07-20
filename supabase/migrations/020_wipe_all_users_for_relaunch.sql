-- =============================================================================
-- ⚠️  WARNING — IRREVERSIBLE PRODUCTION WIPE
-- =============================================================================
-- This script DELETES EVERY AUTH USER and related application data on Forge.
-- After it runs, nobody can log in with an existing account — they must
-- sign up again (fresh auth.users + profiles) to see the new FORGE OS.
--
-- DO NOT run this casually. There is no undo.
--
-- Intended use: one-time relaunch wipe before product re-open.
-- Safe to paste once into Supabase Dashboard → SQL Editor → Run.
--
-- Project (from START-HERE): siutunqbdteyrycrbzub
-- SQL Editor: https://supabase.com/dashboard/project/siutunqbdteyrycrbzub/sql/new
--
-- Supersedes: 011_wipe_all_users_for_relaunch.sql
--   (011 did not clear M2–M6 tables: favorites, job_applications, wallets,
--    wallet_ledger_entries, escrow_holds, payout_accounts, disputes,
--    analytics_events.)
--
-- Why not only `DELETE FROM auth.users`?
--   profiles.id → auth.users(id) ON DELETE CASCADE, and most app tables
--   cascade from profiles. Two FKs do NOT cascade and would block the wipe:
--     • worker_payments.user_id → profiles(id)          (no ON DELETE)
--     • verification_documents.reviewed_by → profiles(id) (no ON DELETE)
--   Also: analytics_events.user_id is ON DELETE SET NULL — rows would linger
--   with null user_id unless we DELETE them explicitly.
--   This script clears blockers + all app user data first, then auth.users.
--
-- Kept: service_categories (catalog seed data).
--
-- Storage (NOT handled here):
--   Supabase blocks direct DELETE on storage.objects (use Storage API / Dashboard).
--   After this script succeeds, optionally empty these buckets in Dashboard:
--     Storage → avatars, job-media, verification-documents → delete all objects
--   Orphaned files may remain until you do that; auth/users/app rows are still wiped.
--
-- If you ran an older version that failed on `DELETE FROM storage.objects`:
--   The whole transaction rolled back — no users were deleted. Re-run THIS script (020).
-- =============================================================================

BEGIN;

-- Snapshot (optional visibility in Results)
SELECT
  (SELECT count(*) FROM auth.users) AS auth_users_before,
  (SELECT count(*) FROM public.profiles) AS profiles_before;

-- -----------------------------------------------------------------------------
-- 1) Clear FK blockers that do NOT ON DELETE CASCADE from profiles
--    (idempotent — safe to re-run)
-- -----------------------------------------------------------------------------
DELETE FROM public.worker_payments;

UPDATE public.verification_documents
SET reviewed_by = NULL
WHERE reviewed_by IS NOT NULL;

UPDATE public.disputes
SET resolved_by = NULL
WHERE resolved_by IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) Explicit app-data cleanup (correct FK order; also covered by cascades)
--    Leaves a clean slate even if some cascades were altered in prod.
--    Includes M2–M6 tables. Missing tables are skipped (idempotent / safe).
-- -----------------------------------------------------------------------------

-- M4 ledger → holds / wallets (children first)
DO $$ BEGIN
  IF to_regclass('public.wallet_ledger_entries') IS NOT NULL THEN
    DELETE FROM public.wallet_ledger_entries;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.escrow_holds') IS NOT NULL THEN
    DELETE FROM public.escrow_holds;
  END IF;
END $$;

-- M6 disputes / analytics
DO $$ BEGIN
  IF to_regclass('public.disputes') IS NOT NULL THEN
    DELETE FROM public.disputes;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    DELETE FROM public.analytics_events;
  END IF;
END $$;

-- M2 favorites / M3 applications
DO $$ BEGIN
  IF to_regclass('public.favorites') IS NOT NULL THEN
    DELETE FROM public.favorites;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.job_applications') IS NOT NULL THEN
    DELETE FROM public.job_applications;
  END IF;
END $$;

-- M4 wallets / payout stubs
DO $$ BEGIN
  IF to_regclass('public.payout_accounts') IS NOT NULL THEN
    DELETE FROM public.payout_accounts;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.wallets') IS NOT NULL THEN
    DELETE FROM public.wallets;
  END IF;
END $$;

-- Core app tables (pre-M2)
DELETE FROM public.messages;
DELETE FROM public.conversations;
DELETE FROM public.reviews;
DELETE FROM public.bookings;
DELETE FROM public.notifications;
DELETE FROM public.device_tokens;
DELETE FROM public.transactions;
DELETE FROM public.subscriptions;
DELETE FROM public.worker_endorsements;
DELETE FROM public.worker_portfolios;
DELETE FROM public.verification_documents;
DELETE FROM public.jobs;
DELETE FROM public.worker_profiles;

-- -----------------------------------------------------------------------------
-- 3) Auth wipe — cascades to public.profiles (ON DELETE CASCADE)
--    (idempotent — safe to re-run)
-- -----------------------------------------------------------------------------
DELETE FROM auth.users;

-- Verify empty (auth + profiles + key M2–M6 user tables)
DO $$
DECLARE
  n_users bigint;
  n_profiles bigint;
  n_favorites bigint := 0;
  n_apps bigint := 0;
  n_wallets bigint := 0;
  n_ledger bigint := 0;
  n_holds bigint := 0;
  n_payouts bigint := 0;
  n_disputes bigint := 0;
  n_analytics bigint := 0;
BEGIN
  SELECT count(*) INTO n_users FROM auth.users;
  SELECT count(*) INTO n_profiles FROM public.profiles;

  IF to_regclass('public.favorites') IS NOT NULL THEN
    SELECT count(*) INTO n_favorites FROM public.favorites;
  END IF;
  IF to_regclass('public.job_applications') IS NOT NULL THEN
    SELECT count(*) INTO n_apps FROM public.job_applications;
  END IF;
  IF to_regclass('public.wallets') IS NOT NULL THEN
    SELECT count(*) INTO n_wallets FROM public.wallets;
  END IF;
  IF to_regclass('public.wallet_ledger_entries') IS NOT NULL THEN
    SELECT count(*) INTO n_ledger FROM public.wallet_ledger_entries;
  END IF;
  IF to_regclass('public.escrow_holds') IS NOT NULL THEN
    SELECT count(*) INTO n_holds FROM public.escrow_holds;
  END IF;
  IF to_regclass('public.payout_accounts') IS NOT NULL THEN
    SELECT count(*) INTO n_payouts FROM public.payout_accounts;
  END IF;
  IF to_regclass('public.disputes') IS NOT NULL THEN
    SELECT count(*) INTO n_disputes FROM public.disputes;
  END IF;
  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    SELECT count(*) INTO n_analytics FROM public.analytics_events;
  END IF;

  IF n_users <> 0 OR n_profiles <> 0
     OR n_favorites <> 0 OR n_apps <> 0
     OR n_wallets <> 0 OR n_ledger <> 0 OR n_holds <> 0 OR n_payouts <> 0
     OR n_disputes <> 0 OR n_analytics <> 0 THEN
    RAISE EXCEPTION
      'Wipe incomplete: auth.users=% profiles=% favorites=% job_applications=% wallets=% ledger=% escrow_holds=% payout_accounts=% disputes=% analytics_events=% — rolling back',
      n_users, n_profiles, n_favorites, n_apps, n_wallets, n_ledger, n_holds, n_payouts, n_disputes, n_analytics;
  END IF;
END $$;

SELECT
  (SELECT count(*) FROM auth.users) AS auth_users_after,
  (SELECT count(*) FROM public.profiles) AS profiles_after,
  (SELECT count(*) FROM public.service_categories) AS categories_kept,
  (SELECT CASE WHEN to_regclass('public.favorites') IS NULL THEN NULL
          ELSE (SELECT count(*) FROM public.favorites) END) AS favorites_after,
  (SELECT CASE WHEN to_regclass('public.job_applications') IS NULL THEN NULL
          ELSE (SELECT count(*) FROM public.job_applications) END) AS job_applications_after,
  (SELECT CASE WHEN to_regclass('public.wallets') IS NULL THEN NULL
          ELSE (SELECT count(*) FROM public.wallets) END) AS wallets_after,
  (SELECT CASE WHEN to_regclass('public.wallet_ledger_entries') IS NULL THEN NULL
          ELSE (SELECT count(*) FROM public.wallet_ledger_entries) END) AS ledger_after,
  (SELECT CASE WHEN to_regclass('public.escrow_holds') IS NULL THEN NULL
          ELSE (SELECT count(*) FROM public.escrow_holds) END) AS escrow_holds_after,
  (SELECT CASE WHEN to_regclass('public.payout_accounts') IS NULL THEN NULL
          ELSE (SELECT count(*) FROM public.payout_accounts) END) AS payout_accounts_after,
  (SELECT CASE WHEN to_regclass('public.disputes') IS NULL THEN NULL
          ELSE (SELECT count(*) FROM public.disputes) END) AS disputes_after,
  (SELECT CASE WHEN to_regclass('public.analytics_events') IS NULL THEN NULL
          ELSE (SELECT count(*) FROM public.analytics_events) END) AS analytics_events_after;

COMMIT;

-- =============================================================================
-- After running:
--   1. Supabase → Authentication → Users should be empty.
--   2. Results should show auth_users_after / profiles_after = 0 and M2–M6 = 0.
--   3. (Optional) Supabase → Storage → empty buckets: avatars, job-media,
--      verification-documents — orphaned uploads are harmless but use space.
--   4. Open the site → hard refresh or clear site data (old JWTs may 401).
--   5. Sign up again as a new user to see FORGE OS changes.
-- =============================================================================
