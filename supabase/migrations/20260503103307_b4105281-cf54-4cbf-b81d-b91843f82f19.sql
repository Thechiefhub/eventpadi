CREATE TABLE public.badge_share_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  attendee_id UUID NOT NULL,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  recipient TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_badge_share_log_event ON public.badge_share_log(event_id);
CREATE INDEX idx_badge_share_log_attendee ON public.badge_share_log(attendee_id);

ALTER TABLE public.badge_share_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owner can view share log"
ON public.badge_share_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Event owner can insert share log"
ON public.badge_share_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Event owner can update share log"
ON public.badge_share_log FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Event owner can delete share log"
ON public.badge_share_log FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_badge_share_log_updated_at
BEFORE UPDATE ON public.badge_share_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.badge_share_log;