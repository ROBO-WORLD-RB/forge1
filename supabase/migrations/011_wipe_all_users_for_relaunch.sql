-- =============================================================================
-- ⚠️  WARNING — IRREVERSIBLE PRODUCTION WIPE
-- =============================================================================
-- This script DELETES EVERY AUTH USER and related application data on Forge.
-- After it runs, nobody can log in with an existing account — they must
-- sign up again (fresh auth.users + profiles).
--
-- DO NOT run this casually. There is no undo.
--
-- Intended use: one-time relaunch wipe before product re-open.
-- Safe to paste once into Supabase Dashboard → SQL Editor → Run.
--
-- Project (from START-HERE): siutunqbdteyrycrbzub
--
-- Why not only `DELETE FROM auth.users`?
--   profiles.id → auth.users(id) ON DELETE CASCADE, and most app tables
--   cascade from profiles. Two FKs do NOT cascade and would block the wipe:
--     • worker_payments.user_id → profiles(id)          (no ON DELETE)
--     • verification_documents.reviewed_by → profiles(id) (no ON DELETE)
--   This script clears those first, then deletes auth.users.
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
--   The whole transaction rolled back — no users were deleted. Re-run this script.
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

-- -----------------------------------------------------------------------------
-- 2) Explicit app-data cleanup (correct order; also covered by cascades)
--    Leaves a clean slate even if some cascades were altered in prod.
--    (idempotent — safe to re-run)
-- -----------------------------------------------------------------------------
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

-- Verify empty
DO $$
DECLARE
  n_users bigint;
  n_profiles bigint;
BEGIN
  SELECT count(*) INTO n_users FROM auth.users;
  SELECT count(*) INTO n_profiles FROM public.profiles;
  IF n_users <> 0 OR n_profiles <> 0 THEN
    RAISE EXCEPTION
      'Wipe incomplete: auth.users=% profiles=% — rolling back',
      n_users, n_profiles;
  END IF;
END $$;

SELECT
  (SELECT count(*) FROM auth.users) AS auth_users_after,
  (SELECT count(*) FROM public.profiles) AS profiles_after,
  (SELECT count(*) FROM public.service_categories) AS categories_kept;

COMMIT;

-- =============================================================================
-- After running:
--   1. Supabase → Authentication → Users should be empty.
--   2. (Optional) Supabase → Storage → empty buckets: avatars, job-media,
--      verification-documents — orphaned uploads are harmless but use space.
--   3. Open the site → hard refresh or clear site data (old JWTs may 401).
--   4. Sign up again as a new user.
-- =============================================================================
