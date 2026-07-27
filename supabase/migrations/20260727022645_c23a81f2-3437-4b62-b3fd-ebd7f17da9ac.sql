DROP POLICY IF EXISTS "Users can accept their own invitation" ON public.event_team_members;
DROP POLICY IF EXISTS "Invitees can view their own invitation" ON public.event_team_members;

CREATE POLICY "Invitees can view their own invitation"
ON public.event_team_members FOR SELECT TO authenticated
USING (lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Users can accept their own invitation"
ON public.event_team_members FOR UPDATE TO authenticated
USING (lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
WITH CHECK (lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')));