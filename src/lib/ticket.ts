import jsPDF from "jspdf";
import QRCode from "qrcode";

export interface TicketInfo {
  ticketRef: string;
  name: string;
  tier: string;
  admits: number;
  eventTitle: string;
  eventDate?: string | null;
  location?: string | null;
  qrPayload?: string;
}

/** Build a stable QR payload — same string is encoded into a single QR code,
 *  so re-generating the PDF produces the identical QR for scanning. */
export function buildQrPayload(t: { ticketRef: string; eventId?: string; registrationId?: string }) {
  return JSON.stringify({ t: t.ticketRef, e: t.eventId || "", r: t.registrationId || "" });
}

/** Generate a downloadable PDF ticket with QR code. */
export async function downloadTicketPdf(ticket: TicketInfo) {
  const qr = ticket.qrPayload || ticket.ticketRef;
  const qrDataUrl = await QRCode.toDataURL(qr, { errorCorrectionLevel: "M", margin: 1, width: 480 });

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 90, W, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(ticket.eventTitle.slice(0, 40), 24, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Official Event Ticket", 24, 62);

  // QR
  doc.addImage(qrDataUrl, "PNG", W - 170, 120, 150, 150);

  // Details
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(ticket.name, 24, 140);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  let y = 165;
  const row = (label: string, value: string) => {
    doc.setTextColor(100, 116, 139);
    doc.text(label, 24, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(value, 110, y);
    doc.setFont("helvetica", "normal");
    y += 18;
  };
  row("Tier", ticket.tier.toUpperCase());
  row("Admits", String(ticket.admits));
  row("Ticket", ticket.ticketRef);
  if (ticket.eventDate) row("When", new Date(ticket.eventDate).toLocaleString());
  if (ticket.location) row("Where", ticket.location.slice(0, 32));

  // Footer note
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("Present this QR at check-in. Non-transferable.", 24, H - 24);

  doc.save(`ticket-${ticket.ticketRef}.pdf`);
}