-- ============================================
-- Forge M0: Secure notifications INSERT path
-- Migration 015
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor (after 014), or `supabase db push`.
--
-- Users SELECT/UPDATE own rows only. INSERT goes through SECURITY DEFINER RPC
-- that allows notify when caller shares a booking or conversation with the
-- target (or is admin / self). Service role still inserts directly (bypasses RLS).
-- ============================================

-- Ensure no permissive client INSERT policy exists
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  caller_is_admin BOOLEAN;
  allowed BOOLEAN := false;
  inserted public.notifications;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_type IS NULL OR p_title IS NULL OR p_body IS NULL THEN
    RAISE EXCEPTION 'user_id, type, title, and body are required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = caller AND role = 'admin'
  ) INTO caller_is_admin;

  IF caller_is_admin OR caller = p_user_id THEN
    allowed := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE (b.customer_user_id = caller AND b.worker_user_id = p_user_id)
       OR (b.worker_user_id = caller AND b.customer_user_id = p_user_id)
  ) THEN
    allowed := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE (c.participant_1 = caller AND c.participant_2 = p_user_id)
       OR (c.participant_2 = caller AND c.participant_1 = p_user_id)
  ) THEN
    allowed := true;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'permission denied: cannot notify this user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_metadata)
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
