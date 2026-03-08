import { useState } from "react";
import { Sparkles, Wand2, Palette, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sampleNames = [
  "AfriSpark Summit", "Ubuntu Connect", "Innovate Nairobi",
  "The Baobab Forum", "Savanna Tech Fest", "Nkosi Innovation Days",
  "Wakanda Builders", "Kente Code Con", "Sahel Futures", "Jamii Converge",
];

const sampleTaglines = [
  "Where African innovation meets global impact.",
  "Building tomorrow, rooted in today.",
  "Code. Culture. Community.",
  "The future is being built here.",
  "Connecting visionaries across the continent.",
];

const vibes = ["Innovative", "Community", "Premium", "Bold", "Cultural", "Tech-Forward"];

export default function SparkModule() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);

  const toggleVibe = (v: string) => {
    setSelectedVibes((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  };

  const handleGenerate = () => {
    setGenerated(true);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-sunset-gold" /> The Spark
        </h1>
        <p className="text-muted-foreground mt-1">Generate your event's name, theme & visual identity with AI.</p>
      </div>

      <Tabs defaultValue="name" className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="name">Name & Theme</TabsTrigger>
          <TabsTrigger value="visual">Visual Identity</TabsTrigger>
        </TabsList>

        <TabsContent value="name" className="mt-6 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" /> AI Name Generator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Event Topic</Label>
                  <Input placeholder="e.g. Women in Tech" value={topic} onChange={(e) => setTopic(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Input placeholder="e.g. Young entrepreneurs" value={audience} onChange={(e) => setAudience(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Desired Vibe</Label>
                <div className="flex flex-wrap gap-2">
                  {vibes.map((v) => (
                    <Badge
                      key={v}
                      variant={selectedVibes.includes(v) ? "default" : "outline"}
                      className={`cursor-pointer transition-all ${selectedVibes.includes(v) ? "gradient-sunset text-primary-foreground border-transparent" : ""}`}
                      onClick={() => toggleVibe(v)}
                    >
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button variant="hero" onClick={handleGenerate} className="mt-2">
                <Sparkles className="h-4 w-4 mr-1" /> Generate Names & Themes
              </Button>
            </CardContent>
          </Card>

          {generated && (
            <div className="space-y-6 animate-fade-up">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Suggested Names</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2">
                    {sampleNames.map((name) => (
                      <button
                        key={name}
                        className="text-left rounded-lg border border-border p-3 hover:border-primary hover:shadow-warm transition-all text-foreground font-display font-medium"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Taglines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sampleTaglines.map((t) => (
                    <p key={t} className="text-muted-foreground border-l-2 border-primary pl-3 py-1">{t}</p>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Theme Statement</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground leading-relaxed">
                    <strong>AfriSpark Summit</strong> is a two-day gathering that brings together Africa's boldest
                    innovators to share ideas, forge partnerships, and build solutions that transform communities.
                    Rooted in the spirit of Ubuntu, we believe that technology thrives when it serves everyone.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="visual" className="mt-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" /> Visual Identity Studio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Describe your event visual</Label>
                <Input placeholder="e.g. A modern fintech conference in Lagos with skyscrapers and traditional motifs" />
              </div>
              <div className="space-y-2">
                <Label>Pattern Style</Label>
                <div className="flex flex-wrap gap-2">
                  {["Ankara", "Kente", "Mudcloth", "Shweshwe", "Geometric", "Minimalist"].map((p) => (
                    <Badge key={p} variant="outline" className="cursor-pointer hover:bg-muted">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button variant="hero">
                <Sparkles className="h-4 w-4 mr-1" /> Generate Visuals
              </Button>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-square rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Palette className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">Generated visual {i}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
