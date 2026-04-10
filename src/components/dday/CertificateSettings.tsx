import { useState, useRef, useCallback, useEffect } from "react";
import { Award, Upload, Image, Move, Loader2, Eye, Send, Users, Type, ZoomIn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
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

interface NameStyle {
  fontSize: number;
  color: string;
  fontWeight: string;
}

export default function CertificateSettings({ eventId, eventName, eventDate, eventLocation, attendees = [] }: Props) {
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [namePosition, setNamePosition] = useState<NamePosition>({ x: 50, y: 50 });
  const [nameStyle, setNameStyle] = useState<NameStyle>({ fontSize: 28, color: "#1a2040", fontWeight: "bold" });
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewName, setPreviewName] = useState("John Doe");

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
        if (s.nameStyle) setNameStyle(s.nameStyle);
      }
    } catch {}
  }, [eventId]);

  const saveSettings = useCallback(() => {
    const settings = { mode, templateUrl, namePosition, nameStyle };
    localStorage.setItem(`cert_settings_${eventId}`, JSON.stringify(settings));
    setSaved(true);
    toast.success("Certificate settings saved");
    setTimeout(() => setSaved(false), 2000);
  }, [mode, templateUrl, namePosition, nameStyle, eventId]);

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
            nameStyle: mode === "custom" ? nameStyle : undefined,
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
                  Upload your own certificate design. Position the name text box exactly where you want it on the template.
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1">
                      <Move className="h-4 w-4 text-primary" />
                      Drag the name box to position it
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

                  {/* Template with draggable name text box */}
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
                    {/* Draggable name text box */}
                    <div
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                      style={{ left: `${namePosition.x}%`, top: `${namePosition.y}%` }}
                      onMouseDown={handleDragStart}
                      onTouchStart={handleDragStart}
                    >
                      <div
                        className="border-2 border-dashed border-primary bg-primary/10 px-6 py-3 rounded cursor-grab active:cursor-grabbing whitespace-nowrap backdrop-blur-sm"
                        style={{
                          fontSize: `${Math.max(10, nameStyle.fontSize * 0.5)}px`,
                          color: nameStyle.color,
                          fontWeight: nameStyle.fontWeight,
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Type className="h-3 w-3 text-primary shrink-0" />
                          <span>Attendee Name Here</span>
                        </div>
                        <p className="text-[9px] text-primary text-center mt-0.5 font-normal">↕ drag to reposition ↔</p>
                      </div>
                    </div>
                  </div>

                  {/* Name style controls */}
                  <div className="bg-muted rounded-lg p-3 space-y-3">
                    <p className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Type className="h-3.5 w-3.5 text-primary" /> Name Text Style
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Font Size: {nameStyle.fontSize}px</Label>
                        <Slider
                          value={[nameStyle.fontSize]}
                          onValueChange={([v]) => setNameStyle((s) => ({ ...s, fontSize: v }))}
                          min={14}
                          max={72}
                          step={1}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Text Color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={nameStyle.color}
                            onChange={(e) => setNameStyle((s) => ({ ...s, color: e.target.value }))}
                            className="h-8 w-8 rounded border border-border cursor-pointer"
                          />
                          <span className="text-xs text-muted-foreground font-mono">{nameStyle.color}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(["normal", "bold"] as const).map((w) => (
                        <Button
                          key={w}
                          variant={nameStyle.fontWeight === w ? "default" : "outline"}
                          size="sm"
                          className="text-xs flex-1"
                          onClick={() => setNameStyle((s) => ({ ...s, fontWeight: w }))}
                        >
                          {w === "bold" ? "Bold" : "Regular"}
                        </Button>
                      ))}
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
            <div className="space-y-3">
              <div className="border border-border rounded-lg overflow-hidden bg-gradient-to-br from-[hsl(30,30%,97%)] to-[hsl(35,25%,93%)]">
                <div className="aspect-[1.414/1] relative flex flex-col items-center justify-center gap-1.5 p-6 text-center">
                  {/* Decorative border */}
                  <div className="absolute inset-3 border-2 border-[hsl(var(--sunset-orange)/0.2)] rounded-sm" />
                  <div className="absolute inset-4 border border-[hsl(var(--sunset-orange)/0.1)] rounded-sm" />

                  {/* Corner accents */}
                  <div className="absolute top-5 left-5 w-6 h-6 border-t-2 border-l-2 border-[hsl(var(--sunset-orange)/0.5)]" />
                  <div className="absolute top-5 right-5 w-6 h-6 border-t-2 border-r-2 border-[hsl(var(--sunset-orange)/0.5)]" />
                  <div className="absolute bottom-5 left-5 w-6 h-6 border-b-2 border-l-2 border-[hsl(var(--sunset-orange)/0.5)]" />
                  <div className="absolute bottom-5 right-5 w-6 h-6 border-b-2 border-r-2 border-[hsl(var(--sunset-orange)/0.5)]" />

                  <Award className="h-6 w-6 text-[hsl(var(--sunset-orange))] mb-1" />
                  <p className="text-[9px] uppercase tracking-[0.25em] text-[hsl(var(--sunset-orange))] font-bold">Certificate of Attendance</p>
                  <div className="w-12 h-[1px] bg-[hsl(var(--sunset-orange)/0.4)] my-1" />
                  <p className="text-[8px] text-muted-foreground">This is to certify that</p>
                  <p className="text-sm font-bold text-foreground font-display">{previewName}</p>
                  <p className="text-[8px] text-muted-foreground">has successfully attended</p>
                  <p className="text-[10px] font-semibold text-[hsl(var(--sunset-orange))]">{eventName || "Event Name"}</p>
                  {(eventDate || eventLocation) && (
                    <p className="text-[7px] text-muted-foreground mt-0.5">
                      {[eventDate, eventLocation].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-4">
                    <div className="text-center">
                      <div className="w-12 h-[1px] bg-muted-foreground/30" />
                      <p className="text-[6px] text-muted-foreground mt-0.5">Organizer</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-[1px] bg-muted-foreground/30" />
                      <p className="text-[6px] text-muted-foreground mt-0.5">Date</p>
                    </div>
                  </div>
                  <p className="text-[7px] text-muted-foreground/60 mt-1 font-mono">CERT-XXXXXXXX</p>
                </div>
              </div>

              {/* Preview name input */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Preview with a name…"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  className="text-sm"
                />
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                  <ZoomIn className="h-4 w-4 mr-1" /> Full Preview
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Eye className="h-3 w-3" /> Type a name above to preview how the certificate looks
              </p>
            </div>
          )}

          {/* Full-size preview dialog */}
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display">Certificate Preview</DialogTitle>
              </DialogHeader>
              {mode === "auto" ? (
                <div className="bg-gradient-to-br from-[hsl(30,30%,97%)] to-[hsl(35,25%,93%)] rounded-lg overflow-hidden">
                  <div className="aspect-[1.414/1] relative flex flex-col items-center justify-center gap-3 p-10 text-center">
                    <div className="absolute inset-5 border-2 border-[hsl(var(--sunset-orange)/0.2)] rounded" />
                    <div className="absolute inset-7 border border-[hsl(var(--sunset-orange)/0.1)] rounded" />
                    <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-[hsl(var(--sunset-orange)/0.5)]" />
                    <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-[hsl(var(--sunset-orange)/0.5)]" />
                    <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-[hsl(var(--sunset-orange)/0.5)]" />
                    <div className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-[hsl(var(--sunset-orange)/0.5)]" />
                    <Award className="h-10 w-10 text-[hsl(var(--sunset-orange))]" />
                    <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--sunset-orange))] font-bold">Certificate of Attendance</p>
                    <div className="w-20 h-[1px] bg-[hsl(var(--sunset-orange)/0.4)]" />
                    <p className="text-sm text-muted-foreground">This is to certify that</p>
                    <p className="text-2xl font-bold text-foreground font-display">{previewName}</p>
                    <p className="text-sm text-muted-foreground">has successfully attended</p>
                    <p className="text-base font-semibold text-[hsl(var(--sunset-orange))]">{eventName || "Event Name"}</p>
                    {(eventDate || eventLocation) && (
                      <p className="text-xs text-muted-foreground">{[eventDate, eventLocation].filter(Boolean).join(" · ")}</p>
                    )}
                    <div className="mt-4 flex items-center gap-8">
                      <div className="text-center">
                        <div className="w-20 h-[1px] bg-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground mt-1">Organizer</p>
                      </div>
                      <div className="text-center">
                        <div className="w-20 h-[1px] bg-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground mt-1">Date</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-2 font-mono">CERT-XXXXXXXX</p>
                  </div>
                </div>
              ) : templateUrl ? (
                <div className="relative rounded-lg overflow-hidden">
                  <img src={templateUrl} alt="Certificate preview" className="w-full h-auto" />
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${namePosition.x}%`,
                      top: `${namePosition.y}%`,
                      fontSize: `${nameStyle.fontSize}px`,
                      color: nameStyle.color,
                      fontWeight: nameStyle.fontWeight,
                    }}
                  >
                    {previewName}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No template uploaded yet</p>
              )}
            </DialogContent>
          </Dialog>

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
