import { useState, useRef, useCallback, useEffect } from "react";
import { Award, Upload, Image, Move, Loader2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  eventId: string;
  eventName: string;
}

interface NamePosition {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export default function CertificateSettings({ eventId, eventName }: Props) {
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [namePosition, setNamePosition] = useState<NamePosition>({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);

  // Load saved settings from localStorage (per event)
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

                  {/* Template preview with draggable name */}
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
                    {/* Draggable name indicator */}
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
    </div>
  );
}
