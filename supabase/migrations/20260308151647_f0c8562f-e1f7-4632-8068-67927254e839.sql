
-- Add invitation token and expiry columns to event_team_members
ALTER TABLE public.event_team_members
  ADD COLUMN IF NOT EXISTS invitation_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone DEFAULT (now() + interval '7 days');

-- Create unique index on token for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_team_members_token ON public.event_team_members (invitation_token);

-- Allow anyone (unauthenticated) to read a team member row by token (for accepting invites)
CREATE POLICY "Anyone can read by invitation token"
  ON public.event_team_members
  FOR SELECT
  TO anon, authenticated
  USING (invitation_token IS NOT NULL);

-- Allow authenticated users to update their own membership (accept invite)
CREATE POLICY "Users can accept their own invitation"
  ON public.event_team_members
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND token_expires_at > now()
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'accepted'
  );
