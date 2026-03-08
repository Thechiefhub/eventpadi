/**
 * The Chase Module — Sponsor Discovery, AI Insights & Pitch Generator
 *
 * Features:
 * - Search sponsors from curated DB (50+ African market sponsors)
 * - Filter by country, industry, keyword
 * - Manual sponsor entry
 * - AI-generated "why they fit" insights per sponsor
 * - Personalized pitch letter generator with tone/focus/custom instructions
 * - Partnership tracker (CRM) with status management
 * - Offline caching of sponsor list
 */

import { useState, useEffect, useCallback } from "react";
import {
  Handshake, Search, FileText, Building2, Globe, Mail, ExternalLink,
  Loader2, Copy, Clock, Send, Trash2, MessageCircle, Plus, Sparkles,
  Star, ChevronDown, RefreshCw, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface Sponsor {
  id: string;
  name: string;
  country: string;
  industry: string;
  sponsor_type: string;
  past_sponsorships: string | null;
  website: string | null;
  contact_info: string | null;
  is_custom: boolean;
}

interface SponsorInsight {
  fit_score: number;
  headline: string;
  reasons: string[];
  approach_tip: string;
}

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

const COUNTRIES = [
  "Pan-African", "Nigeria", "Kenya", "South Africa", "Ghana", "Ethiopia",
  "Senegal", "Tanzania", "Uganda", "Rwanda", "Egypt",
];

const INDUSTRIES = [
  "Telecommunications", "Banking & Finance", "Technology", "Fintech",
  "Beverages", "FMCG", "Energy", "Media & Entertainment", "Aviation",
  "Insurance", "Retail", "Philanthropy", "E-commerce", "Ride-hailing",
  "Infrastructure", "Development Finance",
];

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  contacted: "bg-primary/15 text-primary",
  "follow-up": "bg-[hsl(var(--sunset-gold))]/15 text-[hsl(var(--sunset-gold))]",
  confirmed: "bg-[hsl(var(--earth-green))]/15 text-[hsl(var(--earth-green))]",
  declined: "bg-destructive/15 text-destructive",
};

const statusOptions = ["draft", "contacted", "follow-up", "confirmed", "declined"];
const CACHE_KEY = "chase_sponsors_cache";

export default function ChaseModule() {
  const { user } = useAuth();

  // Sponsor search state
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorsLoading, setSponsorsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");

  // Manual entry
  const [manualName, setManualName] = useState("");
  const [manualCountry, setManualCountry] = useState("Nigeria");
  const [manualIndustry, setManualIndustry] = useState("Technology");
  const [addingManual, setAddingManual] = useState(false);

  // Insight dialog
  const [insightSponsor, setInsightSponsor] = useState<Sponsor | null>(null);
  const [insight, setInsight] = useState<SponsorInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  // Events & CRM
  const [events, setEvents] = useState<{ id: string; name: string; event_type: string | null; city: string | null; event_date: string | null }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [contacts, setContacts] = useState<SponsorContact[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);

  // Pitch dialog
  const [pitchOpen, setPitchOpen] = useState(false);
  const [pitchSponsor, setPitchSponsor] = useState<Sponsor | null>(null);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [tier, setTier] = useState("Gold");
  const [tone, setTone] = useState("formal");
  const [focus, setFocus] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitch, setPitch] = useState<PitchResult | null>(null);

  // Load sponsors
  useEffect(() => {
    const loadSponsors = async () => {
      setSponsorsLoading(true);
      try {
        const { data, error } = await supabase
          .from("sponsors")
          .select("id, name, country, industry, sponsor_type, past_sponsorships, website, contact_info, is_custom")
          .order("name");
        if (error) throw error;
        setSponsors(data || []);
        // Cache for offline
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
      } catch {
        // Try cache
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) setSponsors(JSON.parse(cached));
        } catch {}
        toast.error("Failed to load sponsors. Showing cached data.");
      } finally {
        setSponsorsLoading(false);
      }
    };
    loadSponsors();
  }, []);

  // Load events
  useEffect(() => {
    if (!user) return;
    supabase.from("events").select("id, name, event_type, city, event_date").order("created_at", { ascending: false }).then(({ data }) => {
      const evts = data || [];
      setEvents(evts);
      if (evts.length > 0 && !selectedEvent) setSelectedEvent(evts[0].id);
    });
  }, [user]);

  // Load contacts
  const fetchContacts = useCallback(async () => {
    if (!selectedEvent) return;
    setCrmLoading(true);
    const { data } = await supabase
      .from("sponsor_contacts")
      .select("*")
      .eq("event_id", selectedEvent)
      .order("created_at", { ascending: false });
    setContacts(data || []);
    setCrmLoading(false);
  }, [selectedEvent]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Filter sponsors with relevance sorting
  const filtered = sponsors
    .filter((s) => {
      const q = search.toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q) || (s.past_sponsorships || "").toLowerCase().includes(q);
      const matchCountry = countryFilter === "all" || s.country === countryFilter;
      const matchIndustry = industryFilter === "all" || s.industry === industryFilter;
      return matchSearch && matchCountry && matchIndustry;
    })
    .sort((a, b) => {
      // Country match first if filter set
      if (countryFilter !== "all") {
        if (a.country === countryFilter && b.country !== countryFilter) return -1;
        if (b.country === countryFilter && a.country !== countryFilter) return 1;
      }
      return a.name.localeCompare(b.name);
    });

  // Manual sponsor entry
  const addManualSponsor = async () => {
    if (!manualName.trim() || !user) return;
    setAddingManual(true);
    try {
      const { data, error } = await supabase.from("sponsors").insert({
        name: manualName.trim(),
        country: manualCountry,
        industry: manualIndustry,
        sponsor_type: "corporate",
        is_custom: true,
        added_by: user.id,
      }).select().single();
      if (error) throw error;
      setSponsors((prev) => [...prev, data as Sponsor]);
      setManualName("");
      toast.success(`"${data.name}" added to your sponsor list!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to add sponsor.");
    } finally {
      setAddingManual(false);
    }
  };

  // Generate AI insight
  const generateInsight = async (sponsor: Sponsor) => {
    setInsightSponsor(sponsor);
    setInsight(null);
    setInsightLoading(true);
    const evt = events.find((e) => e.id === selectedEvent);
    try {
      const { data, error } = await supabase.functions.invoke("chase-pitch", {
        body: {
          mode: "insight",
          sponsor_name: sponsor.name,
          sponsor_industry: sponsor.industry,
          sponsor_country: sponsor.country,
          sponsor_past: sponsor.past_sponsorships,
          event_name: evt?.name,
          event_type: evt?.event_type,
          event_location: evt?.city,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setInsight(data as SponsorInsight);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate insight.");
      setInsightSponsor(null);
    } finally {
      setInsightLoading(false);
    }
  };

  // Open pitch dialog
  const openPitchDialog = (sponsor: Sponsor) => {
    setPitchSponsor(sponsor);
    setPitch(null);
    setFocus("");
    setCustomInstructions("");
    const evt = events.find((e) => e.id === selectedEvent);
    if (evt) {
      setEventName(evt.name);
      setEventCity(evt.city || "");
      setEventDate(evt.event_date || "");
    }
    setPitchOpen(true);
  };

  // Generate pitch
  const generatePitch = async () => {
    if (!pitchSponsor) return;
    setPitchLoading(true);
    setPitch(null);
    try {
      const { data, error } = await supabase.functions.invoke("chase-pitch", {
        body: {
          mode: "pitch",
          sponsor_name: pitchSponsor.name,
          sponsor_category: pitchSponsor.industry,
          sponsor_country: pitchSponsor.country,
          sponsor_insight: pitchSponsor.past_sponsorships,
          event_name: eventName,
          event_date: eventDate,
          event_city: eventCity,
          tier,
          tone,
          focus: focus || undefined,
          custom_instructions: customInstructions || undefined,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setPitch(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate pitch letter.");
    } finally {
      setPitchLoading(false);
    }
  };

  // Save sponsor contact
  const saveSponsorContact = async (status: string) => {
    if (!user || !selectedEvent || !pitchSponsor || !pitch) return;
    try {
      const { error } = await supabase.from("sponsor_contacts").insert({
        user_id: user.id,
        event_id: selectedEvent,
        sponsor_name: pitchSponsor.name,
        tier,
        status,
        pitch_letter: `Subject: ${pitch.subject_line}\n\n${pitch.letter}`,
        contacted_at: status === "contacted" ? new Date().toISOString() : null,
        follow_up_date: status === "contacted" ? new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0] : null,
      });
      if (error) throw error;
      toast.success(`${pitchSponsor.name} saved as "${status}"!`);
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
    toast.success(`${label} copied!`);
  };

  const deleteCustomSponsor = async (id: string) => {
    const { error } = await supabase.from("sponsors").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { setSponsors((prev) => prev.filter((s) => s.id !== id)); toast.success("Sponsor removed"); }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Handshake className="h-7 w-7 text-primary" /> The Chase
        </h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Find sponsors, generate AI pitch letters & track partnerships.
        </p>
      </div>

      <Tabs defaultValue="database" className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="database">Sponsor Database</TabsTrigger>
          <TabsTrigger value="tracker">
            Partnership Tracker
            {contacts.length > 0 && <Badge variant="secondary" className="ml-2 text-xs">{contacts.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ─── Sponsor Database ─── */}
        <TabsContent value="database" className="mt-6 space-y-5">
          {/* Search & Filters */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search sponsors by name, industry, or keyword…"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <Globe className="h-3.5 w-3.5 mr-1" />
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={industryFilter} onValueChange={setIndustryFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <Building2 className="h-3.5 w-3.5 mr-1" />
                    <SelectValue placeholder="Industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Manual Entry */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border">
                <Input
                  placeholder="Add a sponsor manually…"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="flex-1"
                />
                <Select value={manualCountry} onValueChange={setManualCountry}>
                  <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={manualIndustry} onValueChange={setManualIndustry}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={addManualSponsor}
                  disabled={!manualName.trim() || addingManual}
                  className="shrink-0"
                >
                  {addingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {sponsorsLoading ? "Loading…" : `${filtered.length} sponsor${filtered.length !== 1 ? "s" : ""} found`}
            </p>
          </div>

          {/* Sponsor Cards */}
          {sponsorsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No sponsors match your search. Try different filters or add one manually.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((sponsor) => (
                <Card key={sponsor.id} className="border-border hover:shadow-[var(--shadow-warm)] transition-all">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2.5 shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display font-semibold text-foreground truncate">{sponsor.name}</h3>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            <Badge variant="secondary" className="text-[10px]">{sponsor.industry}</Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Globe className="h-2.5 w-2.5" />{sponsor.country}
                            </span>
                            {sponsor.is_custom && <Badge variant="outline" className="text-[10px]">Custom</Badge>}
                          </div>
                        </div>
                      </div>
                    </div>
                    {sponsor.past_sponsorships && (
                      <p className="text-xs text-muted-foreground italic line-clamp-2">"{sponsor.past_sponsorships}"</p>
                    )}
                    {sponsor.contact_info && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Mail className="h-3 w-3" /> {sponsor.contact_info}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button variant="hero" size="sm" className="flex-1" onClick={() => openPitchDialog(sponsor)}>
                        <FileText className="h-3.5 w-3.5 mr-1" /> Write Pitch
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => generateInsight(sponsor)}>
                        <Sparkles className="h-3.5 w-3.5 mr-1" /> Insight
                      </Button>
                      {sponsor.website && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={sponsor.website} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {sponsor.is_custom && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteCustomSponsor(sponsor.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Partnership Tracker ─── */}
        <TabsContent value="tracker" className="mt-6 space-y-5">
          {events.length > 0 ? (
            <>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select an event" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {contacts.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {statusOptions.map((s) => (
                    <Card key={s} className="border-border">
                      <CardContent className="p-3 text-center">
                        <p className="text-xl font-display font-bold text-foreground">{contacts.filter((c) => c.status === s).length}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{s}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {crmLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : contacts.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="p-8 text-center space-y-2">
                    <Handshake className="h-10 w-10 mx-auto text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">No sponsors tracked yet. Write a pitch and save it here.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <Card key={contact.id} className="border-border">
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="rounded-lg bg-muted p-2 shrink-0"><Building2 className="h-4 w-4 text-primary" /></div>
                          <div className="min-w-0">
                            <h4 className="font-display font-semibold text-foreground truncate">{contact.sponsor_name}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px] capitalize">{contact.tier}</Badge>
                              {contact.contacted_at && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Send className="h-2.5 w-2.5" /> {format(new Date(contact.contacted_at), "MMM d")}
                                </span>
                              )}
                              {contact.follow_up_date && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" /> Follow up: {contact.follow_up_date}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {contact.pitch_letter && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => {
                                const lines = contact.pitch_letter!.split("\n\n");
                                const subject = encodeURIComponent(lines[0]?.replace("Subject: ", "") || contact.sponsor_name);
                                const body = encodeURIComponent(lines.slice(1).join("\n\n"));
                                window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
                              }}><Mail className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                const text = encodeURIComponent(contact.pitch_letter!);
                                window.open(`https://wa.me/?text=${text}`, "_blank");
                              }}><MessageCircle className="h-4 w-4" /></Button>
                            </>
                          )}
                          <Select value={contact.status || "draft"} onValueChange={(v) => updateContactStatus(contact.id, v)}>
                            <SelectTrigger className={`w-28 text-xs capitalize ${statusColors[contact.status || "draft"]}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteContact(contact.id)}>
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
              <CardContent className="p-6 text-center text-muted-foreground">Create an event first to track sponsor partnerships.</CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── AI Insight Dialog ─── */}
      <Dialog open={!!insightSponsor} onOpenChange={(o) => { if (!o) setInsightSponsor(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[hsl(var(--sunset-gold))]" />
              {insightSponsor?.name} — Fit Analysis
            </DialogTitle>
          </DialogHeader>
          {insightLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing sponsor fit…
            </div>
          ) : insight ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i < insight.fit_score ? "fill-[hsl(var(--sunset-gold))] text-[hsl(var(--sunset-gold))]" : "text-border"}`} />
                  ))}
                </div>
                <span className="text-sm font-bold text-foreground">{insight.fit_score}/10</span>
              </div>
              <p className="font-display font-semibold text-foreground">{insight.headline}</p>
              <ul className="space-y-1.5">
                {insight.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-primary mt-0.5 shrink-0">✓</span> {r}
                  </li>
                ))}
              </ul>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground font-medium mb-1">💡 Approach Tip</p>
                <p className="text-sm text-foreground">{insight.approach_tip}</p>
              </div>
              <Button variant="hero" className="w-full" onClick={() => { setInsightSponsor(null); openPitchDialog(insightSponsor!); }}>
                <FileText className="h-4 w-4 mr-1" /> Write Pitch for {insightSponsor?.name}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ─── Pitch Generator Dialog ─── */}
      <Dialog open={pitchOpen} onOpenChange={setPitchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Pitch for {pitchSponsor?.name}
            </DialogTitle>
          </DialogHeader>

          {!pitch ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Event Name</Label>
                  <Input placeholder="e.g. AfroTech Lagos 2026" value={eventName} onChange={(e) => setEventName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Event Date</Label>
                  <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Event City</Label>
                  <Input placeholder="e.g. Lagos, Nigeria" value={eventCity} onChange={(e) => setEventCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sponsorship Tier</Label>
                  <Select value={tier} onValueChange={setTier}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Platinum", "Gold", "Silver", "Bronze", "Media Partner"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tone</Label>
                <div className="flex gap-2">
                  {["formal", "friendly", "urgent"].map((t) => (
                    <Badge
                      key={t}
                      variant={tone === t ? "default" : "outline"}
                      className={`cursor-pointer capitalize ${tone === t ? "gradient-sunset text-primary-foreground border-transparent" : ""}`}
                      onClick={() => setTone(t)}
                    >{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Focus Area (optional)</Label>
                <Input placeholder="e.g. brand visibility, CSR alignment, developer community" value={focus} onChange={(e) => setFocus(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label>Custom Instructions (optional)</Label>
                  <Tooltip>
                    <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent><p className="text-xs max-w-[200px]">Try "mention their recent campaign" or "highlight our 5000+ attendees"</p></TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  placeholder="Any specific points to include or avoid…"
                  rows={2}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
              </div>
              <Button variant="hero" className="w-full" onClick={generatePitch} disabled={pitchLoading}>
                {pitchLoading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…</> : <><FileText className="h-4 w-4 mr-1" /> Generate Pitch Letter</>}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subject Line</Label>
                <div className="flex items-center gap-2 rounded-lg border border-border p-3 bg-muted/50">
                  <p className="flex-1 font-medium text-foreground text-sm">{pitch.subject_line}</p>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(pitch.subject_line, "Subject")}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Pitch Letter</Label>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => copyToClipboard(pitch.letter, "Letter")}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
                </div>
                <div className="rounded-lg border border-border p-4 bg-card whitespace-pre-line text-sm text-foreground leading-relaxed max-h-[300px] overflow-y-auto">
                  {pitch.letter}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Benefits ({tier})</Label>
                <ul className="space-y-1">
                  {pitch.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground"><span className="text-primary mt-0.5">•</span> {b}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Follow-up Suggestion</Label>
                <div className="rounded-lg border border-border p-3 bg-muted/50 text-sm text-muted-foreground italic">{pitch.follow_up_suggestion}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                  const subject = encodeURIComponent(pitch.subject_line);
                  const body = encodeURIComponent(pitch.letter);
                  window.open(`mailto:${pitchSponsor?.contact_info || ""}?subject=${subject}&body=${body}`, "_blank");
                }}><Mail className="h-3.5 w-3.5 mr-1" /> Email</Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                  const text = encodeURIComponent(`${pitch.subject_line}\n\n${pitch.letter}`);
                  window.open(`https://wa.me/?text=${text}`, "_blank");
                }}><MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp</Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setPitch(null)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
                </Button>
                {selectedEvent ? (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => saveSponsorContact("draft")}>Save as Draft</Button>
                    <Button variant="hero" className="flex-1" onClick={() => saveSponsorContact("contacted")}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Mark Contacted
                    </Button>
                  </>
                ) : (
                  <Button variant="hero" className="flex-1" onClick={() => copyToClipboard(`Subject: ${pitch.subject_line}\n\n${pitch.letter}`, "Full pitch")}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy Full Pitch
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
