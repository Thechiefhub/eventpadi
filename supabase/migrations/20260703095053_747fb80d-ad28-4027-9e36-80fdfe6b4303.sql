-- Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER functions.
-- These are invoked ONLY by triggers or by service_role code paths, so end users
-- (signed-in or anonymous) never need direct call rights on them.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_registration_to_attendee() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_registration_update_to_attendee() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_registration_delete_to_attendee() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- get_invite_by_token MUST remain callable by anon: unauthenticated invitees
-- resolve their invite token on the AcceptInvite page before signing up.
-- Leave its grants intact.