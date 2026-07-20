-- ============================================
-- Forge M3: Worker OS job applications
-- Migration 017
-- ============================================
-- APPLY in Supabase Dashboard → SQL Editor (after 016), or `supabase db push`.
--
-- First-class worker → job applications (status, message, booking link).
-- Additive only — does not alter bookings FSM or customer hire flows.
-- Optional: worker_profiles.accepting_work for availability clarity.
-- ============================================

CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_applications_job_worker_unique UNIQUE (job_id, worker_user_id)
);

CREATE INDEX IF NOT EXISTS job_applications_worker_id_idx
  ON public.job_applications (worker_user_id);
CREATE INDEX IF NOT EXISTS job_applications_job_id_idx
  ON public.job_applications (job_id);
CREATE INDEX IF NOT EXISTS job_applications_worker_created_idx
  ON public.job_applications (worker_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_applications_job_status_idx
  ON public.job_applications (job_id, status);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers can view own applications" ON public.job_applications;
CREATE POLICY "Workers can view own applications"
  ON public.job_applications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = worker_user_id);

DROP POLICY IF EXISTS "Posters can view applications on own jobs" ON public.job_applications;
CREATE POLICY "Posters can view applications on own jobs"
  ON public.job_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_applications.job_id
        AND j.poster_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workers can apply to jobs" ON public.job_applications;
CREATE POLICY "Workers can apply to jobs"
  ON public.job_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = worker_user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'worker'
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND j.status = 'open'
        AND j.poster_user_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workers can update own applications" ON public.job_applications;
CREATE POLICY "Workers can update own applications"
  ON public.job_applications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = worker_user_id)
  WITH CHECK (auth.uid() = worker_user_id);

DROP POLICY IF EXISTS "Posters can update applications on own jobs" ON public.job_applications;
CREATE POLICY "Posters can update applications on own jobs"
  ON public.job_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_applications.job_id
        AND j.poster_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_applications.job_id
        AND j.poster_user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_job_applications_updated_at ON public.job_applications;
CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.job_applications IS 'Worker OS: first-class applications to customer jobs (M3)';

-- Availability signal for Worker OS profile completeness (additive)
ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS accepting_work BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.worker_profiles.accepting_work IS 'Worker OS: whether the pro is open for new work (M3)';
