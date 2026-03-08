
-- Table for saving shortlisted event names
CREATE TABLE public.shortlisted_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  rationale text,
  tagline text,
  rating integer DEFAULT 0,
  chosen boolean DEFAULT false,
  generation_context jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shortlisted_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own shortlisted names"
  ON public.shortlisted_names FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_shortlisted_names_updated_at
  BEFORE UPDATE ON public.shortlisted_names
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
