
-- 1) Revoke EXECUTE on internal SECURITY DEFINER trigger/utility functions
REVOKE EXECUTE ON FUNCTION public.sync_registration_to_attendee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_registration_update_to_attendee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_registration_delete_to_attendee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
-- get_invite_by_token intentionally remains callable (invite acceptance flow uses it)

-- 2) Fix event_team_members owner policy to verify true event ownership
DROP POLICY IF EXISTS "Event owner can manage team" ON public.event_team_members;
CREATE POLICY "Event owner can manage team"
ON public.event_team_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_team_members.event_id
      AND e.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_team_members.event_id
      AND e.user_id = auth.uid()
  )
);

-- 3) Restrict sponsors SELECT to the user who added them
DROP POLICY IF EXISTS "Anyone authenticated can read sponsors" ON public.sponsors;
CREATE POLICY "Users can read their own sponsors"
ON public.sponsors
FOR SELECT
TO authenticated
USING (added_by = auth.uid());

-- 4) Storage: per-user policies on generated-visuals (path prefix = auth.uid())
DROP POLICY IF EXISTS "Users can read own generated visuals" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own generated visuals" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own generated visuals" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own generated visuals" ON storage.objects;

CREATE POLICY "Users can read own generated visuals"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'generated-visuals' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own generated visuals"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-visuals' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own generated visuals"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'generated-visuals' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'generated-visuals' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own generated visuals"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-visuals' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5) Storage: certificates bucket — service-role only (no anon/authenticated policies).
--    Explicitly drop any prior public-read policies if present.
DROP POLICY IF EXISTS "Public can read certificates" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read certificates" ON storage.objects;
DROP POLICY IF EXISTS "Public read certificates" ON storage.objects;
