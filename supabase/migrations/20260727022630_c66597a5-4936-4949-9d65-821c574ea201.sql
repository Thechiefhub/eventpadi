DROP POLICY IF EXISTS "Invited team members can view events" ON public.events;
CREATE POLICY "Invited team members can view events"
ON public.events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.event_team_members tm
  WHERE tm.event_id = events.id
    AND (tm.user_id = auth.uid()
      OR lower(tm.invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
));