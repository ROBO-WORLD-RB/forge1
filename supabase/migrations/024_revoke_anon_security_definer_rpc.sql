-- ============================================
-- 024 — Remove anon EXECUTE from internal SECURITY DEFINER helpers
-- ============================================
-- Some databases already had explicit anon/service grants on these functions.
-- Revoking PUBLIC in 022/023 does not remove those explicit grants, so make the
-- intended RPC surface explicit.

BEGIN;

REVOKE ALL ON FUNCTION public.assign_initial_role(TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assign_initial_role(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_wallet(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.fund_booking_escrow(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_booking_escrow(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_booking_escrow(UUID, TEXT, NUMERIC, TEXT) TO service_role;

-- Trigger functions are not public RPC endpoints.
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
