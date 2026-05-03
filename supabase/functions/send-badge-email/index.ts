/**
 * send-badge-email — Sends a badge PNG to an attendee via Lovable transactional email.
 *
 * Body: { attendeeId, attendeeEmail, attendeeName, eventId, eventName, subject, message, pngBase64, ticketId, admits, role, logId? }
 * Returns: { success: boolean, logId, status: 'sent'|'failed', error?: string }
 *
 * Tracks each send in public.badge_share_log so the UI can show sent/failed status and offer retry.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const {
    attendeeId, attendeeEmail, attendeeName, eventId, eventName,
    subject, message, pngBase64, ticketId, admits, role, logId: existingLogId,
  } = body;

  if (!attendeeEmail || !attendeeId || !eventId || !pngBase64) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const finalSubject = (subject && String(subject).trim()) || `Your badge for ${eventName}`;
  const finalMessage = (message && String(message).trim()) || `Hi {{name}},\n\nHere is your check-in badge for {{event}}.\nTicket ID: {{ticket}}\nAdmits: {{admits}}\n\nPresent the QR code at the entrance. See you there!`;

  const renderedText = finalMessage
    .replaceAll("{{name}}", attendeeName || "there")
    .replaceAll("{{event}}", eventName || "")
    .replaceAll("{{ticket}}", ticketId || "")
    .replaceAll("{{admits}}", String(admits ?? 1))
    .replaceAll("{{role}}", role || "");
  const renderedSubject = finalSubject
    .replaceAll("{{name}}", attendeeName || "")
    .replaceAll("{{event}}", eventName || "");

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f7f7;padding:20px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #eee;">
      <h2 style="margin:0 0 12px 0;color:#111;">${escapeHtml(renderedSubject)}</h2>
      <p style="white-space:pre-wrap;color:#333;line-height:1.5;font-size:14px;">${escapeHtml(renderedText)}</p>
      <div style="text-align:center;margin:20px 0;">
        <img src="cid:badge.png" alt="Badge" style="max-width:320px;border:1px solid #eee;border-radius:8px;" />
      </div>
      <p style="font-size:12px;color:#888;margin-top:16px;">Sent via ${escapeHtml(eventName || "Event")}</p>
    </div></body></html>`;

  // Upsert log row first
  let logId = existingLogId as string | undefined;
  if (!logId) {
    const { data: created } = await admin.from("badge_share_log").insert({
      event_id: eventId,
      attendee_id: attendeeId,
      user_id: user.id,
      channel: "email",
      recipient: attendeeEmail,
      subject: renderedSubject,
      status: "pending",
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
    }).select("id").single();
    logId = created?.id;
  } else {
    await admin.from("badge_share_log").update({
      status: "pending",
      recipient: attendeeEmail,
      subject: renderedSubject,
      attempts: 0, // will be incremented below
      last_attempt_at: new Date().toISOString(),
    }).eq("id", logId);
    const { data: row } = await admin.from("badge_share_log").select("attempts").eq("id", logId).single();
    await admin.from("badge_share_log").update({ attempts: (row?.attempts ?? 0) + 1 }).eq("id", logId);
  }

  // Try delivery via Lovable transactional email
  try {
    const { data, error } = await admin.functions.invoke("send-transactional-email", {
      body: {
        to: attendeeEmail,
        subject: renderedSubject,
        html,
        text: renderedText,
        attachments: [
          { filename: `badge-${(attendeeName || "attendee").replace(/\s+/g, "-")}.png`, content: pngBase64, contentType: "image/png", cid: "badge.png" },
        ],
      },
    });
    if (error) throw new Error(error.message || "Email service error");
    if ((data as any)?.error) throw new Error((data as any).error);

    await admin.from("badge_share_log").update({ status: "sent", error: null, last_attempt_at: new Date().toISOString() }).eq("id", logId!);
    return new Response(JSON.stringify({ success: true, logId, status: "sent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    const msg = err?.message || String(err);
    const friendly = /not.?found|404|send-transactional-email/i.test(msg)
      ? "Email service not set up yet. Please configure your email domain to enable badge email delivery."
      : msg;
    await admin.from("badge_share_log").update({ status: "failed", error: friendly, last_attempt_at: new Date().toISOString() }).eq("id", logId!);
    return new Response(JSON.stringify({ success: false, logId, status: "failed", error: friendly }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});