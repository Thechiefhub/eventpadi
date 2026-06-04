
CREATE TABLE public.check_in_note_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  changed_by_name text,
  action text NOT NULL,
  previous_note text,
  new_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.check_in_note_audits TO authenticated;
GRANT ALL ON public.check_in_note_audits TO service_role;

ALTER TABLE public.check_in_note_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event team can view note audits"
  ON public.check_in_note_audits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = check_in_note_audits.event_id AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_team_members tm
      WHERE tm.event_id = check_in_note_audits.event_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Event team can insert note audits"
  ON public.check_in_note_audits FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.events e WHERE e.id = check_in_note_audits.event_id AND e.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.event_team_members tm WHERE tm.event_id = check_in_note_audits.event_id AND tm.user_id = auth.uid())
    )
  );

CREATE INDEX idx_checkin_note_audits_attendee ON public.check_in_note_audits(attendee_id, created_at DESC);
