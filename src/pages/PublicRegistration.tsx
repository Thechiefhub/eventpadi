import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarDays, MapPin, Mail, Phone, Ticket, CheckCircle2, Sparkles, Download, MessageCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";
import { downloadTicketPdf, buildQrPayload } from "@/lib/ticket";

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
  const [perks, setPerks] = useState<{ general: string[]; vip: string[]; vvip: string[] } | null>(null);
  const [confirm, setConfirm] = useState<{ ticketRef: string; whatsappUrl: string | null; emailStatus: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("event_registration_pages").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
      setPage(data);
      if (data) {
        if (data.general_enabled) setTier("general");
        else if (data.vip_enabled) setTier("vip");
        else if (data.vvip_enabled) setTier("vvip");
        // Fetch AI-generated perks (best-effort, non-blocking)
        supabase.functions.invoke("reg-ai-assist", {
          body: { mode: "perks", title: data.title, theme: data.description?.slice(0, 240) || "", location: data.location || "" },
        }).then(({ data: p }) => { if (p && !(p as any).error) setPerks(p as any); }).catch(() => {});
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
    // Fetch the synced attendee record to retrieve the ticket id (created by DB trigger)
    let ticketRef = "";
    try {
      if (data.attendee_id) {
        const { data: att } = await supabase.from("attendees").select("ticket_id").eq("id", data.attendee_id).maybeSingle();
        ticketRef = att?.ticket_id || "";
      }
    } catch {}
    if (!ticketRef) ticketRef = `REG-${data.id.slice(0, 8).toUpperCase()}`;

    // Trigger confirmation email + WhatsApp link (non-blocking)
    let whatsappUrl: string | null = null;
    let emailStatus = "skipped";
    try {
      const { data: c } = await supabase.functions.invoke("send-registration-confirmation", {
        body: {
          registrationId: data.id,
          eventId: page.event_id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          ticketTier: data.ticket_tier,
          admits: data.admits,
          ticketRef,
          eventTitle: page.title,
          eventDate: page.start_at,
          location: [page.venue_address, page.location].filter(Boolean).join(", "),
          registrationUrl: window.location.href,
        },
      });
      whatsappUrl = (c as any)?.whatsappUrl || null;
      emailStatus = (c as any)?.emailStatus || "skipped";
    } catch {}
    setConfirm({ ticketRef, whatsappUrl, emailStatus });
  };

  const handleDownloadTicket = async () => {
    if (!confirm || !done) return;
    await downloadTicketPdf({
      ticketRef: confirm.ticketRef,
      name: done.name,
      tier: done.ticket_tier,
      admits: done.admits,
      eventTitle: page.title,
      eventDate: page.start_at,
      location: [page.venue_address, page.location].filter(Boolean).join(", "),
      qrPayload: buildQrPayload({ ticketRef: confirm.ticketRef, eventId: page.event_id, registrationId: done.id }),
    });
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-4">
        <Card className="w-full overflow-hidden border-primary/20 shadow-2xl">
          <div className="gradient-sunset h-2" />
          <CardContent className="space-y-5 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h2 className="font-display text-3xl font-bold">You're in, {done.name.split(" ")[0]}!</h2>
            <p className="text-muted-foreground">{done.admits} {done.admits === 1 ? "spot" : "spots"} reserved on the <Badge className="mx-1">{done.ticket_tier.toUpperCase()}</Badge> list for <strong>{page.title}</strong>.</p>

            {confirm && (
              <div className="rounded-xl border bg-muted/30 p-4 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ticket reference</p>
                    <p className="font-mono text-base font-bold">{confirm.ticketRef}</p>
                  </div>
                  <div className="rounded-md bg-white p-1.5 shadow">
                    <QRCodeSVG value={buildQrPayload({ ticketRef: confirm.ticketRef, eventId: page.event_id, registrationId: done.id })} size={72} />
                  </div>
                </div>
                {confirm.emailStatus === "sent" && (
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-primary"><Check className="h-3 w-3" />Confirmation email sent to {done.email}</p>
                )}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={handleDownloadTicket} className="gradient-sunset text-primary-foreground">
                <Download className="mr-2 h-4 w-4" />Download Ticket PDF
              </Button>
              {confirm?.whatsappUrl && (
                <Button asChild variant="outline">
                  <a href={confirm.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Get on WhatsApp</a>
                </Button>
              )}
            </div>

            {page.is_paid && <p className="text-xs text-muted-foreground">Payment status: <Badge variant="outline">{done.payment_status}</Badge></p>}
            <p className="text-[11px] text-muted-foreground">Save your ticket — you'll need the QR at check-in.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {page.flyer_url ? (
        <div className="relative w-full overflow-hidden bg-black">
          <img src={page.flyer_url} alt={page.title} className="h-auto w-full object-contain md:max-h-[80vh]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>
      ) : (
        <div className="gradient-hero h-32 w-full" />
      )}
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <div className="space-y-3">
          <Badge variant="outline" className="border-primary text-primary"><Sparkles className="mr-1 h-3 w-3" />Open Registration</Badge>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">{page.title}</h1>
          {page.description && <p className="whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">{page.description}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {page.start_at && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{new Date(page.start_at).toLocaleString()}</span>}
            {(page.location || page.venue_address) && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{[page.venue_address, page.location].filter(Boolean).join(", ")}</span>}
            {page.contact_email && <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" />{page.contact_email}</span>}
            {page.contact_phone && <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{page.contact_phone}</span>}
          </div>
        </div>

        <Card className="overflow-hidden border-primary/10 shadow-warm">
          <div className="gradient-sunset h-1.5" />
          <CardContent className="space-y-5 p-6">
            <h2 className="font-display text-2xl font-semibold flex items-center gap-2"><Ticket className="h-6 w-6 text-primary" />Reserve your spot</h2>

            <div className="grid gap-3 sm:grid-cols-3">
              {tiers.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTier(t.key)}
                  className={`group relative rounded-xl border-2 p-4 text-left transition-all ${tier === t.key ? "border-primary bg-primary/5 shadow-warm" : "border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"}`}
                >
                  <p className="font-display text-base font-bold">{t.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {page.is_paid && t.price > 0 ? `${page.currency} ${Number(t.price).toLocaleString()}` : "Free"}
                  </p>
                  {perks?.[t.key]?.length ? (
                    <ul className="mt-2 space-y-1">
                      {perks[t.key].slice(0, 4).map((p, i) => (
                        <li key={i} className="flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" /><span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
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