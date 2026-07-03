import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, CalendarIcon, Loader2, ImagePlus, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const countries = ["Nigeria", "Kenya", "South Africa", "Ghana", "Tanzania", "Rwanda", "Ethiopia", "Uganda", "Senegal", "Egypt"];
const eventTypes = [
  { value: "conference", label: "Conference" },
  { value: "workshop", label: "Workshop" },
  { value: "festival", label: "Festival" },
  { value: "webinar", label: "Webinar" },
  { value: "hackathon", label: "Hackathon" },
  { value: "meetup", label: "Meetup" },
];

interface NewEventDialogProps {
  onCreated?: () => void;
  children?: React.ReactNode;
}

export default function NewEventDialog({ onCreated, children }: NewEventDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState<Date>();
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [eventType, setEventType] = useState("conference");
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoProgress, setLogoProgress] = useState(0);
  // Fit controls
  const [logoFit, setLogoFit] = useState<"contain" | "cover">("contain");
  const [logoZoom, setLogoZoom] = useState<number>(1); // 0.6 – 1.4
  const [logoBg, setLogoBg] = useState<"white" | "transparent">("white");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_LOGO = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];

  // Revoke the preview object URL whenever it changes or on unmount to avoid leaks.
  useEffect(() => {
    return () => { if (logoPreview) URL.revokeObjectURL(logoPreview); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoPreview]);

  const handlePickLogo = (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_LOGO.includes(file.type)) {
      toast.error(`Unsupported file type${file.type ? ` (${file.type})` : ""}. Use PNG, JPG, WebP, or SVG.`);
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(`Logo is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum is 2MB.`);
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }
    setLogoFile(file);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
    setLogoZoom(1);
    setLogoFit("contain");
    setLogoBg("white");
  };

  const clearLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const resetForm = () => {
    setName("");
    setDate(undefined);
    setCity("");
    setCountry("");
    setEventType("conference");
    clearLogo();
    setLogoProgress(0);
  };

  /**
   * Normalize the uploaded raster logo to a square 512×512 PNG using the chosen
   * fit/zoom/background. This guarantees the same crisp render inside the QR
   * excavation area on every badge size — no clipping, no aspect-ratio drift,
   * no giant source files hitting storage. SVGs are uploaded as-is (already
   * resolution-independent).
   */
  const normalizeLogoForUpload = (file: File): Promise<{ blob: Blob; ext: string; contentType: string }> => {
    // SVG → skip canvas; it scales cleanly.
    if (file.type === "image/svg+xml") {
      return Promise.resolve({ blob: file, ext: "svg", contentType: "image/svg+xml" });
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const SIZE = 512;
          const canvas = document.createElement("canvas");
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas not supported in this browser");
          if (logoBg === "white") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, SIZE, SIZE);
          }
          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;
          if (!iw || !ih) throw new Error("Invalid image dimensions");
          const scale =
            logoFit === "cover"
              ? Math.max(SIZE / iw, SIZE / ih) * logoZoom
              : Math.min(SIZE / iw, SIZE / ih) * logoZoom;
          const dw = iw * scale;
          const dh = ih * scale;
          const dx = (SIZE - dw) / 2;
          const dy = (SIZE - dh) / 2;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, dx, dy, dw, dh);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url);
              if (!blob) return reject(new Error("Failed to encode logo"));
              resolve({ blob, ext: "png", contentType: "image/png" });
            },
            "image/png",
            0.95,
          );
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image — the file may be corrupt or unsupported"));
      };
      img.src = url;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in.");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter an event name.");
      return;
    }

    setSubmitting(true);
    let ticker: ReturnType<typeof setInterval> | null = null;
    try {
      const { data: created, error } = await supabase.from("events").insert({
        user_id: user.id,
        name: name.trim(),
        event_date: date ? format(date, "yyyy-MM-dd") : null,
        city: city.trim() || null,
        country: country || null,
        event_type: eventType,
      }).select("id").single();

      if (error) throw error;

      // Persist the organiser logo NOW so it's available before any badges are generated.
      if (created?.id && logoFile) {
        setLogoProgress(8);
        ticker = setInterval(() => {
          setLogoProgress((p) => (p < 85 ? p + Math.max(1, Math.round((90 - p) * 0.08)) : p));
        }, 180);
        try {
          // Normalize with the user's chosen fit/zoom/background so what
          // they see in the preview is exactly what lands in every badge.
          const { blob, ext, contentType } = await normalizeLogoForUpload(logoFile);
          setLogoProgress(45);
          const path = `org-logos/${created.id}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("event-flyers")
            .upload(path, blob, { upsert: true, contentType, cacheControl: "3600" });
          if (upErr) throw upErr;
          setLogoProgress(92);
          const { data: pub } = supabase.storage.from("event-flyers").getPublicUrl(path);
          const { error: dbErr } = await supabase
            .from("events")
            .update({ organizer_logo_url: pub.publicUrl })
            .eq("id", created.id);
          if (dbErr) throw dbErr;
          setLogoProgress(100);
        } catch (logoErr: any) {
          const msg = logoErr?.message || String(logoErr);
          if (/exceeded|too large|payload/i.test(msg)) {
            toast.error("Logo rejected — file too large. Event created without a logo; you can add one later from Badges.");
          } else if (/network|fetch/i.test(msg)) {
            toast.error("Network error uploading logo. Event created — add the logo later from Badges.");
          } else if (/dimensions|corrupt|encode|Canvas/i.test(msg)) {
            toast.error(`Couldn't process logo: ${msg}. Event created — try a different image from Badges.`);
          } else {
            toast.error(`Logo upload failed: ${msg}. Event created — add it later from Badges.`);
          }
        }
      }

      toast.success(`"${name}" created!`);
      resetForm();
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create event.");
    } finally {
      if (ticker) clearInterval(ticker);
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="hero" size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Create New Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Event Name *</Label>
            <Input
              placeholder="e.g. AfroTech Lagos 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Event Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label>City</Label>
              <Input placeholder="e.g. Lagos" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {eventTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Organiser Logo (optional)</Label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => handlePickLogo(e.target.files?.[0])}
            />
            {!logoPreview ? (
              <div className="flex items-center gap-3">
                <div
                  className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 via-pink-500 to-amber-400 flex items-center justify-center overflow-hidden border-2 border-white shadow shrink-0"
                  title="No logo — a gradient placeholder will be used"
                >
                  <span className="text-white font-black text-xl">
                    {(name || "E").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={submitting}>
                    <ImagePlus className="h-4 w-4 mr-1" /> Upload
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    PNG, JPG, WebP or SVG · up to 2MB. Applied to every badge and inside every QR code.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  {/* Badge-corner preview */}
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Badge corner</p>
                    <div
                      className="h-20 w-20 rounded-xl border-2 border-white shadow overflow-hidden mx-auto flex items-center justify-center"
                      style={{ background: logoBg === "white" ? "#fff" : "transparent", backgroundImage: logoBg === "transparent" ? "linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%),linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%)" : undefined, backgroundSize: logoBg === "transparent" ? "10px 10px" : undefined, backgroundPosition: logoBg === "transparent" ? "0 0, 5px 5px" : undefined }}
                    >
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: logoFit,
                          transform: `scale(${logoZoom})`,
                          transformOrigin: "center",
                        }}
                      />
                    </div>
                  </div>
                  {/* QR-with-logo preview */}
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Inside QR code</p>
                    <div className="mx-auto w-fit rounded-md bg-white p-2 shadow">
                      <QRCodeSVG
                        value={`preview:${name || "event"}`}
                        size={92}
                        level="H"
                        includeMargin={false}
                        imageSettings={{
                          src: logoPreview,
                          height: Math.round(92 * 0.22),
                          width: Math.round(92 * 0.22),
                          excavate: true,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Fit</p>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant={logoFit === "contain" ? "default" : "outline"} className="h-7 px-2 text-xs flex-1" onClick={() => setLogoFit("contain")} disabled={submitting}>
                        Fit (no crop)
                      </Button>
                      <Button type="button" size="sm" variant={logoFit === "cover" ? "default" : "outline"} className="h-7 px-2 text-xs flex-1" onClick={() => setLogoFit("cover")} disabled={submitting}>
                        Fill (crop)
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Background</p>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant={logoBg === "white" ? "default" : "outline"} className="h-7 px-2 text-xs flex-1" onClick={() => setLogoBg("white")} disabled={submitting}>
                        White
                      </Button>
                      <Button type="button" size="sm" variant={logoBg === "transparent" ? "default" : "outline"} className="h-7 px-2 text-xs flex-1" onClick={() => setLogoBg("transparent")} disabled={submitting}>
                        Transparent
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Zoom</p>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(logoZoom * 100)}%</span>
                  </div>
                  <Slider
                    min={0.6}
                    max={1.4}
                    step={0.05}
                    value={[logoZoom]}
                    onValueChange={(v) => setLogoZoom(v[0] ?? 1)}
                    disabled={submitting}
                  />
                </div>

                <div className="flex justify-between items-center pt-1">
                  <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                    {logoFile?.name} · {logoFile ? (logoFile.size / 1024).toFixed(0) : "0"}KB
                  </p>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => logoInputRef.current?.click()} disabled={submitting}>
                      <ImagePlus className="h-3 w-3 mr-1" /> Replace
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={clearLogo} disabled={submitting}>
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {submitting && logoFile && logoProgress > 0 && (
              <div className="space-y-1">
                <Progress value={logoProgress} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground">Uploading logo… {logoProgress}%</p>
              </div>
            )}
          </div>

          <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating...</>
            ) : (
              <><Plus className="h-4 w-4 mr-1" /> Create Event</>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
