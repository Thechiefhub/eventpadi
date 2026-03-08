import { useState } from "react";
import { Handshake, Search, FileText, Building2, Globe, Mail, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function ChaseModule() {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [category, setCategory] = useState("all");

  const filtered = sponsors.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchCountry = country === "all" || s.country === country;
    const matchCategory = category === "all" || s.category === category;
    return matchSearch && matchCountry && matchCategory;
  });

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
                <Button variant="hero" size="sm" className="flex-1">
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
    </div>
  );
}
