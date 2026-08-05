/**
 * qr-check-in — Verifies a ticket QR payload and checks the attendee in
 * atomically. Optimised for scan latency: the happy path is a single
 * conditional UPDATE (no pre-SELECT), and tier counts are fetched in
 * parallel with the write.
 *
 * Body: { eventId: string, code: string }
 *   `code` may be a raw ticket id, an attendee id, or the JSON QR payload
 *   built by buildQrPayload (src/lib/ticket.ts).
 *
 * Returns: { ok, status: 'checked_in'|'already'|'not_found'|'invalid',
 *            reason?, attendee?, checkedInAt?, tierCounts }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCode(raw: string): { ticket?: string; eventId?: string; fallback: string; wasJson?: boolean } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { fallback: "" };
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed);
      return { ticket: j.t, eventId: j.e, fallback: j.t || trimmed, wasJson: true };
    } catch { /* malformed JSON — treated as forged below */ }
    return { fallback: trimmed, wasJson: true };
  }
  return { fallback: trimmed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Parse the body while the token is being verified — saves a round trip.
  const bodyPromise = req.json().catch(() => null);
  const [{ data: { user } }, body] = await Promise.all([userClient.auth.getUser(), bodyPromise]);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const { eventId, code } = body as { eventId?: string; code?: string };
  if (!eventId || !code) return json({ error: "Missing eventId or code" }, 400);

  const tierCounts = async () => {
    const { data } = await admin.from("attendees").select("role,checked_in").eq("event_id", eventId);
    const out: Record<string, { total: number; checkedIn: number }> = {
      General: { total: 0, checkedIn: 0 }, VIP: { total: 0, checkedIn: 0 }, VVIP: { total: 0, checkedIn: 0 },
    };
    (data || []).forEach((r: any) => {
      const role = (r.role || "").toUpperCase();
      const k = role === "VVIP" ? "VVIP" : role === "VIP" ? "VIP" : "General";
      out[k].total += 1; if (r.checked_in) out[k].checkedIn += 1;
    });
    return out;
  };

  // Authorization: event owner OR accepted team member.
  const { data: event } = await admin.from("events").select("user_id").eq("id", eventId).maybeSingle();
  let allowed = event?.user_id === user.id;
  if (!allowed) {
    const { data: tm } = await admin.from("event_team_members")
      .select("id").eq("event_id", eventId).eq("user_id", user.id).eq("status", "accepted").maybeSingle();
    allowed = !!tm;
  }
  if (!allowed) return json({ error: "Forbidden" }, 403);

  const parsed = parseCode(String(code));
  const lookup = (parsed.ticket || parsed.fallback || "").trim();

  // Reject forged / tampered / cross-event payloads before touching attendee rows.
  if (parsed.wasJson && (!parsed.ticket || (parsed.eventId && parsed.eventId !== eventId))) {
    return json({
      ok: false,
      status: "invalid",
      reason: parsed.ticket
        ? "This badge was issued for a different event."
        : "This QR code is not a valid EventPadi ticket.",
      tierCounts: await tierCounts(),
    });
  }
  if (!lookup) return json({ ok: false, status: "invalid", reason: "Empty ticket code.", tierCounts: await tierCounts() });

  const byId = UUID_RE.test(lookup);
  const column = byId ? "id" : "ticket_id";
  const now = new Date().toISOString();

  // Happy path in ONE write: conditional update only succeeds if not yet checked in.
  const [{ data: updated, error }, counts] = await Promise.all([
    admin.from("attendees")
      .update({ checked_in: true, checked_in_at: now, checked_in_by: user.id })
      .eq("event_id", eventId).eq(column, lookup).eq("checked_in", false)
      .select("*").maybeSingle(),
    tierCounts(),
  ]);
  if (error) return json({ error: error.message }, 500);

  if (updated) {
    // Reflect this check-in in the counts we fetched concurrently.
    const role = (updated.role || "").toUpperCase();
    const k = role === "VVIP" ? "VVIP" : role === "VIP" ? "VIP" : "General";
    if (counts[k] && counts[k].checkedIn < counts[k].total) counts[k].checkedIn += 1;
    return json({ ok: true, status: "checked_in", attendee: updated, tierCounts: counts });
  }

  // No row updated: either already checked in, or unknown ticket.
  const { data: existing } = await admin.from("attendees")
    .select("*").eq("event_id", eventId).eq(column, lookup).maybeSingle();

  if (!existing) {
    return json({
      ok: false,
      status: "not_found",
      reason: "No attendee on this event's list matches this badge.",
      tierCounts: counts,
    });
  }

  let checkedInByName: string | null = null;
  if (existing.checked_in_by) {
    const { data: prof } = await admin.from("profiles")
      .select("display_name").eq("user_id", existing.checked_in_by).maybeSingle();
    checkedInByName = prof?.display_name ?? null;
  }

  return json({
    ok: false,
    status: "already",
    reason: "This badge has already been used to enter.",
    attendee: existing,
    checkedInAt: existing.checked_in_at,
    checkedInByName,
    tierCounts: counts,
  });
});
