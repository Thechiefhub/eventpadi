/**
 * qr-check-in — Scans a ticket QR payload, marks the matching attendee as
 * checked in atomically, and prevents duplicate check-ins.
 *
 * Body: { eventId: string, code: string }
 *   `code` may be a raw ticket id, attendee id, email, or the JSON QR
 *   payload built by buildQrPayload (in src/lib/ticket.ts).
 *
 * Returns: { ok, status: 'checked_in'|'already'|'not_found', attendee?, tierCounts }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function parseCode(raw: string): { ticket?: string; reg?: string; eventId?: string; fallback: string } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { fallback: "" };
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed);
      return { ticket: j.t, reg: j.r, eventId: j.e, fallback: j.t || trimmed };
    } catch {}
  }
  return { fallback: trimmed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
  const { eventId, code } = body || {};
  if (!eventId || !code) return new Response(JSON.stringify({ error: "Missing eventId or code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Authorization: must be event owner OR accepted team member
  const { data: event } = await admin.from("events").select("user_id").eq("id", eventId).maybeSingle();
  let allowed = event?.user_id === user.id;
  if (!allowed) {
    const { data: tm } = await admin.from("event_team_members").select("id").eq("event_id", eventId).eq("user_id", user.id).eq("status", "accepted").maybeSingle();
    allowed = !!tm;
  }
  if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const parsed = parseCode(String(code));
  const lookup = parsed.ticket || parsed.fallback;

  // Try to locate the attendee by ticket_id first, then id, then email
  let attendee: any = null;
  for (const filter of [
    () => admin.from("attendees").select("*").eq("event_id", eventId).eq("ticket_id", lookup).maybeSingle(),
    () => admin.from("attendees").select("*").eq("event_id", eventId).eq("id", lookup).maybeSingle(),
    () => admin.from("attendees").select("*").eq("event_id", eventId).eq("email", lookup).maybeSingle(),
  ]) {
    const { data } = await filter();
    if (data) { attendee = data; break; }
  }

  // Tier counts helper
  const tierCounts = async () => {
    const { data } = await admin.from("attendees").select("role,checked_in").eq("event_id", eventId);
    const out: Record<string, { total: number; checkedIn: number }> = {
      General: { total: 0, checkedIn: 0 }, VIP: { total: 0, checkedIn: 0 }, VVIP: { total: 0, checkedIn: 0 },
    };
    (data || []).forEach((r: any) => {
      const k = (r.role || "").toUpperCase() === "VVIP" ? "VVIP" : (r.role || "").toUpperCase() === "VIP" ? "VIP" : "General";
      out[k].total += 1; if (r.checked_in) out[k].checkedIn += 1;
    });
    return out;
  };

  if (!attendee) {
    return new Response(JSON.stringify({ ok: false, status: "not_found", tierCounts: await tierCounts() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (attendee.checked_in) {
    return new Response(JSON.stringify({ ok: false, status: "already", attendee, tierCounts: await tierCounts() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin.from("attendees")
    .update({ checked_in: true, checked_in_at: now, checked_in_by: user.id })
    .eq("id", attendee.id).eq("checked_in", false).select("*").maybeSingle();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!updated) {
    return new Response(JSON.stringify({ ok: false, status: "already", attendee, tierCounts: await tierCounts() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, status: "checked_in", attendee: updated, tierCounts: await tierCounts() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});