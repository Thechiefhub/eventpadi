CREATE OR REPLACE FUNCTION public.is_event_owner(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_event_member(_event_id uuid, _user_id uuid, _email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_team_members tm
    WHERE tm.event_id = _event_id
      AND (tm.user_id = _user_id OR lower(tm.invited_email) = lower(COALESCE(_email, '')))
  );
$$;

REVOKE ALL ON FUNCTION public.is_event_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_event_member(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_event_member(uuid, uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Invited team members can view events" ON public.events;
CREATE POLICY "Invited team members can view events" ON public.events
FOR SELECT TO authenticated
USING (public.is_event_member(id, auth.uid(), auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Event owner can manage team" ON public.event_team_members;
CREATE POLICY "Event owner can manage team" ON public.event_team_members
FOR ALL TO authenticated
USING (public.is_event_owner(event_id, auth.uid()))
WITH CHECK (public.is_event_owner(event_id, auth.uid()));