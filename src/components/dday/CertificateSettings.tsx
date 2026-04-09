import { useState, useRef, useCallback, useEffect } from "react";
import { Award, Upload, Image, Move, Loader2, Eye, Send, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Attendee } from "@/hooks/useAttendees";

interface Props {
  eventId: string;
  eventName: string;
  eventDate?: string | null;
  eventLocation?: string | null;
  attendees?: Attendee[];
}

interface NamePosition {
  x: number;
  y: number;
}

export default function CertificateSettings({ eventId, eventName, eventDate, eventLocation, attendees = [] }: Props) {
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [namePosition, setNamePosition] = useState<NamePosition>({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);

  // Bulk send state
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, total: 0 });

  const checkedInWithEmail = attendees.filter((a) => a.checked_in && a.email && !a.certificate_sent_at);
  const alreadySent = attendees.filter((a) => a.certificate_sent_at);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cert_settings_${eventId}`);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.mode) setMode(s.mode);
        if (s.templateUrl) setTemplateUrl(s.templateUrl);
        if (s.namePosition) setNamePosition(s.namePosition);
      }
    } catch {}
  }, [eventId]);

  const saveSettings = useCallback(() => {
    const settings = { mode, templateUrl, namePosition };
    localStorage.setItem(`cert_settings_${eventId}`, JSON.stringify(settings));
    setSaved(true);
    toast.success("Certificate settings saved");
    setTimeout(() => setSaved(false), 2000);
  }, [mode, templateUrl, namePosition, eventId]);

  const handleTemplateUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `templates/${eventId}/cert-template.${ext}`;

    const { error } = await supabase.storage
      .from("certificates")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (error) {
      toast.error("Failed to upload template");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("certificates").getPublicUrl(path);
    setTemplateUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Template uploaded");
  };

  const handleDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!dragging || !imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));
      setNamePosition({ x, y });
    },
    [dragging]
  );

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    const stop = () => setDragging(false);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  const handleBulkSend = async () => {
    if (checkedInWithEmail.length === 0) {
      toast.info("No checked-in attendees with email pending certificates.");
      return;
    }

    setBulkSending(true);
    setBulkProgress({ sent: 0, total: checkedInWithEmail.length });

    let successCount = 0;
    let failCount = 0;

    for (const attendee of checkedInWithEmail) {
      try {
        const certId = `CERT-${attendee.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
        const { error } = await supabase.functions.invoke("send-certificate", {
          body: {
            attendeeId: attendee.id,
            attendeeName: attendee.name,
            attendeeEmail: attendee.email,
            eventName,
            eventDate: eventDate || null,
            eventLocation: eventLocation || null,
            certificateId: certId,
            certMode: mode,
            customTemplateUrl: mode === "custom" ? templateUrl : null,
            namePosition: mode === "custom" ? namePosition : undefined,
          },
        });

        if (error) {
          failCount++;
        } else {
          successCount++;
        }
      } catch {
        failCount++;
      }

      setBulkProgress((prev) => ({ ...prev, sent: prev.sent + 1 }));

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }

    setBulkSending(false);
    if (failCount === 0) {
      toast.success(`All ${successCount} certificates sent successfully!`);
    } else {
      toast.warning(`${successCount} sent, ${failCount} failed. You can retry for the remaining.`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Certificate Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "auto" | "custom")}>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
              <RadioGroupItem value="auto" id="cert-auto" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="cert-auto" className="font-medium text-foreground cursor-pointer">
                  Auto-Generated Certificate
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Professional certificate auto-designed with event details, attendee name, and unique ID.
                  Uses an elegant African-inspired design.
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">Default</Badge>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
              <RadioGroupItem value="custom" id="cert-custom" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="cert-custom" className="font-medium text-foreground cursor-pointer">
                  Custom Template
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload your own certificate design (PNG/JPG). Drag to position where the attendee name appears.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">Custom</Badge>
            </div>
          </RadioGroup>

          {/* Custom template upload + positioning */}
          {mode === "custom" && (
            <div className="space-y-4 pt-2">
              {!templateUrl ? (
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleTemplateUpload(file);
                    };
                    input.click();
                  }}
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                  ) : (
                    <>
                      <Image className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">Upload Certificate Template</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG or JPG recommended (landscape A4)</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1">
                      <Move className="h-4 w-4 text-primary" />
                      Drag the name label to position it
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTemplateUrl(null);
                        setNamePosition({ x: 50, y: 50 });
                      }}
                    >
                      Change Template
                    </Button>
                  </div>

                  <div
                    ref={imgRef}
                    className="relative border border-border rounded-lg overflow-hidden cursor-crosshair select-none"
                    onMouseMove={handleDrag}
                    onTouchMove={handleDrag}
                  >
                    <img
                      src={templateUrl}
                      alt="Certificate template"
                      className="w-full h-auto"
                      draggable={false}
                    />
                    <div
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                      style={{ left: `${namePosition.x}%`, top: `${namePosition.y}%` }}
                      onMouseDown={handleDragStart}
                      onTouchStart={handleDragStart}
                    >
                      <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-md shadow-lg cursor-grab active:cursor-grabbing whitespace-nowrap">
                        <p className="text-sm font-bold">Attendee Name</p>
                        <p className="text-[10px] opacity-80 text-center">← drag to reposition →</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Position: {Math.round(namePosition.x)}% from left, {Math.round(namePosition.y)}% from top
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Auto-generated preview */}
          {mode === "auto" && (
            <div className="border border-border rounded-lg p-4 bg-[hsl(30,25%,95%)]">
              <div className="aspect-[1.414/1] border border-[hsl(var(--sunset-orange)/0.3)] rounded bg-[hsl(30,20%,97%)] flex flex-col items-center justify-center gap-2 text-center p-4">
                <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--sunset-orange))] font-bold">Certificate of Attendance</p>
                <div className="w-16 h-[1px] bg-[hsl(var(--sunset-orange)/0.5)]" />
                <p className="text-xs text-muted-foreground">This is to certify that</p>
                <p className="text-sm font-bold text-foreground">John Doe</p>
                <p className="text-xs text-muted-foreground">has attended</p>
                <p className="text-xs font-semibold text-[hsl(var(--sunset-orange))]">{eventName}</p>
                <p className="text-[9px] text-muted-foreground mt-2">CERT-XXXXXXXX</p>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                <Eye className="h-3 w-3" /> Auto-generated design preview
              </p>
            </div>
          )}

          <Button onClick={saveSettings} className="w-full gradient-sunset text-primary-foreground">
            {saved ? "✓ Saved" : "Save Certificate Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk Certificate Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Bulk Certificate Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-lg font-display font-bold text-foreground">
                {attendees.filter((a) => a.checked_in).length}
              </p>
              <p className="text-xs text-muted-foreground">Checked In</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-lg font-display font-bold text-[hsl(var(--earth-green))]">
                {alreadySent.length}
              </p>
              <p className="text-xs text-muted-foreground">Certs Sent</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-lg font-display font-bold text-primary">
                {checkedInWithEmail.length}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>

          {checkedInWithEmail.length === 0 && !bulkSending ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              {attendees.filter((a) => a.checked_in).length === 0
                ? "No attendees have been checked in yet."
                : alreadySent.length > 0
                ? "All checked-in attendees with emails have received their certificates."
                : "No checked-in attendees have email addresses. Certificates require email."}
            </p>
          ) : null}

          {bulkSending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Sending certificates…</span>
                <span>{bulkProgress.sent}/{bulkProgress.total}</span>
              </div>
              <Progress
                value={bulkProgress.total > 0 ? (bulkProgress.sent / bulkProgress.total) * 100 : 0}
                className="h-2"
              />
            </div>
          )}

          <Button
            onClick={handleBulkSend}
            disabled={bulkSending || checkedInWithEmail.length === 0}
            className="w-full gradient-sunset text-primary-foreground"
            size="lg"
          >
            {bulkSending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending {bulkProgress.sent}/{bulkProgress.total}…</>
            ) : (
              <><Users className="h-4 w-4 mr-2" /> Send Certificates to {checkedInWithEmail.length} Attendee(s)</>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Certificates will be generated using the {mode === "custom" ? "custom template" : "auto-generated design"} and emailed to each attendee.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
