import { useState, useEffect } from "react";
import { Handshake, Search, FileText, Building2, Globe, Mail, ExternalLink, Loader2, Copy, CheckCircle2, Clock, Send, Trash2, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

const sponsors = [
  { name: "MTN Group", category: "Telco", country: "Pan-African", events: 12, contact: "partnerships@mtn.com", insight: "Sponsored AfroTech Lagos 2023 & 2024" },
  { name: "Safaricom", category: "Telco", country: "Kenya", events: 8, contact: "sponsorship@safaricom.co.ke", insight: "Focused on tech & innovation events" },
  { name: "GTBank", category: "Banking", country: "Nigeria", events: 15, contact: "events@gtbank.com", insight: "Major sponsor of Food & Drink Festival" },
  { name: "Standard Bank", category: "Banking", country: "South Africa", events: 10, contact: "sponsorship@standardbank.co.za", insight: "Targets fintech and entrepreneur events" },
  { name: "Coca-Cola Africa", category: "Beverages", country: "Pan-African", events: 20, contact: "africa.sponsorships@coca-cola.com", insight: "Sponsors music, sports & tech events" },
  { name: "Google Africa", category: "Tech", country: "Pan-African", events: 18, contact: "africa-events@google.com", insight: "Runs Google for Africa developer events" },
  { name: "Andela", category: "Tech", country: "Pan-African", events: 6, contact: "partnerships@andela.com", insight: "Focuses on developer communities" },
  { name: "Dangote Foundation", category: "NGO", country: "Nigeria", events: 5, contact: "events@dangote.com", insight: "Supports education & entrepreneurship" },
];

interface PitchResult {
  subject_line: string;
  letter: string;
  benefits: string[];
  follow_up_suggestion: string;
}

interface SponsorContact {
  id: string;
  sponsor_name: string;
  tier: string | null;
  status: string | null;
  pitch_letter: string | null;
  contacted_at: string | null;
  follow_up_date: string | null;
  event_id: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  contacted: "bg-primary/15 text-primary",
  "follow-up": "bg-sunset-gold/15 text-sunset-gold",
  confirmed: "bg-earth-green/15 text-earth-green",
  declined: "bg-destructive/15 text-destructive",
};

const statusOptions = ["draft", "contacted", "follow-up", "confirmed", "declined"];

export default function ChaseModule() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [category, setCategory] = useState("all");

  // Events for CRM
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [contacts, setContacts] = useState<SponsorContact[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);

  // Pitch dialog state
  const [pitchOpen, setPitchOpen] = useState(false);
  const [selectedSponsor, setSelectedSponsor] = useState<typeof sponsors[0] | null>(null);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [tier, setTier] = useState("Gold");
  const [tone, setTone] = useState("formal");
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState<PitchResult | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("events").select("id, name").order("created_at", { ascending: false }).then(({ data }) => {
      const evts = data || [];
      setEvents(evts);
      if (evts.length > 0 && !selectedEvent) setSelectedEvent(evts[0].id);
    });
  }, [user]);

  const fetchContacts = async () => {
    if (!selectedEvent) return;
    setCrmLoading(true);
    const { data } = await supabase
      .from("sponsor_contacts")
      .select("*")
      .eq("event_id", selectedEvent)
      .order("created_at", { ascending: false });
    setContacts(data || []);
    setCrmLoading(false);
  };

  useEffect(() => { fetchContacts(); }, [selectedEvent]);

  const filtered = sponsors.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchCountry = country === "all" || s.country === country;
    const matchCategory = category === "all" || s.category === category;
    return matchSearch && matchCountry && matchCategory;
  });

  const openPitchDialog = (sponsor: typeof sponsors[0]) => {
    setSelectedSponsor(sponsor);
    setPitch(null);
    // Pre-fill event name if we have one selected
    const evt = events.find((e) => e.id === selectedEvent);
    if (evt) setEventName(evt.name);
    setPitchOpen(true);
  };

  const generatePitch = async () => {
    if (!selectedSponsor) return;
    setLoading(true);
    setPitch(null);

    try {
      const { data, error } = await supabase.functions.invoke("chase-pitch", {
        body: {
          sponsor_name: selectedSponsor.name,
          sponsor_category: selectedSponsor.category,
          sponsor_country: selectedSponsor.country,
          sponsor_insight: selectedSponsor.insight,
          event_name: eventName,
          event_date: eventDate,
          event_city: eventCity,
          tier,
          tone,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setPitch(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate pitch letter.");
    } finally {
      setLoading(false);
    }
  };

  const saveSponsorContact = async (status: string) => {
    if (!user || !selectedEvent || !selectedSponsor || !pitch) return;

    try {
      const { error } = await supabase.from("sponsor_contacts").insert({
        user_id: user.id,
        event_id: selectedEvent,
        sponsor_name: selectedSponsor.name,
        tier,
        status,
        pitch_letter: `Subject: ${pitch.subject_line}\n\n${pitch.letter}`,
        contacted_at: status === "contacted" ? new Date().toISOString() : null,
        follow_up_date: status === "contacted"
          ? new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0]
          : null,
      });

      if (error) throw error;
      toast.success(`${selectedSponsor.name} saved as "${status}"!`);
      setPitchOpen(false);
      fetchContacts();
    } catch (e: any) {
      toast.error(e.message || "Failed to save contact.");
    }
  };

  const updateContactStatus = async (id: string, newStatus: string) => {
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === "contacted" && !contacts.find((c) => c.id === id)?.contacted_at) {
      updates.contacted_at = new Date().toISOString();
      updates.follow_up_date = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];
    }
    const { error } = await supabase.from("sponsor_contacts").update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else fetchContacts();
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from("sponsor_contacts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { setContacts((prev) => prev.filter((c) => c.id !== id)); toast.success("Removed"); }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Handshake className="h-7 w-7 text-primary" /> The Chase
        </h1>
        <p className="text-muted-foreground mt-1">Find sponsors, generate pitch letters & track your partnerships.</p>
      </div>

      <Tabs defaultValue="database" className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="database">Sponsor Database</TabsTrigger>
          <TabsTrigger value="tracker">
            Partnership Tracker
            {contacts.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{contacts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Sponsor Database Tab ─── */}
        <TabsContent value="database" className="mt-6 space-y-6">
          <Card className="border-border">
            <CardContent className="p-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search sponsors..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Country" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="Nigeria">Nigeria</SelectItem>
                  <SelectItem value="Kenya">Kenya</SelectItem>
                  <SelectItem value="South Africa">South Africa</SelectItem>
                  <SelectItem value="Pan-African">Pan-African</SelectItem>
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Telco">Telco</SelectItem>
                  <SelectItem value="Banking">Banking</SelectItem>
                  <SelectItem value="Beverages">Beverages</SelectItem>
                  <SelectItem value="Tech">Tech</SelectItem>
                  <SelectItem value="NGO">NGO</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((sponsor) => (
              <Card key={sponsor.name} className="border-border hover:shadow-warm transition-all duration-300">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-muted p-2.5">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-foreground">{sponsor.name}</h3>
                        <div className="flex gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-xs">{sponsor.category}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />{sponsor.country}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">{sponsor.events} events</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{sponsor.insight}"</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" /> {sponsor.contact}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="hero" size="sm" className="flex-1" onClick={() => openPitchDialog(sponsor)}>
                      <FileText className="h-4 w-4 mr-1" /> Write Pitch
                    </Button>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── Partnership Tracker Tab ─── */}
        <TabsContent value="tracker" className="mt-6 space-y-6">
          {events.length > 0 ? (
            <>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger className="w-full md:w-72">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Stats row */}
              {contacts.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {statusOptions.map((s) => {
                    const count = contacts.filter((c) => c.status === s).length;
                    return (
                      <Card key={s} className="border-border">
                        <CardContent className="p-3 text-center">
                          <p className="text-2xl font-display font-bold text-foreground">{count}</p>
                          <p className="text-xs text-muted-foreground capitalize">{s}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {crmLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : contacts.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="p-8 text-center space-y-2">
                    <Handshake className="h-10 w-10 mx-auto text-muted-foreground/40" />
                    <p className="text-muted-foreground">No sponsors tracked yet. Use the Sponsor Database tab to write a pitch and save it here.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <Card key={contact.id} className="border-border">
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="rounded-lg bg-muted p-2">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-display font-semibold text-foreground truncate">{contact.sponsor_name}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs capitalize">{contact.tier}</Badge>
                              {contact.contacted_at && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Send className="h-3 w-3" /> {format(new Date(contact.contacted_at), "MMM d")}
                                </span>
                              )}
                              {contact.follow_up_date && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Follow up: {contact.follow_up_date}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={contact.status || "draft"} onValueChange={(v) => updateContactStatus(contact.id, v)}>
                            <SelectTrigger className={`w-32 text-xs capitalize ${statusColors[contact.status || "draft"]}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => deleteContact(contact.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Card className="border-border">
              <CardContent className="p-6 text-center text-muted-foreground">
                Create an event first to track sponsor partnerships.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Pitch Dialog */}
      <Dialog open={pitchOpen} onOpenChange={setPitchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Pitch Letter for {selectedSponsor?.name}
            </DialogTitle>
          </DialogHeader>

          {!pitch ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Your Event Name</Label>
                  <Input placeholder="e.g. AfroTech Lagos 2026" value={eventName} onChange={(e) => setEventName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Event Date</Label>
                  <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Event City</Label>
                  <Input placeholder="e.g. Lagos, Nigeria" value={eventCity} onChange={(e) => setEventCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Sponsorship Tier</Label>
                  <Select value={tier} onValueChange={setTier}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Platinum">Platinum</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Bronze">Bronze</SelectItem>
                      <SelectItem value="Media Partner">Media Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <div className="flex gap-2">
                  {["formal", "friendly", "urgent"].map((t) => (
                    <Badge
                      key={t}
                      variant={tone === t ? "default" : "outline"}
                      className={`cursor-pointer capitalize ${tone === t ? "gradient-sunset text-primary-foreground border-transparent" : ""}`}
                      onClick={() => setTone(t)}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button variant="hero" className="w-full" onClick={generatePitch} disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating Pitch...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-1" /> Generate Pitch Letter</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subject Line</Label>
                <div className="flex items-center gap-2 rounded-lg border border-border p-3 bg-muted/50">
                  <p className="flex-1 font-medium text-foreground">{pitch.subject_line}</p>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(pitch.subject_line, "Subject line")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Pitch Letter</Label>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(pitch.letter, "Letter")}>
                    <Copy className="h-4 w-4 mr-1" /> Copy
                  </Button>
                </div>
                <div className="rounded-lg border border-border p-4 bg-card whitespace-pre-line text-sm text-foreground leading-relaxed">
                  {pitch.letter}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Sponsor Benefits ({tier})</Label>
                <ul className="space-y-1">
                  {pitch.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary mt-0.5">•</span> {b}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Suggested Follow-up (5 days later)</Label>
                <div className="rounded-lg border border-border p-3 bg-muted/50 text-sm text-muted-foreground italic">
                  {pitch.follow_up_suggestion}
                </div>
              </div>

              {/* Share buttons */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Share Pitch</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const subject = encodeURIComponent(pitch.subject_line);
                      const body = encodeURIComponent(pitch.letter);
                      window.open(`mailto:${selectedSponsor?.contact || ""}?subject=${subject}&body=${body}`, "_blank");
                    }}
                  >
                    <Mail className="h-4 w-4 mr-1" /> Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const text = encodeURIComponent(`${pitch.subject_line}\n\n${pitch.letter}`);
                      window.open(`https://wa.me/?text=${text}`, "_blank");
                    }}
                  >
                    <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setPitch(null)}>
                  Regenerate
                </Button>
                {selectedEvent ? (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => saveSponsorContact("draft")}>
                      Save as Draft
                    </Button>
                    <Button variant="hero" className="flex-1" onClick={() => saveSponsorContact("contacted")}>
                      <Send className="h-4 w-4 mr-1" /> Mark Contacted
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="hero"
                    className="flex-1"
                    onClick={() => copyToClipboard(`Subject: ${pitch.subject_line}\n\n${pitch.letter}`, "Full pitch")}
                  >
                    <Copy className="h-4 w-4 mr-1" /> Copy Full Pitch
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
