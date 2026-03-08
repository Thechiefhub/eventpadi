
-- Attendees table
CREATE TABLE public.attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'attendee',
  ticket_id TEXT,
  checked_in BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Event team members table
CREATE TABLE public.event_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, invited_email)
);

-- Enable RLS
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_team_members ENABLE ROW LEVEL SECURITY;

-- Attendees policies: owner or team member can access
CREATE POLICY "Event owner can manage attendees" ON public.attendees
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Team members can view attendees" ON public.attendees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.event_team_members
      WHERE event_team_members.event_id = attendees.event_id
        AND event_team_members.user_id = auth.uid()
        AND event_team_members.status = 'accepted'
    )
  );

CREATE POLICY "Team members can update attendees (check-in)" ON public.attendees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.event_team_members
      WHERE event_team_members.event_id = attendees.event_id
        AND event_team_members.user_id = auth.uid()
        AND event_team_members.status = 'accepted'
    )
  );

-- Event team members policies
CREATE POLICY "Event owner can manage team" ON public.event_team_members
  FOR ALL USING (auth.uid() = invited_by);

CREATE POLICY "Team members can view their own membership" ON public.event_team_members
  FOR SELECT USING (auth.uid() = user_id);

-- Enable realtime for attendees
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendees;

-- Triggers for updated_at
CREATE TRIGGER update_attendees_updated_at
  BEFORE UPDATE ON public.attendees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_team_members_updated_at
  BEFORE UPDATE ON public.event_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
