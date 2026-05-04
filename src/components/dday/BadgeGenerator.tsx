import { useRef, useState, useCallback, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Sparkles, Search, X, Download, Loader2, Link2, Copy, Check, Mail, MessageCircle, Instagram, Pencil, Package, Settings2, Send, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Eye, Filter } from "lucide-react";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Attendee } from "@/hooks/useAttendees";

interface Props {
  eventId: string;
  attendees: Attendee[];
  eventName: string;
  onGenerateMissingIds?: () => Promise<void>;
}

/** Per-channel customizable templates (persisted per event). Variables: {{name}}, {{event}}, {{ticket}}, {{admits}}, {{role}} */
type ShareTemplates = {
  emailSubject: string;
  emailBody: string;
  whatsappBody: string;
  instagramCaption: string;
};

const DEFAULT_TEMPLATES: ShareTemplates = {
  emailSubject: "Your badge for {{event}}",
  emailBody:
    "Hi {{name}},\n\nHere is your check-in badge for {{event}}.\nTicket ID: {{ticket}}\nAdmits: {{admits}}\n\nPresent the QR code at the entrance. See you there!",
  whatsappBody:
    "Your badge for *{{event}}*\nTicket ID: {{ticket}}\nAdmits: {{admits}}\nPresent the QR code at the entrance.",
  instagramCaption: "{{event}} — see you there! 🎟️ Ticket {{ticket}}",
};

function applyVars(tpl: string, ctx: { name: string; event: string; ticket: string; admits: number | string; role: string }) {
  return tpl
    .replace(/\{\{name\}\}/g, ctx.name)
    .replace(/\{\{event\}\}/g, ctx.event)
    .replace(/\{\{ticket\}\}/g, ctx.ticket)
    .replace(/\{\{admits\}\}/g, String(ctx.admits))
    .replace(/\{\{role\}\}/g, ctx.role);
}

type ShareLog = {
  id: string;
  attendee_id: string;
  channel: string;
  recipient: string | null;
  subject: string | null;
  status: string;
  error: string | null;
  attempts: number;
  last_attempt_at: string | null;
  created_at: string;
};

const BADGE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Space Grotesk', 'Segoe UI', sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 16px; }
  .badge { border: 2px solid #e5e5e5; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
  .badge h3 { font-size: 18px; margin: 8px 0 2px; }
  .badge p { font-size: 12px; color: #666; }
  .badge .code { font-family: monospace; font-size: 10px; color: #888; letter-spacing: 2px; margin: 4px 0; }
  .badge .role { display: inline-block; background: #f97316; color: #fff; font-size: 11px; padding: 2px 10px; border-radius: 99px; margin-top: 6px; }
  .badge .event { font-size: 10px; color: #999; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .badge svg { margin: 0 auto; }
  @media print { .grid { padding: 0; } .badge { border: 1px solid #ccc; } }
`;

function badgeHTML(a: Attendee, eventName: string, innerRef?: React.RefObject<HTMLDivElement>) {
  return (
    <div key={a.id} className="badge" ref={innerRef}>
      <QRCodeSVG value={a.ticket_id || a.id} size={90} level="M" includeMargin />
      <p className="code" style={{ fontFamily: "monospace", fontSize: "10px", color: "#888", letterSpacing: "2px", margin: "4px 0" }}>
        {a.ticket_id || a.id.slice(0, 12).toUpperCase()}
      </p>
      <h3>{a.name}</h3>
      <p>{a.email || a.phone || ""}</p>
      {a.role && <span className="role">{a.role}</span>}
      <span className="role" style={{ background: "#2563eb", marginLeft: "4px" }}>Admit {a.admits || 1}</span>
      <p className="event">{eventName}</p>
    </div>
  );
}

export default function BadgeGenerator({ eventId, attendees, eventName, onGenerateMissingIds }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const singleBadgeRef = useRef<HTMLDivElement>(null);
  const badgeCardRef = useRef<HTMLDivElement>(null);
  const bulkRenderRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [editing, setEditing] = useState<Attendee | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", admits: "1", email: "", phone: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Share templates (persisted per event)
  const tplKey = `badge_share_templates_${eventId}`;
  const [templates, setTemplates] = useState<ShareTemplates>(DEFAULT_TEMPLATES);
  const [showTemplates, setShowTemplates] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(tplKey);
      setTemplates(raw ? { ...DEFAULT_TEMPLATES, ...JSON.parse(raw) } : DEFAULT_TEMPLATES);
    } catch { setTemplates(DEFAULT_TEMPLATES); }
  }, [tplKey]);
  const saveTemplates = (next: ShareTemplates) => {
    setTemplates(next);
    try { localStorage.setItem(tplKey, JSON.stringify(next)); } catch {}
  };

  // Share-all (bulk email) state
  const [shareAllOpen, setShareAllOpen] = useState(false);
  const [shareAllProgress, setShareAllProgress] = useState<{ current: number; total: number; sent: number; failed: number } | null>(null);
  // Share-all recipient filter
  const [shareAllChannel, setShareAllChannel] = useState<"email" | "whatsapp" | "instagram">("email");
  const [shareAllFilter, setShareAllFilter] = useState({ requireEmail: true, requirePhone: false, excludeAlreadySent: false });

  // Per-attendee share preview (confirm before sending)
  const [sharePreview, setSharePreview] = useState<{
    channel: "email" | "whatsapp" | "instagram";
    attendee: Attendee;
    subject: string;
    message: string;
  } | null>(null);
  const [sendingPreview, setSendingPreview] = useState(false);

  // Delivery log
  const [logs, setLogs] = useState<ShareLog[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("badge_share_log")
      .select("id,attendee_id,channel,recipient,subject,status,error,attempts,last_attempt_at,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs((data as any) || []);
  }, [eventId]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  // Realtime updates for log
  useEffect(() => {
    if (!eventId) return;
    const ch = supabase
      .channel(`badge-share-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "badge_share_log", filter: `event_id=eq.${eventId}` }, () => fetchLogs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, fetchLogs]);

  const handleDownloadPNG = useCallback(async () => {
    if (!badgeCardRef.current || !selectedAttendee) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(badgeCardRef.current, { pixelRatio: 3, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `badge-${selectedAttendee.name.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Badge downloaded!");
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setDownloading(false);
    }
  }, [selectedAttendee]);

  // Bulk download all badges as ZIP of PNGs
  const handleBulkDownload = useCallback(async () => {
    if (attendees.length === 0) return;
    setBulkProgress({ current: 0, total: attendees.length });
    const zip = new JSZip();
    const folder = zip.folder(eventName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "badges")!;
    try {
      // Render each badge sequentially in the hidden bulk container
      for (let i = 0; i < attendees.length; i++) {
        const a = attendees[i];
        const node = document.getElementById(`bulk-badge-${a.id}`);
        if (!node) continue;
        const dataUrl = await toPng(node, { pixelRatio: 3, backgroundColor: "#ffffff" });
        const base64 = dataUrl.split(",")[1];
        const safeName = a.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        folder.file(`${safeName || "badge"}-${(a.ticket_id || a.id.slice(0, 6)).replace(/[^a-z0-9]+/gi, "")}.png`, base64, { base64: true });
        setBulkProgress({ current: i + 1, total: attendees.length });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `badges-${eventName.replace(/\s+/g, "-").toLowerCase() || "event"}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${attendees.length} badges`);
    } catch (err: any) {
      toast.error(`Bulk download failed: ${err.message || err}`);
    } finally {
      setBulkProgress(null);
    }
  }, [attendees, eventName]);

  // Generate a PNG data URL for the currently selected badge
  const renderBadgePngDataUrl = useCallback(async () => {
    if (!badgeCardRef.current) return null;
    return await toPng(badgeCardRef.current, { pixelRatio: 3, backgroundColor: "#ffffff" });
  }, []);

  // Build context object for variable substitution
  const ctxFor = useCallback((a: Attendee) => ({
    name: a.name,
    event: eventName,
    ticket: a.ticket_id || a.id.slice(0, 12).toUpperCase(),
    admits: a.admits || 1,
    role: a.role || "",
  }), [eventName]);

  // Render any attendee's hidden bulk badge into PNG (used by share-all)
  const renderAttendeeBadgePng = useCallback(async (a: Attendee): Promise<string | null> => {
    const node = document.getElementById(`bulk-badge-${a.id}`);
    if (!node) return null;
    return await toPng(node, { pixelRatio: 3, backgroundColor: "#ffffff" });
  }, []);

  // Send a single badge via the edge function (used by single-share AND share-all)
  const sendBadgeEmail = useCallback(async (a: Attendee, opts?: { logId?: string }) => {
    if (!a.email) return { ok: false, error: "No email on file" };
    const dataUrl = await renderAttendeeBadgePng(a) || await renderBadgePngDataUrl();
    if (!dataUrl) return { ok: false, error: "Failed to render badge image" };
    const pngBase64 = dataUrl.split(",")[1];
    const { data, error } = await supabase.functions.invoke("send-badge-email", {
      body: {
        attendeeId: a.id,
        attendeeEmail: a.email,
        attendeeName: a.name,
        eventId,
        eventName,
        subject: templates.emailSubject,
        message: templates.emailBody,
        pngBase64,
        ticketId: a.ticket_id || a.id.slice(0, 12).toUpperCase(),
        admits: a.admits || 1,
        role: a.role || "",
        logId: opts?.logId,
      },
    });
    if (error) return { ok: false, error: error.message || "Network error" };
    if (!(data as any)?.success) return { ok: false, error: (data as any)?.error || "Delivery failed" };
    return { ok: true };
  }, [eventId, eventName, templates, renderAttendeeBadgePng, renderBadgePngDataUrl]);

  // Share via Email — uses customized template + tracked delivery via edge function
  const handleShareEmail = useCallback(async () => {
    if (!selectedAttendee) return;
    const a = selectedAttendee;
    if (!a.email) { toast.error("No email on file. Add one via Edit."); return; }
    setSharePreview({
      channel: "email",
      attendee: a,
      subject: applyVars(templates.emailSubject, ctxFor(a)),
      message: applyVars(templates.emailBody, ctxFor(a)),
    });
  }, [selectedAttendee, templates, ctxFor]);

  // Share via WhatsApp — open preview first
  const handleShareWhatsApp = useCallback(async () => {
    if (!selectedAttendee) return;
    const a = selectedAttendee;
    setSharePreview({
      channel: "whatsapp",
      attendee: a,
      subject: "",
      message: applyVars(templates.whatsappBody, ctxFor(a)),
    });
  }, [selectedAttendee, templates, ctxFor]);

  const handleShareInstagram = useCallback(async () => {
    if (!selectedAttendee) return;
    const a = selectedAttendee;
    setSharePreview({
      channel: "instagram",
      attendee: a,
      subject: "",
      message: applyVars(templates.instagramCaption, ctxFor(a)),
    });
  }, [selectedAttendee, templates, ctxFor]);

  // Log a share attempt (used for WhatsApp/Instagram tracking)
  const logShareAttempt = useCallback(async (
    a: Attendee,
    channel: "whatsapp" | "instagram",
    recipient: string | null,
    status: "sent" | "failed",
    error: string | null,
    subject: string | null,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("badge_share_log").insert({
      event_id: eventId,
      attendee_id: a.id,
      user_id: user.id,
      channel,
      recipient,
      subject,
      status,
      error,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
    });
    fetchLogs();
  }, [eventId, fetchLogs]);

  // Confirm preview & dispatch
  const confirmSharePreview = useCallback(async () => {
    if (!sharePreview) return;
    setSendingPreview(true);
    const { channel, attendee: a, subject, message } = sharePreview;
    try {
      if (channel === "email") {
        const t = toast.loading(`Sending badge to ${a.email}…`);
        const dataUrl = await renderAttendeeBadgePng(a) || await renderBadgePngDataUrl();
        if (!dataUrl) { toast.error("Failed to render badge image", { id: t }); return; }
        const pngBase64 = dataUrl.split(",")[1];
        const { data, error } = await supabase.functions.invoke("send-badge-email", {
          body: {
            attendeeId: a.id, attendeeEmail: a.email, attendeeName: a.name,
            eventId, eventName, subject, message, pngBase64,
            ticketId: a.ticket_id || a.id.slice(0, 12).toUpperCase(),
            admits: a.admits || 1, role: a.role || "",
          },
        });
        if (error || !(data as any)?.success) {
          toast.error(`Failed: ${error?.message || (data as any)?.error || "Delivery failed"}`, { id: t });
        } else {
          toast.success(`Badge sent to ${a.email}`, { id: t });
        }
        fetchLogs();
      } else if (channel === "whatsapp") {
        // Render badge PNG → attempt to share file (so badge image is included)
        const dataUrl = await renderAttendeeBadgePng(a) || await renderBadgePngDataUrl();
        let shared = false;
        try {
          if (dataUrl && (navigator as any).canShare) {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `badge-${a.name}.png`, { type: "image/png" });
            if ((navigator as any).canShare({ files: [file] })) {
              await (navigator as any).share({ files: [file], title: `Badge — ${a.name}`, text: message });
              shared = true;
            }
          }
        } catch {}
        if (!shared) {
          // Always download the badge PNG so the user can attach it in WhatsApp
          if (dataUrl) {
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `badge-${a.name.replace(/\s+/g, "-")}.png`;
            link.click();
          }
          const phone = (a.phone || "").replace(/[^\d]/g, "");
          const url = phone
            ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;
          window.open(url, "_blank");
          toast.success("Badge downloaded — attach it in WhatsApp");
        }
        await logShareAttempt(a, "whatsapp", a.phone || null, "sent", null, null);
      } else if (channel === "instagram") {
        const dataUrl = await renderAttendeeBadgePng(a) || await renderBadgePngDataUrl();
        let shared = false;
        try {
          if (dataUrl && (navigator as any).canShare) {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `badge-${a.name}.png`, { type: "image/png" });
            if ((navigator as any).canShare({ files: [file] })) {
              await (navigator as any).share({ files: [file], title: `Badge — ${a.name}`, text: message });
              shared = true;
            }
          }
        } catch {}
        if (!shared) {
          try { await navigator.clipboard.writeText(message); } catch {}
          if (dataUrl) {
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `badge-${a.name.replace(/\s+/g, "-")}.png`;
            link.click();
          }
          window.open("https://www.instagram.com/", "_blank");
          toast.success("Badge downloaded & caption copied");
        }
        await logShareAttempt(a, "instagram", null, "sent", null, null);
      }
      setSharePreview(null);
    } catch (err: any) {
      toast.error(`Share failed: ${err.message || err}`);
      if (sharePreview.channel !== "email") {
        await logShareAttempt(sharePreview.attendee, sharePreview.channel, null, "failed", String(err?.message || err), null);
      }
    } finally {
      setSendingPreview(false);
    }
  }, [sharePreview, eventId, eventName, renderAttendeeBadgePng, renderBadgePngDataUrl, fetchLogs, logShareAttempt]);

  // Compute filtered targets for "Share All"
  const shareAllTargets = useCallback(() => {
    return attendees.filter((a) => {
      if (shareAllFilter.requireEmail && !a.email) return false;
      if (shareAllFilter.requirePhone && !a.phone) return false;
      if (shareAllChannel === "email" && !a.email) return false;
      if (shareAllChannel === "whatsapp" && !a.phone) return false;
      return true;
    });
  }, [attendees, shareAllFilter, shareAllChannel]);

  // SHARE ALL — bulk send via selected channel with recipient filter
  const handleShareAllConfirm = useCallback(async () => {
    const targets = shareAllTargets();
    if (targets.length === 0) { toast.error("No attendees match the selected filter."); return; }
    setShareAllOpen(false);
    setShareAllProgress({ current: 0, total: targets.length, sent: 0, failed: 0 });
    let sent = 0, failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const a = targets[i];
      try {
        if (shareAllChannel === "email") {
          const res = await sendBadgeEmail(a);
          if (res.ok) sent++; else failed++;
        } else if (shareAllChannel === "whatsapp") {
          // Open WhatsApp link per attendee (user must attach badge PNG manually — so we also download it)
          const dataUrl = await renderAttendeeBadgePng(a);
          if (dataUrl) {
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `badge-${a.name.replace(/\s+/g, "-")}.png`;
            link.click();
          }
          const phone = (a.phone || "").replace(/[^\d]/g, "");
          const message = applyVars(templates.whatsappBody, ctxFor(a));
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
          await logShareAttempt(a, "whatsapp", a.phone || null, "sent", null, null);
          sent++;
        } else if (shareAllChannel === "instagram") {
          const dataUrl = await renderAttendeeBadgePng(a);
          if (dataUrl) {
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `badge-${a.name.replace(/\s+/g, "-")}.png`;
            link.click();
          }
          await logShareAttempt(a, "instagram", null, "sent", null, null);
          sent++;
        }
      } catch (err: any) {
        failed++;
      }
      setShareAllProgress({ current: i + 1, total: targets.length, sent, failed });
    }
    toast[failed === 0 ? "success" : "warning"](`Bulk send complete: ${sent} sent, ${failed} failed`);
    setShareAllProgress(null);
    fetchLogs();
    setShowLog(true);
  }, [shareAllTargets, shareAllChannel, sendBadgeEmail, renderAttendeeBadgePng, templates, ctxFor, logShareAttempt, fetchLogs]);

  // Retry a failed log entry
  const handleRetry = useCallback(async (log: ShareLog) => {
    const a = attendees.find((x) => x.id === log.attendee_id);
    if (!a) { toast.error("Attendee no longer exists"); return; }
    if (!a.email) { toast.error("Attendee has no email — edit to add one"); return; }
    setRetrying(log.id);
    const res = await sendBadgeEmail(a, { logId: log.id });
    if (res.ok) toast.success(`Resent to ${a.email}`);
    else toast.error(`Retry failed: ${res.error}`);
    setRetrying(null);
    fetchLogs();
  }, [attendees, sendBadgeEmail, fetchLogs]);

  // Open edit dialog
  const openEdit = (a: Attendee) => {
    setEditing(a);
    setEditForm({
      name: a.name,
      role: a.role || "",
      admits: String(a.admits || 1),
      email: a.email || "",
      phone: a.phone || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) { toast.error("Name is required"); return; }
    setSavingEdit(true);
    const admitsVal = parseInt(editForm.admits, 10);
    // NOTE: We intentionally do NOT update ticket_id — the QR code stays identical across edits.
    const { error } = await supabase
      .from("attendees")
      .update({
        name: editForm.name.trim(),
        role: editForm.role.trim() || "attendee",
        admits: isNaN(admitsVal) || admitsVal < 1 ? 1 : admitsVal,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
      })
      .eq("id", editing.id);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
    } else {
      toast.success("Attendee updated — QR code unchanged");
      // If the edited attendee is currently selected in preview, refresh local view
      if (selectedAttendee?.id === editing.id) {
        setSelectedAttendee({ ...selectedAttendee, name: editForm.name.trim(), role: editForm.role.trim() || "attendee", admits: isNaN(admitsVal) || admitsVal < 1 ? 1 : admitsVal, email: editForm.email.trim() || null, phone: editForm.phone.trim() || null });
      }
      setEditing(null);
    }
    setSavingEdit(false);
  };

  const missingCount = attendees.filter((a) => !a.ticket_id).length;

  const filtered = search.trim()
    ? attendees.filter((a) => {
        const q = search.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.phone?.includes(q) || a.ticket_id?.toLowerCase().includes(q);
      })
    : attendees;

  const openPrintWindow = (html: string, title: string, grid = true) => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Pop-up blocked — please allow pop-ups"); return; }
    w.document.write(`
      <html><head><title>${title}</title>
      <style>${BADGE_STYLES}${!grid ? ".badge { max-width: 360px; margin: 40px auto; }" : ""}</style></head><body>
      ${grid ? `<div class="grid">${html}</div>` : html}
      </body></html>
    `);
    w.document.close();
    w.onload = () => { w.print(); };
  };

  const handlePrintAll = () => {
    if (!printRef.current) return;
    openPrintWindow(printRef.current.innerHTML, `Badges — ${eventName}`);
  };

  const handlePrintSingle = () => {
    if (!singleBadgeRef.current) return;
    openPrintWindow(singleBadgeRef.current.outerHTML, `Badge — ${selectedAttendee?.name || ""}`, false);
  };

  if (attendees.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Upload attendees first to generate QR badges.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{attendees.length} badge(s) ready</p>
          {missingCount > 0 && (
            <p className="text-xs text-destructive">{missingCount} attendee(s) missing ticket IDs</p>
          )}
        </div>
        <div className="flex gap-2">
          {missingCount > 0 && onGenerateMissingIds && (
            <Button variant="outline" size="sm" onClick={onGenerateMissingIds}>
              <Sparkles className="h-4 w-4 mr-1" /> Generate Missing IDs
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
            <Settings2 className="h-4 w-4 mr-1" /> Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareAllOpen(true)}
            disabled={!!shareAllProgress}
            className="text-primary"
          >
            {shareAllProgress ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {shareAllProgress.current}/{shareAllProgress.total}</>
            ) : (
              <><Send className="h-4 w-4 mr-1" /> Share All Badges</>
            )}
          </Button>
          <Button variant="outline" onClick={handleBulkDownload} disabled={!!bulkProgress}>
            {bulkProgress ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {bulkProgress.current}/{bulkProgress.total}</>
            ) : (
              <><Package className="h-4 w-4 mr-1" /> Download All (ZIP)</>
            )}
          </Button>
          <Button onClick={handlePrintAll} className="gradient-sunset text-primary-foreground">
            <Printer className="h-4 w-4 mr-1" /> Print All Badges
          </Button>
        </div>
      </div>

      {shareAllProgress && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="flex-1">
              Sending badges… {shareAllProgress.current}/{shareAllProgress.total}
              <span className="text-emerald-600 ml-2">✓ {shareAllProgress.sent}</span>
              <span className="text-destructive ml-2">✗ {shareAllProgress.failed}</span>
            </span>
          </CardContent>
        </Card>
      )}

      {/* Delivery status panel */}
      <Card className="border-border">
        <CardContent className="p-3">
          <button
            onClick={() => { setShowLog((v) => !v); if (!showLog) fetchLogs(); }}
            className="flex items-center justify-between w-full text-sm font-medium text-foreground"
          >
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Email Delivery Status
              {logs.length > 0 && (
                <>
                  <Badge variant="secondary" className="text-[10px]">{logs.filter((l) => l.status === "sent").length} sent</Badge>
                  {logs.filter((l) => l.status === "failed").length > 0 && (
                    <Badge variant="destructive" className="text-[10px]">{logs.filter((l) => l.status === "failed").length} failed</Badge>
                  )}
                </>
              )}
            </span>
            {showLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showLog && (
            <div className="mt-3 max-h-80 overflow-y-auto space-y-2">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No badge emails sent yet.</p>
              ) : (
                logs.map((log) => {
                  const att = attendees.find((x) => x.id === log.attendee_id);
                  return (
                    <div key={log.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40 text-xs">
                      {log.status === "sent" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : log.status === "failed" ? (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {att?.name || "Unknown"} <span className="text-muted-foreground font-normal">· {log.recipient}</span>
                        </p>
                        <p className="text-muted-foreground truncate">
                          {log.status === "failed" ? (
                            <span className="text-destructive">{log.error || "Delivery failed"}</span>
                          ) : (
                            log.subject || `Sent · ${log.last_attempt_at ? new Date(log.last_attempt_at).toLocaleString() : ""}`
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Attempts: {log.attempts}</p>
                      </div>
                      {log.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0"
                          onClick={() => handleRetry(log)}
                          disabled={retrying === log.id}
                        >
                          {retrying === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" /> Retry</>}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certificate download link for attendees */}
      <CertificateLinkCard />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search attendee by name, email, phone, or ticket ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.slice(0, search ? 50 : 6).map((a) => (
          <Card
            key={a.id}
            className="border-border text-center cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
            onClick={() => setSelectedAttendee(a)}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <QRCodeSVG value={a.ticket_id || a.id} size={100} level="M" includeMargin />
              <p className="font-mono text-[11px] text-muted-foreground tracking-wider bg-muted px-2 py-0.5 rounded">
                {a.ticket_id || a.id.slice(0, 12).toUpperCase()}
              </p>
              <p className="font-display font-bold text-foreground text-sm">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.email || a.phone || ""}</p>
              {a.role && (
                <Badge className="gradient-sunset text-primary-foreground text-xs border-transparent">
                  {a.role}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                Admit {a.admits || 1}
              </Badge>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{eventName}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => { e.stopPropagation(); openEdit(a); }}
              >
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!search && attendees.length > 6 && (
        <p className="text-xs text-muted-foreground text-center">
          + {attendees.length - 6} more — search or click "Print All Badges"
        </p>
      )}
      {search && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No attendees match "{search}"</p>
      )}
      {search && filtered.length > 50 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing 50 of {filtered.length} results — refine your search
        </p>
      )}

      {/* Single badge preview modal */}
      <Dialog open={!!selectedAttendee} onOpenChange={(open) => !open && setSelectedAttendee(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Badge Preview</DialogTitle>
          </DialogHeader>
          {selectedAttendee && (
            <div className="flex flex-col items-center gap-4">
              <Card className="border-border w-full max-w-xs text-center" ref={badgeCardRef}>
                <CardContent className="p-6 flex flex-col items-center gap-3">
                  <QRCodeSVG value={selectedAttendee.ticket_id || selectedAttendee.id} size={140} level="M" includeMargin />
                  <p className="font-mono text-xs text-muted-foreground tracking-widest bg-muted px-3 py-1 rounded">
                    {selectedAttendee.ticket_id || selectedAttendee.id.slice(0, 12).toUpperCase()}
                  </p>
                   <p className="font-display font-bold text-foreground text-lg">{selectedAttendee.name}</p>
                   <p className="text-sm text-muted-foreground">{selectedAttendee.email || selectedAttendee.phone || ""}</p>
                   {selectedAttendee.role && (
                     <Badge className="gradient-sunset text-primary-foreground text-sm border-transparent">
                       {selectedAttendee.role}
                     </Badge>
                   )}
                   <Badge variant="secondary" className="text-sm">
                     Admit {selectedAttendee.admits || 1}
                   </Badge>
                   <p className="text-xs text-muted-foreground uppercase tracking-widest">{eventName}</p>
                </CardContent>
              </Card>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedAttendee(null)}>
                  Close
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleDownloadPNG} disabled={downloading}>
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  PNG
                </Button>
                <Button className="flex-1 gradient-sunset text-primary-foreground" onClick={handlePrintSingle}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2 w-full">
                <Button variant="outline" size="sm" onClick={handleShareEmail} title="Share via Email">
                  <Mail className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleShareWhatsApp} title="Share via WhatsApp" className="text-emerald-600">
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleShareInstagram} title="Share via Instagram" className="text-pink-600">
                  <Instagram className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(selectedAttendee)} title="Edit attendee">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit attendee dialog — QR (ticket_id) stays the same */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Attendee</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <span className="font-mono tracking-widest">{editing.ticket_id || editing.id.slice(0, 12).toUpperCase()}</span>
                <p className="mt-1">QR code & ticket ID will not change.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Role</Label>
                  <Input value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))} placeholder="e.g. VIP, Speaker" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Admit(s)</Label>
                  <Input type="number" min="1" value={editForm.admits} onChange={(e) => setEditForm((p) => ({ ...p, admits: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Email</Label>
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="flex-1 gradient-sunset text-primary-foreground" onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving...</> : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share message templates dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Customize Share Messages</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Use variables: <code className="bg-muted px-1 rounded">{`{{name}}`}</code>{" "}
              <code className="bg-muted px-1 rounded">{`{{event}}`}</code>{" "}
              <code className="bg-muted px-1 rounded">{`{{ticket}}`}</code>{" "}
              <code className="bg-muted px-1 rounded">{`{{admits}}`}</code>{" "}
              <code className="bg-muted px-1 rounded">{`{{role}}`}</code>
            </p>

            <div className="space-y-1">
              <Label className="text-sm flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email Subject</Label>
              <Input
                value={templates.emailSubject}
                onChange={(e) => saveTemplates({ ...templates, emailSubject: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Email Body</Label>
              <Textarea
                rows={6}
                value={templates.emailBody}
                onChange={(e) => saveTemplates({ ...templates, emailBody: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm flex items-center gap-1 text-emerald-600"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp Message</Label>
              <Textarea
                rows={4}
                value={templates.whatsappBody}
                onChange={(e) => saveTemplates({ ...templates, whatsappBody: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm flex items-center gap-1 text-pink-600"><Instagram className="h-3.5 w-3.5" /> Instagram Caption</Label>
              <Textarea
                rows={3}
                value={templates.instagramCaption}
                onChange={(e) => saveTemplates({ ...templates, instagramCaption: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => saveTemplates(DEFAULT_TEMPLATES)}>
                Reset to defaults
              </Button>
              <Button className="flex-1 gradient-sunset text-primary-foreground" onClick={() => { toast.success("Templates saved"); setShowTemplates(false); }}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden: single badge for print */}
      <div className="hidden">
        {selectedAttendee && (
          <div ref={singleBadgeRef}>
            {badgeHTML(selectedAttendee, eventName)}
          </div>
        )}
      </div>

      {/* Hidden: all badges for bulk print */}
      <div ref={printRef} className="hidden">
        {attendees.map((a) => badgeHTML(a, eventName))}
      </div>

      {/* Hidden: rendered React badges used by bulk PNG export */}
      <div ref={bulkRenderRef} style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}>
        {attendees.map((a) => (
          <div
            key={`bulk-${a.id}`}
            id={`bulk-badge-${a.id}`}
            style={{
              width: 320,
              padding: 24,
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              textAlign: "center",
              fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
              marginBottom: 12,
            }}
          >
            <QRCodeSVG value={a.ticket_id || a.id} size={140} level="M" includeMargin />
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#666", letterSpacing: 2, margin: "8px 0" }}>
              {a.ticket_id || a.id.slice(0, 12).toUpperCase()}
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, margin: "4px 0", color: "#111" }}>{a.name}</p>
            <p style={{ fontSize: 12, color: "#666" }}>{a.email || a.phone || ""}</p>
            {a.role && (
              <span style={{ display: "inline-block", background: "#f97316", color: "#fff", fontSize: 11, padding: "2px 10px", borderRadius: 99, marginTop: 6 }}>{a.role}</span>
            )}
            <span style={{ display: "inline-block", background: "#2563eb", color: "#fff", fontSize: 11, padding: "2px 10px", borderRadius: 99, marginTop: 6, marginLeft: 4 }}>Admit {a.admits || 1}</span>
            <p style={{ fontSize: 10, color: "#999", marginTop: 8, textTransform: "uppercase", letterSpacing: 1 }}>{eventName}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificateLinkCard() {
  const [copied, setCopied] = useState(false);
  const certUrl = `${window.location.origin}/certificate`;

  const handleCopy = () => {
    navigator.clipboard.writeText(certUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border bg-muted/30">
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 text-primary">
          <Link2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Certificate Download Page</p>
            <p className="text-xs text-muted-foreground">Share this link so attendees can download their certificates using their ticket ID</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 ml-auto" onClick={handleCopy}>
          {copied ? <><Check className="h-3.5 w-3.5 mr-1" /> Copied!</> : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy Link</>}
        </Button>
      </CardContent>
    </Card>
  );
}
