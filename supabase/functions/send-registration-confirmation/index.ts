/**
 * send-registration-confirmation — Sends a registration confirmation email
 * (via send-transactional-email) and returns a prebuilt WhatsApp share URL
 * the client can open to deliver a parallel WhatsApp confirmation.
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
  try {
    const body = await req.json();
    const { registrationId, name, email, phone, ticketTier, admits, ticketRef, eventTitle, eventDate, location, registrationUrl } = body;
    if (!registrationId || !name || !ticketRef || !eventTitle) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tierLabel = String(ticketTier || "general").toUpperCase();
    const admitsN = Number(admits || 1);
    const dateStr = eventDate ? new Date(eventDate).toLocaleString() : "";
    const subject = `🎟 You're confirmed for ${eventTitle}`;
    const text = [
      `Hi ${name},`,
      ``,
      `You're confirmed for ${eventTitle}.`,
      `Tier: ${tierLabel}`,
      `Admits: ${admitsN}`,
      `Ticket reference: ${ticketRef}`,
      dateStr ? `When: ${dateStr}` : "",
      location ? `Where: ${location}` : "",
      ``,
      `Show this reference (and your QR ticket) at check-in.`,
      registrationUrl ? `Manage: ${registrationUrl}` : "",
    ].filter(Boolean).join("\n");

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f5f1;padding:20px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #eee;">
        <h2 style="margin:0 0 8px;color:#0f172a;">${escapeHtml(eventTitle)}</h2>
        <p style="color:#475569;margin:0 0 16px;">You're confirmed, ${escapeHtml(name)} — see you soon.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a;">
          <tr><td style="padding:6px 0;color:#64748b;">Tier</td><td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(tierLabel)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Admits</td><td style="padding:6px 0;text-align:right;font-weight:600;">${admitsN}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Ticket</td><td style="padding:6px 0;text-align:right;font-family:monospace;">${escapeHtml(ticketRef)}</td></tr>
          ${dateStr ? `<tr><td style=\"padding:6px 0;color:#64748b;\">When</td><td style=\"padding:6px 0;text-align:right;\">${escapeHtml(dateStr)}</td></tr>` : ""}
          ${location ? `<tr><td style=\"padding:6px 0;color:#64748b;\">Where</td><td style=\"padding:6px 0;text-align:right;\">${escapeHtml(location)}</td></tr>` : ""}
        </table>
        <p style="font-size:12px;color:#94a3b8;margin-top:18px;">Save this email. You'll need your ticket reference at the door.</p>
      </div></body></html>`;

    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let emailError: string | null = null;
    if (email) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data, error } = await admin.functions.invoke("send-transactional-email", {
          body: { to: email, subject, html, text },
        });
        if (error) throw new Error(error.message || "Email service error");
        if ((data as any)?.error) throw new Error((data as any).error);
        emailStatus = "sent";
      } catch (err: any) {
        emailStatus = "failed";
        emailError = err?.message || String(err);
      }
    }

    let whatsappUrl: string | null = null;
    if (phone) {
      const digits = String(phone).replace(/\D+/g, "");
      if (digits.length >= 7) {
        whatsappUrl = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
      }
    }

    return new Response(JSON.stringify({ success: true, emailStatus, emailError, whatsappUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});