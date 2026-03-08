import { useState } from "react";
import { Handshake, Search, FileText, Building2, Globe, Mail, ExternalLink, Loader2, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface SelectedSponsor {
  name: string;
  category: string;
  country: string;
  insight: string;
}

export default function ChaseModule() {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [category, setCategory] = useState("all");

  // Pitch dialog state
  const [pitchOpen, setPitchOpen] = useState(false);
  const [selectedSponsor, setSelectedSponsor] = useState<SelectedSponsor | null>(null);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [tier, setTier] = useState("Gold");
  const [tone, setTone] = useState("formal");
  const [loading, setLoading] = useState(false);
  const [pitch, setPitch] = useState<PitchResult | null>(null);

  const filtered = sponsors.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchCountry = country === "all" || s.country === country;
    const matchCategory = category === "all" || s.category === category;
    return matchSearch && matchCountry && matchCategory;
  });

  const openPitchDialog = (sponsor: SelectedSponsor) => {
    setSelectedSponsor(sponsor);
    setPitch(null);
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

      {/* Filters */}
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

      {/* Sponsor List */}
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
              {/* Subject Line */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subject Line</Label>
                <div className="flex items-center gap-2 rounded-lg border border-border p-3 bg-muted/50">
                  <p className="flex-1 font-medium text-foreground">{pitch.subject_line}</p>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(pitch.subject_line, "Subject line")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Letter */}
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

              {/* Benefits */}
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

              {/* Follow-up */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Suggested Follow-up (5 days later)</Label>
                <div className="rounded-lg border border-border p-3 bg-muted/50 text-sm text-muted-foreground italic">
                  {pitch.follow_up_suggestion}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setPitch(null)}>
                  Regenerate
                </Button>
                <Button
                  variant="hero"
                  className="flex-1"
                  onClick={() => copyToClipboard(`Subject: ${pitch.subject_line}\n\n${pitch.letter}`, "Full pitch")}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy Full Pitch
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
