-- Revoke EXECUTE on remaining trigger functions from client roles
REVOKE EXECUTE ON FUNCTION public.sync_registration_delete_to_attendee() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_registration_update_to_attendee() FROM anon, authenticated;

-- Fix check_in_note_audits policies: require team members to have accepted status
DROP POLICY IF EXISTS "Event team can view note audits" ON public.check_in_note_audits;
DROP POLICY IF EXISTS "Event team can insert note audits" ON public.check_in_note_audits;

CREATE POLICY "Event team can view note audits"
  ON public.check_in_note_audits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = check_in_note_audits.event_id AND e.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_team_members tm
      WHERE tm.event_id = check_in_note_audits.event_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'accepted'
    )
  );

CREATE POLICY "Event team can insert note audits"
  ON public.check_in_note_audits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = check_in_note_audits.event_id AND e.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_team_members tm
      WHERE tm.event_id = check_in_note_audits.event_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'accepted'
    )
  );