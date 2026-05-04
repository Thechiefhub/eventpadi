import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEventSelect } from "@/hooks/useEventSelect";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Copy, ExternalLink, Globe, Image as ImageIcon, Loader2, Save, Sparkles, Ticket, Users, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface RegPage {
  id: string;
  event_id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  flyer_url: string | null;
  location: string | null;
  venue_address: string | null;
  start_at: string | null;
  end_at: string | null;
  is_paid: boolean;
  currency: string | null;
  general_price: number | null;
  vip_price: number | null;
  vvip_price: number | null;
  general_enabled: boolean;
  vip_enabled: boolean;
  vvip_enabled: boolean;
  capacity: number | null;
  is_published: boolean;
  contact_email: string | null;
  contact_phone: string | null;
}

interface Registration {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ticket_tier: string;
  admits: number;
  amount: number | null;
  payment_status: string;
  created_at: string;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function RegistrationModule() {
  const { user } = useAuth();
  const { events, selectedEventId, setSelectedEventId, loading: eventsLoading } = useEventSelect();
  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const [page, setPage] = useState<RegPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!selectedEventId || !user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("event_registration_pages")
        .select("*")
        .eq("event_id", selectedEventId)
        .maybeSingle();
      setPage(data as RegPage | null);
      const { data: regs } = await supabase
        .from("event_registrations")
        .select("id,name,email,phone,ticket_tier,admits,amount,payment_status,created_at")
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: false });
      setRegistrations((regs as Registration[]) || []);
      setLoading(false);
    };
    load();
  }, [selectedEventId, user]);

  const ensureDraft = (): RegPage => {
    if (page) return page;
    const base: RegPage = {
      id: "",
      event_id: selectedEventId,
      user_id: user!.id,
      slug: slugify((selectedEvent?.name || "event") + "-" + Math.random().toString(36).slice(2, 6)),
      title: selectedEvent?.name || "",
      description: "",
      flyer_url: null,
      location: [selectedEvent?.city, selectedEvent?.country].filter(Boolean).join(", ") || null,
      venue_address: null,
      start_at: selectedEvent?.event_date ? `${selectedEvent.event_date}T18:00` : null,
      end_at: null,
      is_paid: false,
      currency: "NGN",
      general_price: 0,
      vip_price: 0,
      vvip_price: 0,
      general_enabled: true,
      vip_enabled: false,
      vvip_enabled: false,
      capacity: null,
      is_published: false,
      contact_email: null,
      contact_phone: null,
    };
    setPage(base);
    return base;
  };

  useEffect(() => { if (selectedEventId && !page && !loading) ensureDraft(); /* eslint-disable-next-line */ }, [selectedEventId, loading]);

  const update = (patch: Partial<RegPage>) => setPage((p) => (p ? { ...p, ...patch } : p));

  const handleFlyerUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${selectedEventId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("event-flyers").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("event-flyers").getPublicUrl(path);
      update({ flyer_url: data.publicUrl });
      toast.success("Flyer uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async (publish?: boolean) => {
    if (!page || !user) return;
    if (!page.title.trim()) { toast.error("Title is required"); return; }
    if (!page.slug.trim()) { toast.error("Link slug is required"); return; }
    setSaving(true);
    const payload = {
      ...page,
      slug: slugify(page.slug),
      user_id: user.id,
      event_id: selectedEventId,
      is_published: publish ?? page.is_published,
    };
    const { id, ...rest } = payload;
    let resp;
    if (id) {
      resp = await supabase.from("event_registration_pages").update(rest).eq("id", id).select().single();
    } else {
      resp = await supabase.from("event_registration_pages").insert(rest).select().single();
    }
    if (resp.error) {
      toast.error(resp.error.message);
    } else {
      setPage(resp.data as RegPage);
      toast.success(publish === true ? "Published! Share your link." : publish === false ? "Unpublished" : "Saved");
    }
    setSaving(false);
  };

  const shareUrl = page?.slug ? `${window.location.origin}/r/${page.slug}` : "";

  const counts = {
    general: registrations.filter((r) => r.ticket_tier === "general").reduce((a, r) => a + r.admits, 0),
    vip: registrations.filter((r) => r.ticket_tier === "vip").reduce((a, r) => a + r.admits, 0),
    vvip: registrations.filter((r) => r.ticket_tier === "vvip").reduce((a, r) => a + r.admits, 0),
  };

  if (eventsLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (events.length === 0) {
    return (
      <div className="p-6 text-center">
        <ClipboardList className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-40" />
        <p className="font-display text-lg">No events yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Create an event first to set up registration.</p>
      </div>
    );
  }
  if (!page) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold md:text-2xl">Event Registration</h1>
        </div>
        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {events.map((ev) => (<SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {page.is_published && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-primary">Live registration link</p>
              <p className="truncate font-mono text-sm">{shareUrl}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Copied"); }}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(shareUrl, "_blank")}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="setup">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="setup"><Sparkles className="mr-1 h-4 w-4" />Setup</TabsTrigger>
          <TabsTrigger value="tickets"><Ticket className="mr-1 h-4 w-4" />Tickets</TabsTrigger>
          <TabsTrigger value="registrations"><Users className="mr-1 h-4 w-4" />Registrations ({registrations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Event Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Event Title *</Label>
                  <Input value={page.title} onChange={(e) => update({ title: e.target.value })} maxLength={120} />
                </div>
                <div className="space-y-1.5">
                  <Label>Public Link Slug *</Label>
                  <div className="flex items-center gap-1 rounded-md border bg-muted/30 px-2">
                    <span className="text-xs text-muted-foreground">/r/</span>
                    <Input className="border-0 bg-transparent px-1 focus-visible:ring-0" value={page.slug} onChange={(e) => update({ slug: slugify(e.target.value) })} maxLength={60} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>About this event</Label>
                <Textarea rows={4} value={page.description || ""} onChange={(e) => update({ description: e.target.value })} placeholder="Tell attendees what to expect, who should attend, agenda highlights..." maxLength={2000} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>City / Region</Label>
                  <Input value={page.location || ""} onChange={(e) => update({ location: e.target.value })} placeholder="e.g. Lagos, Nigeria" />
                </div>
                <div className="space-y-1.5">
                  <Label>Venue Address</Label>
                  <Input value={page.venue_address || ""} onChange={(e) => update({ venue_address: e.target.value })} placeholder="Full venue address" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Starts</Label>
                  <Input type="datetime-local" value={page.start_at?.slice(0, 16) || ""} onChange={(e) => update({ start_at: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ends</Label>
                  <Input type="datetime-local" value={page.end_at?.slice(0, 16) || ""} onChange={(e) => update({ end_at: e.target.value })} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Contact Email</Label>
                  <Input type="email" value={page.contact_email || ""} onChange={(e) => update({ contact_email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Phone</Label>
                  <Input value={page.contact_phone || ""} onChange={(e) => update({ contact_phone: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Capacity (optional)</Label>
                <Input type="number" min={0} value={page.capacity ?? ""} onChange={(e) => update({ capacity: e.target.value ? parseInt(e.target.value, 10) : null })} placeholder="Leave blank for unlimited" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" />Event Flyer</CardTitle>
              <CardDescription>This is the hero image attendees see first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {page.flyer_url ? (
                <div className="relative overflow-hidden rounded-lg border">
                  <img src={page.flyer_url} alt="Event flyer" className="max-h-72 w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">No flyer uploaded</div>
              )}
              <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFlyerUpload(f); }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Pricing</CardTitle>
              <CardDescription>Choose free or paid event, then enable each ticket tier.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Paid event</Label>
                  <p className="text-xs text-muted-foreground">Toggle off for free admission</p>
                </div>
                <Switch checked={page.is_paid} onCheckedChange={(v) => update({ is_paid: v })} />
              </div>

              {page.is_paid && (
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={page.currency || "NGN"} onValueChange={(v) => update({ currency: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["NGN","KES","GHS","ZAR","UGX","TZS","RWF","USD","EUR","GBP"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {[
                { key: "general", label: "General", desc: "Standard admission" },
                { key: "vip", label: "VIP", desc: "Premium experience" },
                { key: "vvip", label: "VVIP", desc: "Top-tier exclusive access" },
              ].map((t) => {
                const enabledKey = `${t.key}_enabled` as keyof RegPage;
                const priceKey = `${t.key}_price` as keyof RegPage;
                return (
                  <div key={t.key} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-display font-semibold">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.desc}</p>
                      </div>
                      <Switch checked={!!page[enabledKey]} onCheckedChange={(v) => update({ [enabledKey]: v } as any)} />
                    </div>
                    {page.is_paid && page[enabledKey] && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Price ({page.currency})</Label>
                        <Input type="number" min={0} step="0.01" value={(page[priceKey] as number) ?? 0} onChange={(e) => update({ [priceKey]: parseFloat(e.target.value) || 0 } as any)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">General</p><p className="font-display text-2xl font-bold">{counts.general}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">VIP</p><p className="font-display text-2xl font-bold text-accent-foreground">{counts.vip}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">VVIP</p><p className="font-display text-2xl font-bold text-primary">{counts.vvip}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-0">
              {registrations.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No registrations yet. Share your link to start collecting sign-ups.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Admits</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell><Badge variant={r.ticket_tier === "vvip" ? "default" : r.ticket_tier === "vip" ? "secondary" : "outline"}>{r.ticket_tier.toUpperCase()}</Badge></TableCell>
                        <TableCell>{r.admits}</TableCell>
                        <TableCell className="text-xs">{r.email || r.phone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background/95 p-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-lg sm:border">
        <div className="flex-1 text-xs text-muted-foreground">
          {page.is_published ? <span className="inline-flex items-center gap-1 text-primary"><Globe className="h-3.5 w-3.5" />Published</span> : <span className="inline-flex items-center gap-1"><EyeOff className="h-3.5 w-3.5" />Draft</span>}
        </div>
        <Button variant="outline" disabled={saving} onClick={() => save()}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save
        </Button>
        {page.is_published ? (
          <Button variant="secondary" disabled={saving} onClick={() => save(false)}><EyeOff className="mr-1 h-4 w-4" />Unpublish</Button>
        ) : (
          <Button className="gradient-sunset text-primary-foreground" disabled={saving} onClick={() => save(true)}><Eye className="mr-1 h-4 w-4" />Publish</Button>
        )}
      </div>
    </div>
  );
}