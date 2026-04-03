import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Event {
  id: string;
  name: string;
  event_date: string | null;
  city: string | null;
  country: string | null;
}

export function useEventSelect() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, city, country")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setEvents(data);
        setSelectedEventId(data[0].id);
      }
      setLoading(false);
    };
    fetchEvents();
  }, [user]);

  return { events, selectedEventId, setSelectedEventId, loading };
}
