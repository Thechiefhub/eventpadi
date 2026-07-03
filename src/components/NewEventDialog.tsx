import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, CalendarIcon, Loader2, ImagePlus, Trash2 } from "lucide-react";
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
  const logoInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_LOGO = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];

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
          const ext = (logoFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
          const path = `org-logos/${created.id}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("event-flyers")
            .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
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
            <div className="flex items-center gap-3">
              <div
                className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 via-pink-500 to-amber-400 flex items-center justify-center overflow-hidden border-2 border-white shadow shrink-0"
                title={logoPreview ? "Selected logo preview" : "No logo — a gradient placeholder will be used"}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain bg-white" />
                ) : (
                  <span className="text-white font-black text-xl">
                    {(name || "E").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handlePickLogo(e.target.files?.[0])}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={submitting}>
                    <ImagePlus className="h-4 w-4 mr-1" /> {logoFile ? "Replace" : "Upload"}
                  </Button>
                  {logoFile && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearLogo} disabled={submitting} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  PNG, JPG, WebP or SVG · up to 2MB. Applied to every badge for this event.
                </p>
              </div>
            </div>
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
