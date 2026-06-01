-- Add check-in notes column for staff
ALTER TABLE public.attendees ADD COLUMN IF NOT EXISTS check_in_notes text;

-- Ensure anon can read published event registration pages for the homepage listing
GRANT SELECT ON public.event_registration_pages TO anon;
GRANT SELECT ON public.event_registration_pages TO authenticated;