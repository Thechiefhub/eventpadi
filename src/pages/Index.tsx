import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lightbulb, Handshake, Megaphone, Settings, ArrowRight, Sparkles, Globe, Wifi, Smartphone } from "lucide-react";
import heroPattern from "@/assets/hero-pattern.jpg";

const modules = [
  {
    icon: Lightbulb,
    title: "The Spark",
    desc: "AI-powered naming, theming & visual identity with African aesthetics.",
    color: "text-sunset-gold",
  },
  {
    icon: Handshake,
    title: "The Chase",
    desc: "Find sponsors, generate pitch letters & track partnerships.",
    color: "text-primary",
  },
  {
    icon: Megaphone,
    title: "The Buzz",
    desc: "90-day content calendar, social designs & post scheduling.",
    color: "text-earth-green",
  },
  {
    icon: Settings,
    title: "The Engine",
    desc: "Smart checklists, reminders & logistics built for Africa.",
    color: "text-kente-red",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="font-display text-2xl font-bold text-foreground">
            My<span className="text-gradient-sunset">event</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/dashboard">Login</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/dashboard">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 gradient-hero opacity-95" />
        <img
          src={heroPattern}
          alt=""
          className="absolute inset-0 h-full w-full object-cover mix-blend-overlay opacity-30"
        />
        <div className="relative container flex flex-col items-center py-24 md:py-36 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary-foreground/80">
            <Sparkles className="h-4 w-4" />
            Your AI-powered event co-pilot
          </div>
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-primary-foreground max-w-4xl leading-tight animate-fade-up">
            Plan Unforgettable Events Across{" "}
            <span className="text-gradient-sunset">Africa</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl text-primary-foreground/70 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            From ideation to post-event follow-up — Myevent combines AI assistance,
            local knowledge, and smart automation to bring your vision to life.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button variant="hero" size="lg" className="text-base px-8" asChild>
              <Link to="/dashboard">
                Start Planning <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="hero-outline" size="lg" className="text-base px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" asChild>
              <Link to="/dashboard">See How It Works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="container py-20 md:py-28">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Four Modules. One Seamless Workflow.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Each module tackles a critical phase of event planning, with tools designed for the African context.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod, i) => (
            <div
              key={mod.title}
              className="group rounded-xl border border-border bg-card p-6 hover:shadow-warm transition-all duration-300 hover:-translate-y-1 animate-fade-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`mb-4 inline-flex rounded-lg bg-muted p-3 ${mod.color}`}>
                <mod.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                {mod.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{mod.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Africa */}
      <section className="bg-secondary py-20 md:py-28">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary-foreground">
              Built for Africa. By Africa.
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              { icon: Globe, title: "Culturally Aware AI", desc: "Generates names, designs and copy that respect and celebrate African culture." },
              { icon: Wifi, title: "Offline-First PWA", desc: "Works on 2G/3G networks and stores data locally so nothing is lost." },
              { icon: Smartphone, title: "Mobile Money Ready", desc: "Integrated with M-Pesa, MoMo, Paystack & Flutterwave for payments." },
            ].map((item, i) => (
              <div key={item.title} className="flex flex-col items-center text-center animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="mb-4 rounded-full gradient-sunset p-4">
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
      <section className="container py-20 md:py-28 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
          Ready to Plan Your Next Event?
        </h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
          Join thousands of organizers who trust Myevent to deliver unforgettable experiences.
        </p>
        <Button variant="hero" size="lg" className="text-base px-10 animate-pulse-warm" asChild>
          <Link to="/dashboard">Get Started Free <ArrowRight className="ml-1" /></Link>
        </Button>
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
