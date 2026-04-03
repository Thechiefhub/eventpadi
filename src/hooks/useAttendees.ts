import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Attendee {
  id: string;
  event_id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  ticket_id: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_by: string | null;
  certificate_url: string | null;
  certificate_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

const OFFLINE_QUEUE_KEY = "dday_checkin_queue";
const OFFLINE_CACHE_KEY = "dday_attendee_cache";

export function useAttendees(eventId: string) {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttendees = useCallback(async () => {
    if (!eventId || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("attendees")
      .select("*")
      .eq("event_id", eventId)
      .order("name");
    if (error) {
      toast.error("Failed to load attendees");
    } else {
      setAttendees(data || []);
      // Cache for offline use
      try {
        localStorage.setItem(`${OFFLINE_CACHE_KEY}_${eventId}`, JSON.stringify(data));
      } catch {}
    }
    setLoading(false);
  }, [eventId, user]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  // Realtime subscription
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`attendees-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendees", filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAttendees((prev) => [...prev, payload.new as Attendee]);
          } else if (payload.eventType === "UPDATE") {
            setAttendees((prev) =>
              prev.map((a) => (a.id === (payload.new as Attendee).id ? (payload.new as Attendee) : a))
            );
          } else if (payload.eventType === "DELETE") {
            setAttendees((prev) => prev.filter((a) => a.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  // Check-in function with offline queue
  const checkIn = useCallback(async (attendeeId: string) => {
    if (!user) return false;
    const now = new Date().toISOString();
    // Optimistic update
    setAttendees((prev) =>
      prev.map((a) =>
        a.id === attendeeId ? { ...a, checked_in: true, checked_in_at: now, checked_in_by: user.id } : a
      )
    );
    const { error } = await supabase
      .from("attendees")
      .update({ checked_in: true, checked_in_at: now, checked_in_by: user.id })
      .eq("id", attendeeId);
    if (error) {
      // Queue for offline sync
      try {
        const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
        queue.push({ attendeeId, checkedInAt: now, checkedInBy: user.id });
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      } catch {}
      toast.error("Check-in queued — will sync when online");
      return false;
    }
    toast.success("Checked in!");
    return true;
  }, [user]);

  const undoCheckIn = useCallback(async (attendeeId: string) => {
    setAttendees((prev) =>
      prev.map((a) =>
        a.id === attendeeId ? { ...a, checked_in: false, checked_in_at: null, checked_in_by: null } : a
      )
    );
    await supabase.from("attendees").update({ checked_in: false, checked_in_at: null, checked_in_by: null }).eq("id", attendeeId);
  }, []);

  // Generate ticket IDs for attendees missing them
  const generateMissingTicketIds = useCallback(async () => {
    const missing = attendees.filter((a) => !a.ticket_id);
    if (missing.length === 0) { toast.info("All attendees already have ticket IDs"); return; }
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const genCode = () => {
      let code = "";
      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      return `TKT-${code}`;
    };
    for (const a of missing) {
      const ticket_id = genCode();
      await supabase.from("attendees").update({ ticket_id }).eq("id", a.id);
    }
    toast.success(`Generated ${missing.length} ticket ID(s)`);
    fetchAttendees();
  }, [attendees, fetchAttendees]);

  // Sync offline queue
  const syncOfflineQueue = useCallback(async () => {
    if (!user) return;
    try {
      const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
      if (queue.length === 0) return;
      for (const item of queue) {
        await supabase.from("attendees").update({
          checked_in: true,
          checked_in_at: item.checkedInAt,
          checked_in_by: item.checkedInBy,
        }).eq("id", item.attendeeId);
      }
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      toast.success(`Synced ${queue.length} offline check-in(s)`);
      fetchAttendees();
    } catch {}
  }, [user, fetchAttendees]);

  useEffect(() => {
    const handleOnline = () => syncOfflineQueue();
    window.addEventListener("online", handleOnline);
    // Try sync on mount too
    syncOfflineQueue();
    return () => window.removeEventListener("online", handleOnline);
  }, [syncOfflineQueue]);

  // Load from cache if offline
  useEffect(() => {
    if (!navigator.onLine && eventId) {
      try {
        const cached = localStorage.getItem(`${OFFLINE_CACHE_KEY}_${eventId}`);
        if (cached) setAttendees(JSON.parse(cached));
      } catch {}
    }
  }, [eventId]);

  return { attendees, loading, fetchAttendees, checkIn, undoCheckIn, setAttendees, generateMissingTicketIds };
}
