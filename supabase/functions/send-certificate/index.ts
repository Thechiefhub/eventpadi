/**
 * send-certificate Edge Function
 * 
 * Generates a PDF certificate for a checked-in attendee, uploads it to storage,
 * and optionally sends an email with the download link.
 * 
 * Supports two modes:
 * - "auto": Generates a professional PDF with African-inspired design
 * - "custom": Overlays the attendee name on a custom template image at specified position
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      namePosition,
      certMode,
    } = await req.json();

    if (!attendeeId || !attendeeName || !eventName || !certificateId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let pdfBytes: Uint8Array;

    if (certMode === "custom" && customTemplateUrl) {
      // Custom template mode: generate PDF with image background + overlaid name
      pdfBytes = await generateCustomCertPDF({
        attendeeName,
        eventName,
        eventDate: eventDate || "",
        certificateId,
        templateUrl: customTemplateUrl,
        namePosition: namePosition || { x: 50, y: 50 },
      });
    } else {
      // Auto mode: built-in design
      pdfBytes = await generateAutoCertPDF({
        attendeeName,
        eventName,
        eventDate: eventDate || "TBD",
        eventLocation: eventLocation || "",
        certificateId,
      });
    }

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

    // Bucket is private — issue a long-lived signed URL (1 year)
    const { data: signed, error: signedErr } = await supabase.storage
      .from("certificates")
      .createSignedUrl(fileName, 60 * 60 * 24 * 365);

    if (signedErr || !signed?.signedUrl) {
      console.error("Signed URL error:", signedErr);
      return new Response(
        JSON.stringify({ error: "Failed to sign certificate URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const certificateUrl = signed.signedUrl;

    // Update attendee record
    await supabase
      .from("attendees")
      .update({
        certificate_url: certificateUrl,
        certificate_sent_at: new Date().toISOString(),
      })
      .eq("id", attendeeId);

    // Send email if attendee has an email address
    let emailSent = false;
    if (attendeeEmail) {
      try {
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
        console.warn("Email send skipped or failed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, certificateUrl, emailSent }),
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
 * Auto-generated certificate with African-inspired design
 */
async function generateAutoCertPDF(opts: {
  attendeeName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  certificateId: string;
}): Promise<Uint8Array> {
  const { attendeeName, eventName, eventDate, eventLocation, certificateId } = opts;
  const pageW = 841.89;
  const pageH = 595.28;
  const cx = pageW / 2;

  const lines: string[] = [];

  // Background
  lines.push("0.98 0.96 0.93 rg");
  lines.push(`0 0 ${pageW} ${pageH} re f`);

  // Borders
  lines.push("0.93 0.42 0.14 RG");
  lines.push("3 w");
  lines.push(`20 20 ${pageW - 40} ${pageH - 40} re S`);
  lines.push("1.0 0.76 0.0 RG");
  lines.push("1.5 w");
  lines.push(`35 35 ${pageW - 70} ${pageH - 70} re S`);

  // Corner accents
  lines.push("0.93 0.42 0.14 rg");
  lines.push("20 575 m 20 545 l 50 575 l f");
  lines.push(`${pageW - 20} 575 m ${pageW - 20} 545 l ${pageW - 50} 575 l f`);
  lines.push("20 20 m 20 50 l 50 20 l f");
  lines.push(`${pageW - 20} 20 m ${pageW - 20} 50 l ${pageW - 50} 20 l f`);

  // Title
  lines.push("BT");
  lines.push("/F2 14 Tf");
  lines.push("0.93 0.42 0.14 rg");
  const titleText = "CERTIFICATE OF ATTENDANCE";
  lines.push(`${cx - (titleText.length * 7.5) / 2} 500 Td`);
  lines.push(`(${escPdf(titleText)}) Tj`);
  lines.push("ET");

  lines.push("0.93 0.42 0.14 RG");
  lines.push("2 w");
  lines.push(`${cx - 120} 490 m ${cx + 120} 490 l S`);

  // Certify text
  lines.push("BT");
  lines.push("/F1 12 Tf");
  lines.push("0.2 0.15 0.1 rg");
  const certText = "This is to certify that";
  lines.push(`${cx - (certText.length * 5.5) / 2} 450 Td`);
  lines.push(`(${escPdf(certText)}) Tj`);
  lines.push("ET");

  // Name
  lines.push("BT");
  lines.push("/F2 28 Tf");
  lines.push("0.13 0.11 0.09 rg");
  lines.push(`${cx - (attendeeName.length * 14) / 2} 400 Td`);
  lines.push(`(${escPdf(attendeeName)}) Tj`);
  lines.push("ET");

  lines.push("1.0 0.76 0.0 RG");
  lines.push("1 w");
  lines.push(`${cx - 150} 390 m ${cx + 150} 390 l S`);

  // Attended
  lines.push("BT");
  lines.push("/F1 12 Tf");
  lines.push("0.2 0.15 0.1 rg");
  const attText = "has successfully attended";
  lines.push(`${cx - (attText.length * 5.5) / 2} 360 Td`);
  lines.push(`(${escPdf(attText)}) Tj`);
  lines.push("ET");

  // Event name
  lines.push("BT");
  lines.push("/F2 20 Tf");
  lines.push("0.93 0.42 0.14 rg");
  lines.push(`${cx - (eventName.length * 10) / 2} 320 Td`);
  lines.push(`(${escPdf(eventName)}) Tj`);
  lines.push("ET");

  // Date/location
  const dlText = [eventDate, eventLocation].filter(Boolean).join("  |  ");
  lines.push("BT");
  lines.push("/F1 11 Tf");
  lines.push("0.35 0.3 0.25 rg");
  lines.push(`${cx - (dlText.length * 5) / 2} 285 Td`);
  lines.push(`(${escPdf(dlText)}) Tj`);
  lines.push("ET");

  // Signature
  lines.push("0.5 0.45 0.4 RG");
  lines.push("0.5 w");
  lines.push(`${cx - 100} 180 m ${cx + 100} 180 l S`);
  lines.push("BT");
  lines.push("/F1 10 Tf");
  lines.push("0.35 0.3 0.25 rg");
  const sigText = "Event Organizer";
  lines.push(`${cx - (sigText.length * 4.5) / 2} 165 Td`);
  lines.push(`(${escPdf(sigText)}) Tj`);
  lines.push("ET");

  // Certificate ID
  lines.push("BT");
  lines.push("/F1 8 Tf");
  lines.push("0.6 0.55 0.5 rg");
  const idText = `Certificate ID: ${certificateId}`;
  lines.push(`${cx - (idText.length * 3.8) / 2} 60 Td`);
  lines.push(`(${escPdf(idText)}) Tj`);
  lines.push("ET");

  return buildPDF(pageW, pageH, lines);
}

/**
 * Custom template certificate — overlays attendee name on the image
 */
async function generateCustomCertPDF(opts: {
  attendeeName: string;
  eventName: string;
  eventDate: string;
  certificateId: string;
  templateUrl: string;
  namePosition: { x: number; y: number };
}): Promise<Uint8Array> {
  const { attendeeName, eventName, certificateId, templateUrl, namePosition } = opts;
  const pageW = 841.89;
  const pageH = 595.28;

  // Fetch the template image
  let imgBytes: Uint8Array;
  let imgType: "jpeg" | "png" = "jpeg";
  try {
    const resp = await fetch(templateUrl);
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("png")) imgType = "png";
    imgBytes = new Uint8Array(await resp.arrayBuffer());
  } catch (err) {
    console.error("Failed to fetch template:", err);
    // Fallback to auto
    return generateAutoCertPDF({
      attendeeName,
      eventName,
      eventDate: opts.eventDate,
      eventLocation: "",
      certificateId,
    });
  }

  // Build PDF with embedded image + text overlay
  const objects: string[] = [];
  let objCount = 0;

  function addObj(content: string): number {
    objCount++;
    objects.push(content);
    return objCount;
  }

  // Obj 1: Catalog
  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  // Obj 2: Pages
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  // Obj 3: Page (will reference image XObject and fonts)
  addObj(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Img0 7 0 R >> >> >>\nendobj`
  );

  // Build content stream: draw image full-page, then overlay text
  const nameX = (namePosition.x / 100) * pageW;
  const nameY = pageH - (namePosition.y / 100) * pageH;

  const contentLines: string[] = [];
  // Draw image
  contentLines.push("q");
  contentLines.push(`${pageW} 0 0 ${pageH} 0 0 cm`);
  contentLines.push("/Img0 Do");
  contentLines.push("Q");

  // Overlay attendee name
  contentLines.push("BT");
  contentLines.push("/F2 28 Tf");
  contentLines.push("0.13 0.11 0.09 rg");
  contentLines.push(`${nameX - (attendeeName.length * 14) / 2} ${nameY} Td`);
  contentLines.push(`(${escPdf(attendeeName)}) Tj`);
  contentLines.push("ET");

  // Certificate ID (bottom center)
  contentLines.push("BT");
  contentLines.push("/F1 7 Tf");
  contentLines.push("0.5 0.5 0.5 rg");
  const idText = `ID: ${certificateId}`;
  contentLines.push(`${pageW / 2 - (idText.length * 3) / 2} 25 Td`);
  contentLines.push(`(${escPdf(idText)}) Tj`);
  contentLines.push("ET");

  const contentStr = contentLines.join("\n");
  const contentBytes = new TextEncoder().encode(contentStr);

  // Obj 4: Content stream
  addObj(
    `4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${contentStr}\nendstream\nendobj`
  );

  // Obj 5: Font Helvetica
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
  // Obj 6: Font Helvetica-Bold
  addObj("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");

  // Obj 7: Image XObject
  const filter = imgType === "jpeg" ? "/DCTDecode" : "/FlateDecode";
  const colorSpace = "/DeviceRGB";
  // For simplicity, embed as DCTDecode (JPEG) or raw
  addObj(
    `7 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(pageW)} /Height ${Math.round(pageH)} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter ${filter} /Length ${imgBytes.length} >>\nstream\n`
  );
  // We need binary image data — append after

  // Assemble PDF with binary image
  let pdfHeader = "%PDF-1.4\n";
  const offsets: number[] = [];

  // Write objects 1-6 as text
  let textPart = "";
  for (let i = 0; i < 6; i++) {
    offsets.push(pdfHeader.length + textPart.length);
    textPart += objects[i] + "\n";
  }

  // Object 7 needs binary data
  const obj7Header = objects[6];
  const obj7Offset = pdfHeader.length + textPart.length;
  offsets.push(obj7Offset);

  const obj7Footer = "\nendstream\nendobj\n";

  const headerBytes = new TextEncoder().encode(pdfHeader + textPart + obj7Header);
  const footerBytes = new TextEncoder().encode(obj7Footer);

  const xrefStart = headerBytes.length + imgBytes.length + footerBytes.length;

  let xref = "xref\n";
  xref += `0 ${objCount + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  let trailer = "trailer\n";
  trailer += `<< /Size ${objCount + 1} /Root 1 0 R >>\n`;
  trailer += "startxref\n";
  trailer += `${xrefStart}\n`;
  trailer += "%%EOF\n";

  const xrefBytes = new TextEncoder().encode(xref + trailer);

  // Combine all parts
  const total = new Uint8Array(headerBytes.length + imgBytes.length + footerBytes.length + xrefBytes.length);
  total.set(headerBytes, 0);
  total.set(imgBytes, headerBytes.length);
  total.set(footerBytes, headerBytes.length + imgBytes.length);
  total.set(xrefBytes, headerBytes.length + imgBytes.length + footerBytes.length);

  return total;
}

/**
 * Build a simple PDF from content lines (for auto mode)
 */
function buildPDF(pageW: number, pageH: number, contentLines: string[]): Uint8Array {
  const objects: string[] = [];
  let objCount = 0;
  const offsets: number[] = [];

  function addObj(content: string): number {
    objCount++;
    objects.push(content);
    return objCount;
  }

  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  addObj(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`
  );

  const contentStr = contentLines.join("\n");
  const contentBytes = new TextEncoder().encode(contentStr);
  addObj(
    `4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${contentStr}\nendstream\nendobj`
  );
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
  addObj("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");

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
