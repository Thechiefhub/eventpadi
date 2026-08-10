DROP POLICY IF EXISTS "Team members can update attendees (check-in)" ON public.attendees;
CREATE POLICY "Team members can update attendees (check-in)"
ON public.attendees FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.event_team_members m WHERE m.event_id = attendees.event_id AND m.user_id = auth.uid() AND m.status = 'accepted'))
WITH CHECK (EXISTS (SELECT 1 FROM public.event_team_members m WHERE m.event_id = attendees.event_id AND m.user_id = auth.uid() AND m.status = 'accepted'));