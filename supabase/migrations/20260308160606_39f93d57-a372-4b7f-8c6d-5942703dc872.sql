
-- Curated sponsor database
CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,
  industry text NOT NULL,
  sponsor_type text DEFAULT 'corporate',
  past_sponsorships text,
  website text,
  contact_info text,
  logo_url text,
  is_custom boolean DEFAULT false,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Public read access (curated data), authenticated insert for manual entries
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read sponsors"
  ON public.sponsors FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can add custom sponsors"
  ON public.sponsors FOR INSERT TO authenticated
  WITH CHECK (is_custom = true AND added_by = auth.uid());

CREATE POLICY "Users can delete their custom sponsors"
  ON public.sponsors FOR DELETE TO authenticated
  USING (is_custom = true AND added_by = auth.uid());
