
ALTER TABLE public.attendees
ADD COLUMN certificate_url text,
ADD COLUMN certificate_sent_at timestamp with time zone;

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload certificates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Anyone can read certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates');
