-- 1. Private organizer contact details ---------------------------------------
CREATE TABLE public.event_registration_page_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id uuid NOT NULL UNIQUE REFERENCES public.event_registration_pages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  contact_email text,
  contact_phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registration_page_contacts TO authenticated;
GRANT ALL ON public.event_registration_page_contacts TO service_role;

ALTER TABLE public.event_registration_page_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages page contacts"
ON public.event_registration_page_contacts FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_event_registration_page_contacts_updated_at
BEFORE UPDATE ON public.event_registration_page_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.event_registration_page_contacts (page_id, user_id, contact_email, contact_phone)
SELECT id, user_id, contact_email, contact_phone
FROM public.event_registration_pages
WHERE contact_email IS NOT NULL OR contact_phone IS NOT NULL;

ALTER TABLE public.event_registration_pages DROP COLUMN contact_email;
ALTER TABLE public.event_registration_pages DROP COLUMN contact_phone;

-- 2. Badge share log: owner-only, signed-in only ------------------------------
REVOKE ALL ON public.badge_share_log FROM anon;

DROP POLICY IF EXISTS "Event owner can view share log" ON public.badge_share_log;
DROP POLICY IF EXISTS "Event owner can insert share log" ON public.badge_share_log;
DROP POLICY IF EXISTS "Event owner can update share log" ON public.badge_share_log;
DROP POLICY IF EXISTS "Event owner can delete share log" ON public.badge_share_log;

CREATE POLICY "Owner can view share log" ON public.badge_share_log
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert share log" ON public.badge_share_log
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update share log" ON public.badge_share_log
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can delete share log" ON public.badge_share_log
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Remove user-callable SECURITY DEFINER helpers ----------------------------
DROP POLICY IF EXISTS "Event owner can manage team" ON public.event_team_members;
DROP POLICY IF EXISTS "Invited team members can view events" ON public.events;

-- Team rows are managed by the organizer who created the invitation.
CREATE POLICY "Inviter manages team members" ON public.event_team_members
FOR ALL TO authenticated
USING (auth.uid() = invited_by)
WITH CHECK (auth.uid() = invited_by);

-- Invited members can read the events they belong to. event_team_members'
-- policies are all direct checks, so this cannot recurse.
CREATE POLICY "Invited team members can view events" ON public.events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.event_team_members tm
  WHERE tm.event_id = events.id
    AND (tm.user_id = auth.uid()
      OR lower(tm.invited_email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
));

DROP FUNCTION IF EXISTS public.is_event_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_event_member(uuid, uuid, text);