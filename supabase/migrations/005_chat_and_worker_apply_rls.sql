-- 005_chat_and_worker_apply_rls.sql
-- Fixes:
-- 1) Workers can INSERT job applications (bookings) where they are worker_user_id
-- 2) Conversation participants can UPDATE last_message_at
-- 3) Conversation participants can UPDATE message read_at
--
-- Run in Supabase SQL Editor after 004 (see START-HERE.md).

-- ---------------------------------------------------------------------------
-- Bookings: allow customers OR workers to create a booking row
-- (customers book workers; workers apply to posted jobs)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;

CREATE POLICY "Users can create bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_user_id
    OR auth.uid() = worker_user_id
  );

-- ---------------------------------------------------------------------------
-- Conversations: participants can update their threads (last_message_at)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;

CREATE POLICY "Users can update own conversations"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2)
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- ---------------------------------------------------------------------------
-- Messages: participants can update read receipts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON public.messages;

CREATE POLICY "Users can update messages in their conversations"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );
