import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lightbulb, Handshake, Megaphone, Settings, ArrowRight, Sparkles, Globe, Wifi, Smartphone, ClipboardList, CalendarCheck, Star, Zap } from "lucide-react";

const modules = [
  { icon: ClipboardList, title: "Registration", desc: "Drop a public sign-up link with tickets, AI copy & QR codes.", grad: "gradient-aurora" },
  { icon: Lightbulb, title: "The Spark", desc: "AI-powered naming, theming & visual identity with African soul.", grad: "gradient-sunset" },
  { icon: Handshake, title: "The Chase", desc: "Find sponsors, generate pitch letters & track partnerships.", grad: "gradient-genz" },
  { icon: Megaphone, title: "The Buzz", desc: "90-day content calendar, social designs & post scheduling.", grad: "gradient-aurora" },
  { icon: Settings, title: "The Engine", desc: "Smart checklists, reminders & logistics built for Africa.", grad: "gradient-sunset" },
  { icon: CalendarCheck, title: "The D-Day", desc: "Live QR check-in, badges, certs & real-time tier stats.", grad: "gradient-genz" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="font-display text-2xl font-bold text-foreground">
            My<span className="text-gradient-genz">event</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Login</Link>
            </Button>
            <Button asChild className="gradient-genz text-primary-foreground shadow-glow">
              <Link to="/auth">Get Started <ArrowRight className="ml-1 h-4 w-4" /></Link>
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

        <div className="relative container flex flex-col items-center py-24 md:py-36 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 glass px-4 py-1.5 text-sm">
            <Sparkles className="h-4 w-4 text-[hsl(var(--neon-pink))]" />
            <span className="font-medium">Your AI-powered event co-pilot</span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground max-w-5xl leading-[1.05] animate-fade-up">
            Throw events that <span className="text-gradient-genz">slap</span>.
            <br className="hidden md:block" /> From <span className="text-gradient-aurora">spark</span> to <span className="text-gradient-sunset">showtime</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground animate-fade-up" style={{ animationDelay: "0.15s" }}>
            Registration, sponsors, content, check-in — one bright dashboard.
            Built for the next generation of African organizers.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button size="lg" className="gradient-genz text-primary-foreground shadow-glow text-base px-8 font-display font-semibold" asChild>
              <Link to="/dashboard">Start Planning Free <ArrowRight className="ml-1 h-5 w-5" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 border-2" asChild>
              <Link to="/dashboard">See It Live</Link>
            </Button>
          </div>

          {/* Sticker badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 animate-fade-up" style={{ animationDelay: "0.45s" }}>
            {["No-code setup", "QR check-in", "AI everywhere", "Mobile money", "Offline-first"].map((t) => (
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

      {/* Modules */}
      <section className="container py-20 md:py-28">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--neon-purple)/0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--neon-purple))]">
            <Zap className="h-3 w-3" /> The Stack
          </span>
          <h2 className="mt-3 font-display text-4xl md:text-5xl font-bold text-foreground">
            Six modules. <span className="text-gradient-genz">One vibe.</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Every step from idea to encore — wired together, on autopilot.
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
        </div>
      </footer>
    </div>
  );
};

export default Index;
