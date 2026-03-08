
-- Table for narratives generated per event name
CREATE TABLE public.spark_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  narrative text NOT NULL,
  generation_context jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spark_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own narratives"
  ON public.spark_narratives FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table for social posts generated in the studio
CREATE TABLE public.spark_social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  platform text NOT NULL DEFAULT 'instagram',
  post_type text NOT NULL DEFAULT 'announcement',
  content text NOT NULL,
  custom_instruction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spark_social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own social posts"
  ON public.spark_social_posts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_spark_narratives_updated_at
  BEFORE UPDATE ON public.spark_narratives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_spark_social_posts_updated_at
  BEFORE UPDATE ON public.spark_social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
