/**
 * send-team-invite — Sends an HTML invitation email with event stats
 * to a team member using Supabase Auth admin API.
 *
 * Expects JSON body: { inviteId: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { inviteId } = await req.json();
    if (!inviteId) {
      return new Response(JSON.stringify({ error: "Missing inviteId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the invite with event details
    const { data: invite, error: inviteError } = await supabase
      .from("event_team_members")
      .select("*, events(name, event_date, city, country)")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invite not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.invited_by !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch attendee stats for the event
    const { data: attendeeData } = await supabase
      .from("attendees")
      .select("id, checked_in")
      .eq("event_id", invite.event_id);

    const totalAttendees = attendeeData?.length || 0;
    const checkedInCount = attendeeData?.filter((a: any) => a.checked_in).length || 0;
    const remainingCount = totalAttendees - checkedInCount;

    const siteUrl = req.headers.get("origin") || "https://eventpadi.lovable.app";
    const acceptUrl = `${siteUrl}/invite/${invite.invitation_token}`;
    const eventName = invite.events?.name || "an event";
    const eventDate = invite.events?.event_date || "";
    const eventLocation = [invite.events?.city, invite.events?.country].filter(Boolean).join(", ");
    const roleName = invite.role === "admin" ? "Admin" : "Registration Staff";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f0eb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f0eb;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a2040,#2a3060,#6b3a1f);padding:32px 24px;text-align:center;">
          <h1 style="color:#ffffff;font-size:22px;margin:0;">My<span style="color:#f97316;">event</span></h1>
          <p style="color:#c0c0c8;font-size:13px;margin:8px 0 0;">You've been invited to join a team</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 24px;">
          <h2 style="color:#1a2040;font-size:18px;margin:0 0 16px;">You're invited!</h2>
          <p style="color:#55575d;font-size:14px;line-height:1.6;margin:0 0 20px;">
            You've been invited to join <strong style="color:#1a2040;">${eventName}</strong> as <strong style="color:#f97316;">${roleName}</strong>.
          </p>
          ${eventDate || eventLocation ? `
          <table style="background:#f8f5f1;border-radius:8px;width:100%;margin-bottom:20px;" cellpadding="0" cellspacing="0">
            <tr><td style="padding:12px 16px;">
              ${eventDate ? `<p style="color:#55575d;font-size:13px;margin:0 0 4px;">📅 <strong>Date:</strong> ${eventDate}</p>` : ""}
              ${eventLocation ? `<p style="color:#55575d;font-size:13px;margin:0;">📍 <strong>Location:</strong> ${eventLocation}</p>` : ""}
            </td></tr>
          </table>` : ""}

          <!-- Event Stats -->
          <table style="width:100%;margin-bottom:20px;border-collapse:collapse;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:33%;text-align:center;padding:12px 8px;background:#f0f9ff;border-radius:8px 0 0 8px;">
                <p style="color:#1a2040;font-size:22px;font-weight:700;margin:0;">${totalAttendees}</p>
                <p style="color:#888;font-size:11px;margin:4px 0 0;text-transform:uppercase;">Registered</p>
              </td>
              <td style="width:33%;text-align:center;padding:12px 8px;background:#f0fdf4;">
                <p style="color:#16a34a;font-size:22px;font-weight:700;margin:0;">${checkedInCount}</p>
                <p style="color:#888;font-size:11px;margin:4px 0 0;text-transform:uppercase;">Checked In</p>
              </td>
              <td style="width:33%;text-align:center;padding:12px 8px;background:#fff7ed;border-radius:0 8px 8px 0;">
                <p style="color:#ea580c;font-size:22px;font-weight:700;margin:0;">${remainingCount}</p>
                <p style="color:#888;font-size:11px;margin:4px 0 0;text-transform:uppercase;">Remaining</p>
              </td>
            </tr>
          </table>

          <p style="color:#55575d;font-size:14px;line-height:1.6;margin:0 0 8px;">
            ${invite.role === "admin"
              ? "As an Admin, you'll have full access to upload attendees, manage check-ins, export data, and manage the team."
              : "As Registration Staff, you'll be able to check in attendees at the event. You'll see real-time stats and the full attendee list."}
          </p>
          <p style="color:#55575d;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Click the button below to accept the invitation and start working.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${acceptUrl}" style="display:inline-block;background:linear-gradient(135deg,#f97316,#eab308);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:14px;">
                Accept Invitation
              </a>
            </td></tr>
          </table>
          <p style="color:#999;font-size:12px;margin:24px 0 0;text-align:center;">
            This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8f5f1;padding:16px 24px;text-align:center;">
          <p style="color:#999;font-size:11px;margin:0;">Powered by Myevent — African Event Management</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(
      invite.invited_email,
      {
        data: {
          invitation_token: invite.invitation_token,
          event_id: invite.event_id,
          role: invite.role,
        },
        redirectTo: acceptUrl,
      }
    );

    if (emailError) {
      console.log("inviteUserByEmail note:", emailError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        acceptUrl,
        emailSent: !emailError,
        message: emailError
          ? "Invitation created! Share this link with the team member."
          : "Invitation email sent successfully!",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-team-invite error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
