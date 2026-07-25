
-- Deduplicate any existing shared ticket_ids by regenerating them
DO $$
DECLARE
  r record;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_ticket text;
  i int;
BEGIN
  FOR r IN
    SELECT a.id
    FROM public.attendees a
    JOIN (
      SELECT event_id, ticket_id
      FROM public.attendees
      WHERE ticket_id IS NOT NULL
      GROUP BY event_id, ticket_id
      HAVING count(*) > 1
    ) d ON d.event_id = a.event_id AND d.ticket_id = a.ticket_id
    ORDER BY a.created_at
    OFFSET 0
  LOOP
    LOOP
      new_ticket := 'TKT-';
      FOR i IN 1..8 LOOP
        new_ticket := new_ticket || substr(chars, 1 + floor(random() * length(chars))::int, 1);
      END LOOP;
      BEGIN
        UPDATE public.attendees SET ticket_id = new_ticket WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- try again
      END;
    END LOOP;
  END LOOP;
END $$;

-- Keep one row per (event_id, ticket_id): re-generate the rest
DO $$
DECLARE
  r record;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_ticket text;
  i int;
BEGIN
  FOR r IN
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY event_id, ticket_id ORDER BY created_at) AS rn
      FROM public.attendees
      WHERE ticket_id IS NOT NULL
    ) x WHERE rn > 1
  LOOP
    LOOP
      new_ticket := 'TKT-';
      FOR i IN 1..8 LOOP
        new_ticket := new_ticket || substr(chars, 1 + floor(random() * length(chars))::int, 1);
      END LOOP;
      BEGIN
        UPDATE public.attendees SET ticket_id = new_ticket WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- try again
      END;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS attendees_event_ticket_unique
  ON public.attendees (event_id, ticket_id)
  WHERE ticket_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_registration_to_attendee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_attendee_id uuid;
  role_label text;
  ticket text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
  attempt int := 0;
  inserted boolean := false;
BEGIN
  role_label := CASE NEW.ticket_tier
    WHEN 'vvip' THEN 'VVIP'
    WHEN 'vip' THEN 'VIP'
    ELSE 'General'
  END;

  WHILE attempt < 10 AND NOT inserted LOOP
    ticket := 'TKT-';
    FOR i IN 1..8 LOOP
      ticket := ticket || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.attendees (event_id, user_id, name, email, phone, role, ticket_id, admits)
      VALUES (NEW.event_id, NEW.user_id, NEW.name, NEW.email, NEW.phone, role_label, ticket, NEW.admits)
      RETURNING id INTO new_attendee_id;
      inserted := true;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
    END;
  END LOOP;

  IF NOT inserted THEN
    RAISE EXCEPTION 'Failed to allocate unique ticket_id after 10 attempts';
  END IF;

  NEW.attendee_id := new_attendee_id;
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Anyone can view generated visuals" ON storage.objects;
