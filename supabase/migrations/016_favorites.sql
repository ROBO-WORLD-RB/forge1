-- ============================================
-- Forge M2: Customer favorites (saved workers)
-- Migration 016
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor (after 015), or `supabase db push`.
--
-- Customers (and any authenticated user) can save workers for repeat hire.
-- Additive only — does not alter bookings/jobs/reviews.
-- ============================================

CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT favorites_user_worker_unique UNIQUE (user_id, worker_user_id),
  CONSTRAINT favorites_not_self CHECK (user_id <> worker_user_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS favorites_worker_user_id_idx ON public.favorites (worker_user_id);
CREATE INDEX IF NOT EXISTS favorites_user_created_idx ON public.favorites (user_id, created_at DESC);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites"
  ON public.favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Users can insert own favorites"
  ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.worker_profiles wp
      WHERE wp.user_id = worker_user_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites"
  ON public.favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.favorites IS 'Customer OS: saved workers for discover/trust repeat hire (M2)';
