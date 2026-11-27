import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, CalendarDays, Loader2, MapPin, ScanLine, Search, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ScannerEvent {
  id: string;
  name: string;
  event_date: string | null;
  city: string | null;
  country: string | null;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function ScannerHomePage() {
  const [events, setEvents] = useState<ScannerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, city, country")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setLoadError("Events could not be loaded. Check your connection and try again.");
      } else {
        setEvents(data ?? []);
      }
      setLoading(false);
    };
    void loadEvents();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
    setIsInstalled(standalone);
    setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return events;
    return events.filter((event) =>
      [event.name, event.city, event.country].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [events, query]);

  const handleInstall = async () => {
    if (!installPrompt) {
      setInstallHelpOpen(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Myevent home">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScanLine className="h-5 w-5" />
            </span>
            <span className="truncate font-display text-lg font-bold">Myevent <span className="font-medium text-muted-foreground">Door Team</span></span>
          </Link>
          {!isInstalled && (
            <Button variant="outline" size="sm" onClick={handleInstall} className="shrink-0">
              <Smartphone className="mr-2 h-4 w-4" /> Install scanner
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-3 gap-1.5 border-primary/30 text-primary">
              <ScanLine className="h-3.5 w-3.5" /> D-Day check-in
            </Badge>
            <h1 className="font-display text-3xl font-bold">Select an event</h1>
          </div>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link to="/dashboard/dday">Organizer dashboard</Link>
          </Button>
        </div>

        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search events"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search event or location"
            className="h-12 pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading events
          </div>
        ) : loadError ? (
          <Card className="border-destructive/30 p-5 text-sm text-destructive" role="alert">{loadError}</Card>
        ) : visibleEvents.length > 0 ? (
          <div className="space-y-3">
            {visibleEvents.map((event) => {
              const parsedDate = event.event_date ? new Date(event.event_date) : null;
              const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
                ? format(parsedDate, "EEE, MMM d, yyyy")
                : "Date not set";
              const location = [event.city, event.country].filter(Boolean).join(", ");
              return (
                <Card key={event.id} className="overflow-hidden border-border bg-card transition-colors hover:border-primary/40">
                  <Button asChild variant="ghost" className="h-auto min-h-[88px] w-full justify-between gap-4 rounded-none p-4 text-left hover:bg-muted/50">
                    <Link to={`/scan/${event.id}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-base font-semibold text-foreground">{event.name}</span>
                        <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-normal text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{dateLabel}</span>
                          {location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{location}</span>}
                        </span>
                      </span>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ArrowRight className="h-5 w-5" />
                      </span>
                    </Link>
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-5 py-12 text-center">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">{events.length ? "No events match that search" : "No events available"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Events you can access will appear here.</p>
            <Button variant="outline" asChild className="mt-5 sm:hidden">
              <Link to="/dashboard/dday">Organizer dashboard</Link>
            </Button>
          </div>
        )}
      </main>

      <Dialog open={installHelpOpen} onOpenChange={setInstallHelpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install Myevent Door Scanner</DialogTitle>
            <DialogDescription>
              {isIos
                ? "In Safari, tap Share, then choose Add to Home Screen."
                : "Open your browser menu and choose Install app or Add to Home Screen."}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}