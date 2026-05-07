/**
 * send-announcement — Bulk-emails an announcement to attendees of an event.
 *
 * Body: { eventId: string, subject: string, message: string,
 *         tiers?: ('General'|'VIP'|'VVIP')[],
 *         onlyCheckedIn?: boolean, onlyNotCheckedIn?: boolean }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const { eventId, subject, message, tiers, onlyCheckedIn, onlyNotCheckedIn } = body || {};
  if (!eventId || !subject || !message) return new Response(JSON.stringify({ error: "Missing eventId, subject, or message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: event } = await admin.from("events").select("user_id,name").eq("id", eventId).maybeSingle();
  if (!event || event.user_id !== user.id) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let q = admin.from("attendees").select("id,name,email,role,checked_in,ticket_id").eq("event_id", eventId).not("email", "is", null);
  const { data: rows, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const tierSet = new Set((Array.isArray(tiers) && tiers.length ? tiers : ["General","VIP","VVIP"]).map((t: string) => t.toUpperCase()));
  let recipients = (rows || []).filter((r) => r.email && tierSet.has(((r.role || "General").toUpperCase() === "VVIP") ? "VVIP" : (r.role || "General").toUpperCase() === "VIP" ? "VIP" : "GENERAL".replace("GENERAL","GENERAL")));
  // Re-do tier filter properly
  recipients = (rows || []).filter((r: any) => {
    if (!r.email) return false;
    const tier = (r.role || "").toUpperCase() === "VVIP" ? "VVIP" : (r.role || "").toUpperCase() === "VIP" ? "VIP" : "General";
    if (!tierSet.has(tier.toUpperCase())) return false;
    if (onlyCheckedIn && !r.checked_in) return false;
    if (onlyNotCheckedIn && r.checked_in) return false;
    return true;
  });

  let sent = 0, failed = 0;
  const errors: string[] = [];
  for (const r of recipients) {
    const renderedSubject = subject.replaceAll("{{name}}", r.name || "").replaceAll("{{event}}", event.name || "");
    const renderedText = String(message)
      .replaceAll("{{name}}", r.name || "there")
      .replaceAll("{{event}}", event.name || "")
      .replaceAll("{{ticket}}", r.ticket_id || "")
      .replaceAll("{{role}}", r.role || "");
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f5f1;padding:20px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #eee;">
        <h2 style="margin:0 0 12px;color:#0f172a;">${escapeHtml(renderedSubject)}</h2>
        <p style="white-space:pre-wrap;color:#334155;line-height:1.6;font-size:14px;">${escapeHtml(renderedText)}</p>
        <p style="font-size:12px;color:#94a3b8;margin-top:24px;">— ${escapeHtml(event.name || "Event")}</p>
      </div></body></html>`;
    try {
      const { error: e } = await admin.functions.invoke("send-transactional-email", {
        body: { to: r.email, subject: renderedSubject, html, text: renderedText },
      });
      if (e) throw new Error(e.message || "send failed");
      sent += 1;
    } catch (err: any) {
      failed += 1;
      errors.push(`${r.email}: ${err?.message || String(err)}`);
    }
  }

  return new Response(JSON.stringify({ success: true, recipients: recipients.length, sent, failed, errors: errors.slice(0, 10) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});