DROP POLICY IF EXISTS "Users can accept their own invitation" ON public.event_team_members;

CREATE POLICY "Users can accept their own invitation"
ON public.event_team_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email) = lower(event_team_members.invited_email)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email) = lower(event_team_members.invited_email)
  )
);