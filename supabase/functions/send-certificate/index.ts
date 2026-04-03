/**
 * send-certificate Edge Function
 * 
 * Generates a PDF certificate for a checked-in attendee, uploads it to storage,
 * and optionally sends an email with the download link.
 * 
 * Request body:
 * - attendeeId: string (required)
 * - attendeeName: string (required)
 * - attendeeEmail: string | null
 * - eventName: string (required)
 * - eventDate: string | null
 * - eventLocation: string | null (city, country)
 * - certificateId: string (required, unique ID for the certificate)
 * - customTemplateUrl: string | null (URL to a custom background image)
 */

import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      attendeeId,
      attendeeName,
      attendeeEmail,
      eventName,
      eventDate,
      eventLocation,
      certificateId,
      customTemplateUrl,
    } = await req.json();

    if (!attendeeId || !attendeeName || !eventName || !certificateId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Generate PDF certificate
    const pdfBytes = await generateCertificatePDF({
      attendeeName,
      eventName,
      eventDate: eventDate || "TBD",
      eventLocation: eventLocation || "",
      certificateId,
      customTemplateUrl,
    });

    // Upload to storage
    const fileName = `${certificateId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload certificate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("certificates")
      .getPublicUrl(fileName);

    const certificateUrl = urlData.publicUrl;

    // Update attendee record
    const { error: updateError } = await supabase
      .from("attendees")
      .update({
        certificate_url: certificateUrl,
        certificate_sent_at: new Date().toISOString(),
      })
      .eq("id", attendeeId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    // Send email if attendee has an email address
    let emailSent = false;
    if (attendeeEmail) {
      try {
        // Use transactional email if available, otherwise skip
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "certificate-delivery",
            recipientEmail: attendeeEmail,
            idempotencyKey: `cert-${certificateId}`,
            templateData: {
              name: attendeeName,
              eventName,
              certificateUrl,
            },
          },
        });
        emailSent = true;
      } catch (emailErr) {
        // Email is optional — certificate still generated
        console.warn("Email send skipped or failed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        certificateUrl,
        emailSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Certificate generation error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Generates a PDF certificate using raw PDF content generation.
 * Creates an elegant certificate with African-inspired warm colors.
 */
async function generateCertificatePDF(opts: {
  attendeeName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  certificateId: string;
  customTemplateUrl?: string | null;
}): Promise<Uint8Array> {
  const { attendeeName, eventName, eventDate, eventLocation, certificateId } = opts;

  // PDF dimensions: A4 landscape
  const pageW = 841.89;
  const pageH = 595.28;

  // Build PDF manually (minimal valid PDF)
  const objects: string[] = [];
  let objCount = 0;
  const offsets: number[] = [];

  function addObj(content: string): number {
    objCount++;
    objects.push(content);
    return objCount;
  }

  // Obj 1: Catalog
  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

  // Obj 2: Pages
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");

  // Obj 3: Page
  addObj(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`
  );

  // Build content stream
  const lines: string[] = [];
  const cx = pageW / 2;

  // Background fill — warm cream
  lines.push("0.98 0.96 0.93 rg");
  lines.push(`0 0 ${pageW} ${pageH} re f`);

  // Decorative border — sunset orange
  lines.push("0.93 0.42 0.14 RG");
  lines.push("3 w");
  lines.push(`20 20 ${pageW - 40} ${pageH - 40} re S`);

  // Inner border — gold
  lines.push("1.0 0.76 0.0 RG");
  lines.push("1.5 w");
  lines.push(`35 35 ${pageW - 70} ${pageH - 70} re S`);

  // Corner accents (small triangles in orange)
  lines.push("0.93 0.42 0.14 rg");
  // Top-left
  lines.push("20 575 m 20 545 l 50 575 l f");
  // Top-right
  lines.push(`${pageW - 20} 575 m ${pageW - 20} 545 l ${pageW - 50} 575 l f`);
  // Bottom-left
  lines.push("20 20 m 20 50 l 50 20 l f");
  // Bottom-right
  lines.push(`${pageW - 20} 20 m ${pageW - 20} 50 l ${pageW - 50} 20 l f`);

  // Title: CERTIFICATE OF ATTENDANCE
  lines.push("BT");
  lines.push(`/F2 14 Tf`);
  lines.push("0.93 0.42 0.14 rg");
  const titleText = "CERTIFICATE OF ATTENDANCE";
  const titleW = titleText.length * 7.5;
  lines.push(`${cx - titleW / 2} 500 Td`);
  lines.push(`(${titleText}) Tj`);
  lines.push("ET");

  // Decorative line under title
  lines.push("0.93 0.42 0.14 RG");
  lines.push("2 w");
  lines.push(`${cx - 120} 490 m ${cx + 120} 490 l S`);

  // "This is to certify that"
  lines.push("BT");
  lines.push(`/F1 12 Tf`);
  lines.push("0.2 0.15 0.1 rg");
  const certifyText = "This is to certify that";
  const certifyW = certifyText.length * 5.5;
  lines.push(`${cx - certifyW / 2} 450 Td`);
  lines.push(`(${escPdf(certifyText)}) Tj`);
  lines.push("ET");

  // Attendee Name (large, bold)
  lines.push("BT");
  lines.push(`/F2 28 Tf`);
  lines.push("0.13 0.11 0.09 rg");
  const nameW = attendeeName.length * 14;
  lines.push(`${cx - nameW / 2} 400 Td`);
  lines.push(`(${escPdf(attendeeName)}) Tj`);
  lines.push("ET");

  // Line under name
  lines.push("1.0 0.76 0.0 RG");
  lines.push("1 w");
  lines.push(`${cx - 150} 390 m ${cx + 150} 390 l S`);

  // "has attended"
  lines.push("BT");
  lines.push(`/F1 12 Tf`);
  lines.push("0.2 0.15 0.1 rg");
  const attendedText = "has successfully attended";
  const attendedW = attendedText.length * 5.5;
  lines.push(`${cx - attendedW / 2} 360 Td`);
  lines.push(`(${escPdf(attendedText)}) Tj`);
  lines.push("ET");

  // Event Name (prominent)
  lines.push("BT");
  lines.push(`/F2 20 Tf`);
  lines.push("0.93 0.42 0.14 rg");
  const evNameW = eventName.length * 10;
  lines.push(`${cx - evNameW / 2} 320 Td`);
  lines.push(`(${escPdf(eventName)}) Tj`);
  lines.push("ET");

  // Date and Location
  const dateLocText = [eventDate, eventLocation].filter(Boolean).join("  |  ");
  lines.push("BT");
  lines.push(`/F1 11 Tf`);
  lines.push("0.35 0.3 0.25 rg");
  const dlW = dateLocText.length * 5;
  lines.push(`${cx - dlW / 2} 285 Td`);
  lines.push(`(${escPdf(dateLocText)}) Tj`);
  lines.push("ET");

  // Signature line
  lines.push("0.5 0.45 0.4 RG");
  lines.push("0.5 w");
  lines.push(`${cx - 100} 180 m ${cx + 100} 180 l S`);

  lines.push("BT");
  lines.push(`/F1 10 Tf`);
  lines.push("0.35 0.3 0.25 rg");
  const sigText = "Event Organizer";
  const sigW = sigText.length * 4.5;
  lines.push(`${cx - sigW / 2} 165 Td`);
  lines.push(`(${escPdf(sigText)}) Tj`);
  lines.push("ET");

  // Certificate ID (small, bottom)
  lines.push("BT");
  lines.push(`/F1 8 Tf`);
  lines.push("0.6 0.55 0.5 rg");
  const idText = `Certificate ID: ${certificateId}`;
  const idW = idText.length * 3.8;
  lines.push(`${cx - idW / 2} 60 Td`);
  lines.push(`(${escPdf(idText)}) Tj`);
  lines.push("ET");

  const contentStr = lines.join("\n");
  const contentBytes = new TextEncoder().encode(contentStr);

  // Obj 4: Content stream
  addObj(
    `4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${contentStr}\nendstream\nendobj`
  );

  // Obj 5: Font Helvetica (body)
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");

  // Obj 6: Font Helvetica-Bold (headings)
  addObj("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");

  // Assemble PDF
  let pdf = "%PDF-1.4\n";
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += objects[i] + "\n";
  }

  const xrefOffset = pdf.length;
  pdf += "xref\n";
  pdf += `0 ${objCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += "trailer\n";
  pdf += `<< /Size ${objCount + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF\n";

  return new TextEncoder().encode(pdf);
}

function escPdf(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
