
CREATE OR REPLACE FUNCTION public.sync_registration_update_to_attendee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_label text;
BEGIN
  role_label := CASE NEW.ticket_tier
    WHEN 'vvip' THEN 'VVIP'
    WHEN 'vip' THEN 'VIP'
    ELSE 'General'
  END;

  IF NEW.attendee_id IS NOT NULL THEN
    UPDATE public.attendees
       SET name = NEW.name,
           email = NEW.email,
           phone = NEW.phone,
           role = role_label,
           admits = NEW.admits,
           updated_at = now()
     WHERE id = NEW.attendee_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_registration_update ON public.event_registrations;
CREATE TRIGGER trg_sync_registration_update
  AFTER UPDATE ON public.event_registrations
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name
     OR OLD.email IS DISTINCT FROM NEW.email
     OR OLD.phone IS DISTINCT FROM NEW.phone
     OR OLD.ticket_tier IS DISTINCT FROM NEW.ticket_tier
     OR OLD.admits IS DISTINCT FROM NEW.admits)
  EXECUTE FUNCTION public.sync_registration_update_to_attendee();

CREATE OR REPLACE FUNCTION public.sync_registration_delete_to_attendee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.attendee_id IS NOT NULL THEN
    DELETE FROM public.attendees WHERE id = OLD.attendee_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_registration_delete ON public.event_registrations;
CREATE TRIGGER trg_sync_registration_delete
  AFTER DELETE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_registration_delete_to_attendee();
