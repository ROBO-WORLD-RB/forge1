-- ============================================
-- Forge: Allow workers to replace their own KYC docs
-- Migration 007
-- ============================================
-- uploadVerificationDocument() UPDATEs an existing row when the user
-- re-uploads / replaces a document. Schema previously only allowed SELECT + INSERT,
-- so Replace hung or failed silently under RLS.
--
-- Run via Supabase CLI (`supabase db push`) or SQL Editor after 006.

DROP POLICY IF EXISTS "Users can update own documents" ON public.verification_documents;

CREATE POLICY "Users can update own documents"
  ON public.verification_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
