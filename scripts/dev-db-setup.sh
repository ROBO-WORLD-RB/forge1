#!/usr/bin/env bash
# ============================================================================
# Forge — local Supabase database bootstrap
# ----------------------------------------------------------------------------
# Applies the base schema + SQL migrations to a LOCAL Supabase database in the
# exact order documented in START-HERE.md (the migrations/ folder is ordered for
# manual dashboard use and also contains destructive "wipe" scripts, so it is
# NOT safe to apply blindly with `supabase db reset`).
#
# Prereqs: `supabase start` has already booted the local stack.
# Usage:   bash scripts/dev-db-setup.sh
# ============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_forge}"

run_sql() {
  local file="$1"
  echo ">>> applying: $file"
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$file"
}

# Order per START-HERE.md. Destructive relaunch scripts (011, 020) are excluded.
FILES=(
  "supabase-schema.sql"
  "supabase/migrations/001_storage_and_rls_fixes.sql"
  "supabase/migrations/add_worker_location.sql"
  "supabase/migrations/002_security_hardening.sql"
  "supabase/migrations/003_signup_profile_and_jobs_fixes.sql"
  "supabase/migrations/004_fix_username_generation.sql"
  "supabase/migrations/005_chat_and_worker_apply_rls.sql"
  "supabase/migrations/006_profile_public_read_rls.sql"
  "supabase/migrations/007_verification_documents_update_rls.sql"
  "supabase/migrations/008_customers_only_create_jobs.sql"
  "supabase/migrations/009_complete_worker_onboarding.sql"
  "supabase/migrations/010_skip_onboarding_payment.sql"
  "supabase/migrations/012_worker_profiles_privilege_guard.sql"
  "supabase/migrations/013_verification_kyc_and_admin.sql"
  "supabase/migrations/014_subscriptions_webhook_activation.sql"
  "supabase/migrations/015_notifications_secure_insert.sql"
  "supabase/migrations/016_favorites.sql"
  "supabase/migrations/017_job_applications.sql"
  "supabase/migrations/018_wallet_escrow_foundations.sql"
  "supabase/migrations/019_analytics_disputes.sql"
  "supabase/migrations/021_lock_down_profiles_rls.sql"
  "supabase/migrations/022_fix_oauth_role_assignment.sql"
  "supabase/migrations/023_togo_currency_and_profiles_rls_fix.sql"
  # Optional seed data (service categories for search/discovery):
  "supabase/seed-categories.sql"
)

for f in "${FILES[@]}"; do
  run_sql "$f"
done

echo "=== Forge local DB bootstrap complete ==="
