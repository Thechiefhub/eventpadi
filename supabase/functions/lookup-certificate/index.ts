import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ticket_id } = await req.json();

    if (!ticket_id || typeof ticket_id !== "string" || ticket_id.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Please enter a valid ticket ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up attendee by ticket_id
    const { data: attendee, error } = await supabase
      .from("attendees")
      .select("id, name, email, role, ticket_id, checked_in, certificate_url, certificate_sent_at, event_id")
      .eq("ticket_id", ticket_id.trim().toUpperCase())
      .maybeSingle();

    if (error) {
      console.error("DB error:", error);
      return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!attendee) {
      return new Response(JSON.stringify({ error: "No attendee found with that ticket ID" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch event name for display
    const { data: event } = await supabase
      .from("events")
      .select("name, event_date, city, country")
      .eq("id", attendee.event_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        attendee: {
          name: attendee.name,
          role: attendee.role,
          ticket_id: attendee.ticket_id,
          checked_in: attendee.checked_in,
          certificate_url: attendee.certificate_url,
          certificate_sent_at: attendee.certificate_sent_at,
        },
        event: event
          ? {
              name: event.name,
              date: event.event_date,
              location: [event.city, event.country].filter(Boolean).join(", "),
            }
          : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
