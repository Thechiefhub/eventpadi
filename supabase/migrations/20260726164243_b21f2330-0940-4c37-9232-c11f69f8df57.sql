-- 1. Allow invited users to read their own invitation row (replaces SECURITY DEFINER RPC)
CREATE POLICY "Invitees can view their own invitation"
ON public.event_team_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email::text) = lower(event_team_members.invited_email)
  )
);

-- Allow invited users to see the event they were invited to (name/date only via RLS)
CREATE POLICY "Invitees can view invited events"
ON public.events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_team_members tm
    JOIN auth.users u ON u.id = auth.uid()
    WHERE tm.event_id = events.id
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email::text) = lower(tm.invited_email)
  )
);

-- 2. Drop the SECURITY DEFINER function that signed-in users could execute
DROP FUNCTION IF EXISTS public.get_invite_by_token(uuid);

-- 3. Ensure anon has no access to sensitive realtime-published tables
REVOKE ALL ON public.attendees FROM anon;
REVOKE ALL ON public.badge_share_log FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badge_share_log TO authenticated;
GRANT ALL ON public.attendees TO service_role;
GRANT ALL ON public.badge_share_log TO service_role;