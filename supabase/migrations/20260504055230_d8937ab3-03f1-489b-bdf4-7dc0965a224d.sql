
-- Registration pages (one per event)
CREATE TABLE public.event_registration_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  flyer_url text,
  location text,
  venue_address text,
  start_at timestamptz,
  end_at timestamptz,
  is_paid boolean NOT NULL DEFAULT false,
  currency text DEFAULT 'NGN',
  general_price numeric DEFAULT 0,
  vip_price numeric DEFAULT 0,
  vvip_price numeric DEFAULT 0,
  general_enabled boolean NOT NULL DEFAULT true,
  vip_enabled boolean NOT NULL DEFAULT false,
  vvip_enabled boolean NOT NULL DEFAULT false,
  capacity integer,
  is_published boolean NOT NULL DEFAULT false,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_registration_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages registration pages" ON public.event_registration_pages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view published pages" ON public.event_registration_pages
  FOR SELECT USING (is_published = true);

CREATE TRIGGER update_event_registration_pages_updated_at
  BEFORE UPDATE ON public.event_registration_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registrations from the public form
CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_page_id uuid NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid NOT NULL, -- event owner for RLS
  name text NOT NULL,
  email text,
  phone text,
  ticket_tier text NOT NULL DEFAULT 'general', -- general | vip | vvip
  admits integer NOT NULL DEFAULT 1,
  amount numeric DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending', -- pending | paid | free
  attendee_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views registrations" ON public.event_registrations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner manages registrations" ON public.event_registrations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can register" ON public.event_registrations
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_event_registrations_event ON public.event_registrations(event_id);
CREATE INDEX idx_event_registration_pages_slug ON public.event_registration_pages(slug);

CREATE TRIGGER update_event_registrations_updated_at
  BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: when a registration is created, also insert into attendees with role mapped to tier
CREATE OR REPLACE FUNCTION public.sync_registration_to_attendee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_attendee_id uuid;
  role_label text;
  ticket text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
BEGIN
  role_label := CASE NEW.ticket_tier
    WHEN 'vvip' THEN 'VVIP'
    WHEN 'vip' THEN 'VIP'
    ELSE 'General'
  END;

  ticket := 'TKT-';
  FOR i IN 1..6 LOOP
    ticket := ticket || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;

  INSERT INTO public.attendees (event_id, user_id, name, email, phone, role, ticket_id, admits)
  VALUES (NEW.event_id, NEW.user_id, NEW.name, NEW.email, NEW.phone, role_label, ticket, NEW.admits)
  RETURNING id INTO new_attendee_id;

  NEW.attendee_id := new_attendee_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_registration_to_attendee
  BEFORE INSERT ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_registration_to_attendee();

-- Public bucket for event flyers
INSERT INTO storage.buckets (id, name, public) VALUES ('event-flyers', 'event-flyers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read event flyers" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-flyers');
CREATE POLICY "Authed upload own flyers" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'event-flyers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Authed update own flyers" ON storage.objects
  FOR UPDATE USING (bucket_id = 'event-flyers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Authed delete own flyers" ON storage.objects
  FOR DELETE USING (bucket_id = 'event-flyers' AND auth.uid()::text = (storage.foldername(name))[1]);
