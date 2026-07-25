
REVOKE EXECUTE ON FUNCTION public.sync_registration_to_attendee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_registration_update_to_attendee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_registration_delete_to_attendee() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_invite_by_token(uuid) FROM PUBLIC, anon;
