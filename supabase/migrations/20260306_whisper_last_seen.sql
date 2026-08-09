-- Add is_read column to messages for per-message read tracking
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Allow receivers to mark messages as read
CREATE POLICY "Receivers can mark messages as read"
  ON public.messages FOR UPDATE USING ((select auth.uid()) = receiver_id);
