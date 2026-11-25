import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowRight, ArrowUpDown, CalendarCheck, CalendarDays, ClipboardList,
  Filter, Handshake, Heart, Lightbulb, MapPin, Megaphone, Search, Settings,
  Sparkles, Ticket, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  flyer_url: string | null;
  location: string | null;
  start_at: string | null;
  is_paid: boolean;
  currency: string | null;
  general_price: number | null;
  vip_price: number | null;
  vvip_price: number | null;
  general_enabled: boolean;
  vip_enabled: boolean;
  vvip_enabled: boolean;
};

const eventModules = [
  { icon: ClipboardList, title: "Registration", desc: "Create event pages, manage tiers, and issue QR tickets." },
  { icon: Lightbulb, title: "The Spark", desc: "Shape an event concept, name, and visual identity." },
  { icon: Handshake, title: "The Chase", desc: "Find sponsors, prepare pitches, and track partnerships." },
  { icon: Megaphone, title: "The Buzz", desc: "Plan event content and keep your audience informed." },
  { icon: Settings, title: "The Engine", desc: "Coordinate practical checklists and event logistics." },
  { icon: CalendarCheck, title: "The D-Day", desc: "Check in guests, manage badges, and track attendance." },
];

const eventFields = "id, slug, title, description, flyer_url, location, start_at, is_paid, currency, general_price, vip_price, vvip_price, general_enabled, vip_enabled, vvip_enabled";

function eventDate(value: string | null, pattern = "EEE, MMM d, yyyy") {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : format(date, pattern);
}

function startingPrice(event: PublicEvent) {
  const prices: number[] = [];
  if (event.general_enabled) prices.push(Number(event.general_price) || 0);
  if (event.vip_enabled) prices.push(Number(event.vip_price) || 0);
  if (event.vvip_enabled) prices.push(Number(event.vvip_price) || 0);
  if (!event.is_paid || prices.length === 0) return "Free";
  const paidPrices = prices.filter((price) => price > 0);
  if (paidPrices.length === 0) return "Free";
  return `${event.currency || "NGN"} ${Math.min(...paidPrices).toLocaleString()}`;
}

export default function Index() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventLoadError, setEventLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("soonest");

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setEventLoadError(false);
    try {
      const { data, error } = await supabase
        .from("event_registration_pages")
        .select(eventFields)
        .eq("is_published", true)
        .order("start_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      setEvents((data ?? []) as PublicEvent[]);
    } catch {
      setEvents([]);
      setEventLoadError(true);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const locations = useMemo(() => {
    const knownLocations = new Set<string>();
    events.forEach((event) => {
      const location = event.location?.trim();
      if (location) knownLocations.add(location);
    });
    return Array.from(knownLocations).sort();
  }, [events]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const matches = events.filter((event) => {
      if (search && ![event.title, event.location, event.description].some((value) => value?.toLowerCase().includes(search))) return false;
      if (locationFilter !== "all" && event.location?.trim() !== locationFilter) return false;
      if (tierFilter === "free" && event.is_paid) return false;
      if (tierFilter === "paid" && !event.is_paid) return false;
      if (tierFilter === "vip" && !event.vip_enabled) return false;
      if (tierFilter === "vvip" && !event.vvip_enabled) return false;
      if (from !== null || to !== null) {
        if (!event.start_at) return false;
        const timestamp = new Date(event.start_at).getTime();
        if (Number.isNaN(timestamp) || (from !== null && timestamp < from) || (to !== null && timestamp > to)) return false;
      }
      return true;
    });

    const minimumPrice = (event: PublicEvent) => {
      const prices = [
        event.general_enabled ? Number(event.general_price) || 0 : null,
        event.vip_enabled ? Number(event.vip_price) || 0 : null,
        event.vvip_enabled ? Number(event.vvip_price) || 0 : null,
      ].filter((price): price is number => price !== null && price > 0);
      return prices.length ? Math.min(...prices) : 0;
    };
    const tierRank = (event: PublicEvent) => event.vvip_enabled ? 3 : event.vip_enabled ? 2 : event.is_paid ? 1 : 0;
    const sorted = [...matches];
    if (sort === "soonest") {
      sorted.sort((a, b) => {
        const aDate = a.start_at ? new Date(a.start_at).getTime() : Infinity;
        const bDate = b.start_at ? new Date(b.start_at).getTime() : Infinity;
        return (Number.isNaN(aDate) ? Infinity : aDate) - (Number.isNaN(bDate) ? Infinity : bDate);
      });
    } else if (sort === "lowest_price") {
      sorted.sort((a, b) => minimumPrice(a) - minimumPrice(b));
    } else if (sort === "highest_tier") {
      sorted.sort((a, b) => tierRank(b) - tierRank(a));
    }
    return sorted;
  }, [events, query, locationFilter, tierFilter, dateFrom, dateTo, sort]);

  const hasActiveFilters = locationFilter !== "all" || tierFilter !== "all" || Boolean(dateFrom || dateTo || query.trim()) || sort !== "soonest";
  const clearFilters = () => {
    setQuery("");
    setLocationFilter("all");
    setTierFilter("all");
    setDateFrom("");
    setDateTo("");
    setSort("soonest");
  };
  const featuredEvent = events.find((event) => event.flyer_url) ?? events[0];

  return (
    <div className="event-home min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-3">
          <Link to="/" className="font-display text-xl font-bold text-foreground" aria-label="MyEvent home">
            My<span className="text-primary">event</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <a href="#events" className="hidden text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline">Browse events</a>
            <Button variant="ghost" size="sm" asChild><Link to="/auth">Login</Link></Button>
            <Button size="sm" asChild><Link to="/auth">Host an event <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative isolate flex min-h-[340px] items-center overflow-hidden bg-secondary text-secondary-foreground md:min-h-[460px]">
          {featuredEvent?.flyer_url && <img src={featuredEvent.flyer_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />}
          <div className="absolute inset-0 bg-secondary/80" aria-hidden="true" />
          <div className="container relative py-8 md:py-16">
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary-foreground/80">
              <Sparkles className="h-4 w-4" /> Discover events across Africa
            </p>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-secondary-foreground md:text-6xl">
              Conferences. Awards. Big moments.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary-foreground/85 md:mt-4 md:text-lg">
              Find the gatherings, conversations, and celebrations worth showing up for.
            </p>
            <div className="mt-5 max-w-2xl md:mt-7">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") document.getElementById("events")?.scrollIntoView({ behavior: "smooth" }); }}
                  placeholder="Search events by name, city, or topic"
                  aria-label="Search events by name, city, or topic"
                  className="h-12 border-border bg-background pl-12 text-foreground shadow-deep"
                />
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-secondary-foreground/70">
              Conferences <span aria-hidden="true">·</span> Award nights <span aria-hidden="true">·</span> Festivals <span aria-hidden="true">·</span> Workshops
            </p>
          </div>
        </section>

        <section id="events" className="container scroll-mt-20 py-10 md:py-16">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Find your next gathering</p>
              <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">Explore events</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {loadingEvents ? "Loading events…" : `${filtered.length} event${filtered.length === 1 ? "" : "s"} available`}
              </p>
            </div>
            {hasActiveFilters && <Button size="sm" variant="ghost" onClick={clearFilters}><X className="mr-1 h-4 w-4" /> Clear filters</Button>}
          </div>

          <div className="mb-7 rounded-md border border-border bg-card p-3 md:p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4 text-primary" /> Refine the list
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger aria-label="Filter by location"><SelectValue placeholder="Location" /></SelectTrigger>
                <SelectContent className="z-50 max-h-72 bg-popover">
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((location) => <SelectItem key={location} value={location}>{location}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger aria-label="Filter by ticket type"><SelectValue placeholder="Ticket type" /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="all">All tickets</SelectItem>
                  <SelectItem value="free">Free events</SelectItem>
                  <SelectItem value="paid">Paid events</SelectItem>
                  <SelectItem value="vip">Has VIP</SelectItem>
                  <SelectItem value="vvip">Has VVIP</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="From date" />
                <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="To date" />
              </div>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger aria-label="Sort events"><ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="soonest">Soonest date</SelectItem>
                  <SelectItem value="lowest_price">Lowest price</SelectItem>
                  <SelectItem value="highest_tier">Highest tier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {eventLoadError ? (
            <div className="border border-destructive/40 bg-card p-6 text-center">
              <h3 className="font-display text-lg font-semibold">Events couldn’t load</h3>
              <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
              <Button className="mt-4" onClick={() => void loadEvents()}>Try again</Button>
            </div>
          ) : loadingEvents ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-border p-10 text-center">
              <CalendarCheck className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 font-display text-xl font-semibold">No matching events</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {events.length === 0 ? "Be the first to publish an event." : "Try another search or adjust your filters."}
              </p>
              {events.length === 0 && <Button className="mt-4" asChild><Link to="/auth">Host an event <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((event) => (
                <Link key={event.id} to={`/r/${event.slug}`} className="group min-w-0 overflow-hidden rounded-lg border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-deep">
                  <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
                    {event.flyer_url ? (
                      <img src={event.flyer_url} alt={event.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-secondary-foreground"><CalendarCheck className="h-12 w-12" /></div>
                    )}
                    <Badge variant="secondary" className="absolute right-3 top-3"><Ticket className="mr-1 h-3 w-3" />{startingPrice(event)}</Badge>
                  </div>
                  <div className="space-y-2 p-4">
                    <h3 className="line-clamp-2 font-display text-lg font-bold transition-colors group-hover:text-primary">{event.title}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {eventDate(event.start_at) && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{eventDate(event.start_at)}</span>}
                      {event.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{event.location}</span></span>}
                    </div>
                    {event.description && <p className="line-clamp-2 text-sm text-muted-foreground">{event.description}</p>}
                    <span className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-primary">View event <ArrowRight className="h-4 w-4" /></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="border-y border-border bg-card py-12 md:py-16">
          <div className="container">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">For event teams</p>
              <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">From first idea to final applause.</h2>
              <p className="mt-2 text-muted-foreground">One organized workspace for the details behind a great gathering.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {eventModules.map((module, index) => (
                <div key={module.title} className="rounded-md border border-border bg-background p-4">
                  <div className={`mb-3 inline-flex rounded-md p-2 ${index % 2 === 0 ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}`}>
                    <module.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display font-bold">{module.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{module.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-secondary py-12 text-secondary-foreground md:py-16">
          <div className="container flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary-foreground/75">Bring people together</p>
              <h2 className="mt-2 font-display text-3xl font-bold">Your next event starts here.</h2>
            </div>
            <Button variant="outline" className="border-secondary-foreground/50 bg-transparent text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground" asChild>
              <Link to="/auth">Host an event <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <div className="container flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <span className="font-display text-lg font-bold">My<span className="text-primary">event</span></span>
          <p className="text-sm text-muted-foreground">© 2026 Myevent. Empowering African events.</p>
          <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">Made with <Heart className="h-4 w-4 fill-current text-destructive" aria-label="love" /> by <span className="font-semibold text-foreground">Chief Tolulope</span></p>
        </div>
      </footer>
    </div>
  );
}