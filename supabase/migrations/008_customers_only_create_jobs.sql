-- ============================================
-- Forge: Customers (and admins) post projects; workers apply
-- Migration 008
-- ============================================
-- UI copy uses "Project"; DB table remains `jobs`.
-- Workers expand reach via profile + applying — not by creating projects.
--
-- Run via Supabase CLI (`supabase db push`) or SQL Editor after 007.

DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Customers can create jobs" ON public.jobs;

CREATE POLICY "Customers can create jobs"
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = poster_user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('customer', 'admin')
    )
  );
