import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarDays, MapPin, Mail, Phone, Ticket, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  admits: z.number().int().min(1).max(20),
});

export default function PublicRegistration() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"general" | "vip" | "vvip">("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [admits, setAdmits] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("event_registration_pages").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
      setPage(data);
      if (data) {
        if (data.general_enabled) setTier("general");
        else if (data.vip_enabled) setTier("vip");
        else if (data.vvip_enabled) setTier("vvip");
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const tiers = page ? [
    { key: "general" as const, label: "General", price: page.general_price, enabled: page.general_enabled },
    { key: "vip" as const, label: "VIP", price: page.vip_price, enabled: page.vip_enabled },
    { key: "vvip" as const, label: "VVIP", price: page.vvip_price, enabled: page.vvip_enabled },
  ].filter((t) => t.enabled) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = formSchema.safeParse({ name, email, phone, admits });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    const priceMap: Record<string, number> = { general: page.general_price, vip: page.vip_price, vvip: page.vvip_price };
    const amount = page.is_paid ? (priceMap[tier] || 0) * admits : 0;
    const { data, error } = await supabase.from("event_registrations").insert({
      registration_page_id: page.id,
      event_id: page.event_id,
      user_id: page.user_id,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      ticket_tier: tier,
      admits,
      amount,
      payment_status: page.is_paid ? "pending" : "free",
    }).select().single();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setDone(data);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!page) return (
    <div className="flex h-screen items-center justify-center p-4 text-center">
      <div>
        <p className="font-display text-2xl font-bold">Registration not found</p>
        <p className="mt-2 text-muted-foreground">This event is unavailable or the link has expired.</p>
      </div>
    </div>
  );

  if (done) return (
    <div className="min-h-screen gradient-hero text-foreground">
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-4">
        <Card className="w-full">
          <CardContent className="space-y-4 p-8 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <h2 className="font-display text-2xl font-bold">You're registered!</h2>
            <p className="text-muted-foreground">Thanks {done.name}. We've reserved {done.admits} {done.admits === 1 ? "spot" : "spots"} on the <Badge>{done.ticket_tier.toUpperCase()}</Badge> list for {page.title}.</p>
            {page.is_paid && <p className="text-sm">Payment status: <Badge variant="outline">{done.payment_status}</Badge></p>}
            <p className="text-xs text-muted-foreground">Check your email/phone for confirmation. See you at the event!</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {page.flyer_url && (
        <div className="relative h-56 w-full overflow-hidden sm:h-80">
          <img src={page.flyer_url} alt={page.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
      )}
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <div className="space-y-2">
          <Badge variant="outline" className="border-primary text-primary"><Sparkles className="mr-1 h-3 w-3" />Open Registration</Badge>
          <h1 className="font-display text-3xl font-bold md:text-4xl">{page.title}</h1>
          {page.description && <p className="whitespace-pre-wrap text-muted-foreground">{page.description}</p>}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {page.start_at && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{new Date(page.start_at).toLocaleString()}</span>}
            {(page.location || page.venue_address) && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{[page.venue_address, page.location].filter(Boolean).join(", ")}</span>}
            {page.contact_email && <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" />{page.contact_email}</span>}
            {page.contact_phone && <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{page.contact_phone}</span>}
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Ticket className="h-5 w-5 text-primary" />Reserve your spot</h2>

            <div className="grid gap-2 sm:grid-cols-3">
              {tiers.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTier(t.key)}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${tier === t.key ? "border-primary bg-primary/5 shadow-warm" : "border-border hover:border-primary/40"}`}
                >
                  <p className="font-display text-sm font-bold">{t.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {page.is_paid && t.price > 0 ? `${page.currency} ${Number(t.price).toLocaleString()}` : "Free"}
                  </p>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Number of Admits</Label>
                <Input type="number" min={1} max={20} value={admits} onChange={(e) => setAdmits(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <Button type="submit" disabled={submitting} className="gradient-sunset w-full text-primary-foreground" size="lg">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Register Now
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}