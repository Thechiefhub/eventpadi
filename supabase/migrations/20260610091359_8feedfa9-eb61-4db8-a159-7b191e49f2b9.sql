-- Fix privilege escalation on event_team_members UPDATE policy
-- Ensure users can only accept invitations sent to their own email address
DROP POLICY IF EXISTS "Users can accept their own invitation" ON public.event_team_members;

CREATE POLICY "Users can accept their own invitation"
  ON public.event_team_members
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND token_expires_at > now()
    AND invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'accepted'
    AND invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );