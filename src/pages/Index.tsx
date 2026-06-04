import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight, Sparkles, Star, Zap, CalendarDays, MapPin, Ticket, Search,
  Lightbulb, Handshake, Megaphone, Settings, ClipboardList, CalendarCheck, Globe, Wifi, Smartphone, Heart, Filter, X, ArrowUpDown,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const modules = [
  { icon: ClipboardList, title: "Registration", desc: "Drop a public sign-up link with tickets, AI copy & QR codes.", grad: "gradient-aurora" },
  { icon: Lightbulb, title: "The Spark", desc: "AI-powered naming, theming & visual identity with African soul.", grad: "gradient-sunset" },
  { icon: Handshake, title: "The Chase", desc: "Find sponsors, generate pitch letters & track partnerships.", grad: "gradient-genz" },
  { icon: Megaphone, title: "The Buzz", desc: "90-day content calendar, social designs & post scheduling.", grad: "gradient-aurora" },
  { icon: Settings, title: "The Engine", desc: "Smart checklists, reminders & logistics built for Africa.", grad: "gradient-sunset" },
  { icon: CalendarCheck, title: "The D-Day", desc: "Live QR check-in, badges, certs & real-time tier stats.", grad: "gradient-genz" },
];

const Index = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all"); // all | free | paid | vip | vvip
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("event_registration_pages")
        .select("id, slug, title, description, flyer_url, location, start_at, end_at, is_paid, currency, general_price, vip_price, vvip_price, general_enabled, vip_enabled, vvip_enabled")
        .eq("is_published", true)
        .order("start_at", { ascending: true, nullsFirst: false });
      setEvents(data || []);
      setLoadingEvents(false);
    };
    load();
  }, []);

  const locations = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => { if (e.location) set.add(String(e.location).trim()); });
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return events.filter((e) => {
      if (q && ![e.title, e.location, e.description].some((v) => v && String(v).toLowerCase().includes(q))) return false;
      if (locationFilter !== "all" && (e.location || "").trim() !== locationFilter) return false;
      if (tierFilter === "free" && e.is_paid) return false;
      if (tierFilter === "paid" && !e.is_paid) return false;
      if (tierFilter === "vip" && !e.vip_enabled) return false;
      if (tierFilter === "vvip" && !e.vvip_enabled) return false;
      if (from || to) {
        if (!e.start_at) return false;
        const t = new Date(e.start_at).getTime();
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      return true;
    });
  }, [events, query, locationFilter, tierFilter, dateFrom, dateTo]);

  const hasActiveFilters = locationFilter !== "all" || tierFilter !== "all" || !!dateFrom || !!dateTo || !!query.trim();
  const clearFilters = () => {
    setQuery(""); setLocationFilter("all"); setTierFilter("all"); setDateFrom(""); setDateTo("");
  };

  const startingPrice = (e: any) => {
    const prices: number[] = [];
    if (e.general_enabled) prices.push(Number(e.general_price) || 0);
    if (e.vip_enabled) prices.push(Number(e.vip_price) || 0);
    if (e.vvip_enabled) prices.push(Number(e.vvip_price) || 0);
    if (!e.is_paid || prices.length === 0 || Math.min(...prices) === 0) return "Free";
    const min = Math.min(...prices.filter((p) => p > 0));
    return `${e.currency || "NGN"} ${min.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="font-display text-2xl font-bold text-foreground">
            My<span className="text-gradient-genz">event</span>
          </Link>
          <div className="flex items-center gap-3">
            <a href="#events" className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground transition">
              Browse events
            </a>
            <Button variant="ghost" asChild>
              <Link to="/auth">Login</Link>
            </Button>
            <Button asChild className="gradient-genz text-primary-foreground shadow-glow">
              <Link to="/auth">Host an event <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 bg-mesh">
        {/* Animated blobs */}
        <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-[hsl(var(--neon-pink)/0.45)] blur-3xl animate-blob" />
        <div className="pointer-events-none absolute right-0 top-40 h-80 w-80 rounded-full bg-[hsl(var(--neon-cyan)/0.4)] blur-3xl animate-blob" style={{ animationDelay: "3s" }} />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[hsl(var(--neon-purple)/0.45)] blur-3xl animate-blob" style={{ animationDelay: "6s" }} />

        <div className="relative container flex flex-col items-center py-20 md:py-28 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 glass px-4 py-1.5 text-sm">
            <Sparkles className="h-4 w-4 text-[hsl(var(--neon-pink))]" />
            <span className="font-medium">Discover & host Africa's hottest events</span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight text-foreground max-w-5xl leading-[1.05] animate-fade-up">
            Find your next <span className="text-gradient-genz">unforgettable</span> moment.
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground animate-fade-up" style={{ animationDelay: "0.15s" }}>
            Browse and register for live conferences, festivals, workshops and parties — all in one place.
          </p>

          {/* Search */}
          <div className="mt-8 w-full max-w-xl animate-fade-up" style={{ animationDelay: "0.25s" }}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events by name, city or vibe…"
                className="h-14 pl-12 pr-4 text-base rounded-full glass border-border/60 shadow-warm"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "0.35s" }}>
            <Button size="lg" className="gradient-genz text-primary-foreground shadow-glow text-base px-8 font-display font-semibold" asChild>
              <a href="#events">Browse all events <ArrowRight className="ml-1 h-5 w-5" /></a>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 border-2" asChild>
              <Link to="/auth">Host your own</Link>
            </Button>
          </div>

          {/* Sticker badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 animate-fade-up" style={{ animationDelay: "0.45s" }}>
            {["Instant tickets", "QR check-in", "Free registration", "Mobile money", "Across Africa"].map((t) => (
              <span key={t} className="rounded-full border border-border/60 glass px-3 py-1 text-xs font-medium">{t}</span>
            ))}
          </div>
        </div>

        {/* Marquee */}
        <div className="relative border-y border-border/50 bg-background/40 py-3 backdrop-blur">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap text-sm font-display font-semibold uppercase tracking-widest text-muted-foreground">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ["✦ Lagos", "✦ Nairobi", "✦ Accra", "✦ Kigali", "✦ Cape Town", "✦ Dakar", "✦ Kampala", "✦ Addis"].map((c, i) => (
                <span key={`${k}-${i}`} className="text-foreground/70">{c}</span>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Live Events Listing */}
      <section id="events" className="container py-20 md:py-24">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--neon-pink)/0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--neon-pink))]">
              <Star className="h-3 w-3" /> Happening now
            </span>
            <h2 className="mt-3 font-display text-4xl md:text-5xl font-bold text-foreground">
              Live <span className="text-gradient-genz">events</span> on Myevent
            </h2>
            <p className="mt-2 text-muted-foreground">
              {loadingEvents ? "Loading…" : `${filtered.length} event${filtered.length === 1 ? "" : "s"} ready for you.`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 rounded-2xl border border-border/60 glass p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3 text-sm font-display font-semibold text-foreground">
            <Filter className="h-4 w-4 text-[hsl(var(--neon-purple))]" />
            Refine your search
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters} className="ml-auto h-7 text-xs">
                <X className="h-3 w-3 mr-1" /> Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="pl-9 h-10" />
            </div>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent className="bg-popover z-50 max-h-72">
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Tier / Price" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">All tickets</SelectItem>
                <SelectItem value="free">Free only</SelectItem>
                <SelectItem value="paid">Paid only</SelectItem>
                <SelectItem value="vip">Has VIP</SelectItem>
                <SelectItem value="vvip">Has VVIP</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10" aria-label="From date" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10" aria-label="To date" />
            </div>
          </div>
        </div>

        {loadingEvents ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center space-y-3">
              <CalendarCheck className="h-10 w-10 mx-auto text-muted-foreground" />
              <h3 className="font-display text-xl font-semibold">No events yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {query
                  ? "Nothing matches that search. Try another keyword or browse all events."
                  : "Be the first to publish a stunning event. It only takes a few minutes."}
              </p>
              <Button asChild className="gradient-genz text-primary-foreground mt-2">
                <Link to="/auth">Host an event <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e, i) => (
              <Link
                key={e.id}
                to={`/r/${e.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-glow animate-fade-up"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-mesh">
                  {e.flyer_url ? (
                    <img
                      src={e.flyer_url}
                      alt={e.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full gradient-aurora flex items-center justify-center">
                      <CalendarCheck className="h-12 w-12 text-primary-foreground/80" />
                    </div>
                  )}
                  <Badge className="absolute top-3 right-3 bg-background/90 text-foreground border border-border/60 backdrop-blur">
                    <Ticket className="h-3 w-3 mr-1" /> {startingPrice(e)}
                  </Badge>
                </div>
                <div className="p-5 space-y-2">
                  <h3 className="font-display text-lg font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {e.title}
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {e.start_at && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(new Date(e.start_at), "MMM d, yyyy")}
                      </span>
                    )}
                    {e.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[140px]">{e.location}</span>
                      </span>
                    )}
                  </div>
                  {e.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{e.description}</p>
                  )}
                  <div className="pt-2">
                    <span className="inline-flex items-center text-sm font-semibold text-primary group-hover:gap-2 transition-all gap-1">
                      Register now <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Modules */}
      <section className="container py-16 md:py-20 border-t border-border/40">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--neon-purple)/0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--neon-purple))]">
            <Zap className="h-3 w-3" /> For organizers
          </span>
          <h2 className="mt-3 font-display text-4xl md:text-5xl font-bold text-foreground">
            Run your event like a <span className="text-gradient-genz">pro</span>.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Six modules — from naming, sponsors and content to QR check-in — on autopilot.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod, i) => (
            <div
              key={mod.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow animate-fade-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full ${mod.grad} opacity-20 blur-2xl transition-opacity group-hover:opacity-40`} />
              <div className={`mb-4 inline-flex rounded-xl ${mod.grad} p-3 shadow-warm`}>
                <mod.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">{mod.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{mod.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Africa */}
      <section className="relative overflow-hidden bg-secondary py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "var(--gradient-mesh)" }} />
        <div className="container">
          <div className="relative text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary-foreground">
              Built for Africa. <span className="text-gradient-aurora">By Africa.</span>
            </h2>
          </div>
          <div className="relative grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              { icon: Globe, title: "Culturally Aware AI", desc: "Generates names, designs and copy that respect and celebrate African culture." },
              { icon: Wifi, title: "Offline-First PWA", desc: "Works on 2G/3G networks and stores data locally so nothing is lost." },
              { icon: Smartphone, title: "Mobile Money Ready", desc: "Integrated with M-Pesa, MoMo, Paystack & Flutterwave for payments." },
            ].map((item, i) => (
              <div key={item.title} className="flex flex-col items-center text-center animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="mb-4 rounded-full gradient-genz p-4 shadow-glow">
                  <item.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold text-secondary-foreground mb-2">{item.title}</h3>
                <p className="text-secondary-foreground/70 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 md:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-mesh p-10 md:p-16 text-center shadow-glow">
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[hsl(var(--neon-pink)/0.4)] blur-3xl animate-blob" />
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-56 w-56 rounded-full bg-[hsl(var(--neon-cyan)/0.4)] blur-3xl animate-blob" />
          <Star className="mx-auto mb-3 h-7 w-7 text-[hsl(var(--neon-pink))]" />
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground">
            Your next event, <span className="text-gradient-genz">main character energy</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Join thousands of organizers shipping unforgettable experiences across the continent.
          </p>
          <Button size="lg" className="mt-8 gradient-genz text-primary-foreground text-base px-10 font-display font-semibold animate-pulse-warm" asChild>
            <Link to="/dashboard">Get Started Free <ArrowRight className="ml-1" /></Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-display text-lg font-bold text-foreground">
            My<span className="text-gradient-sunset">event</span>
          </span>
          <p className="text-sm text-muted-foreground">© 2026 Myevent. Empowering African events.</p>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
            Made with <Heart className="h-4 w-4 fill-red-500 text-red-500" aria-label="love" /> by <span className="font-semibold text-foreground">Chief Tolulope</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
