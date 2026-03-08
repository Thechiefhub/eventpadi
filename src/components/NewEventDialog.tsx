import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

  const resetForm = () => {
    setName("");
    setDate(undefined);
    setCity("");
    setCountry("");
    setEventType("conference");
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
    try {
      const { error } = await supabase.from("events").insert({
        user_id: user.id,
        name: name.trim(),
        event_date: date ? format(date, "yyyy-MM-dd") : null,
        city: city.trim() || null,
        country: country || null,
        event_type: eventType,
      });

      if (error) throw error;
      toast.success(`"${name}" created!`);
      resetForm();
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create event.");
    } finally {
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
