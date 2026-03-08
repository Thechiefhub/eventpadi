/**
 * Visual Identity Studio — AI-powered event poster concept generator.
 * Lets users describe their event visual, pick pattern styles & color moods,
 * then generates poster concepts via Gemini image model.
 */

import { useState } from "react";
import { Sparkles, Palette, Download, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PATTERN_STYLES = [
  { label: "Ankara", icon: "🟠" },
  { label: "Kente", icon: "🟡" },
  { label: "Mudcloth", icon: "🟤" },
  { label: "Shweshwe", icon: "🔵" },
  { label: "Geometric", icon: "🔷" },
  { label: "Minimalist", icon: "⬜" },
];

const COLOR_MOODS = [
  { label: "Warm Sunset", value: "Warm sunset tones — orange, gold, deep amber" },
  { label: "Deep Indigo", value: "Deep indigo and navy with electric blue accents" },
  { label: "Earth Tones", value: "Rich earth tones — terracotta, olive green, warm brown" },
  { label: "Vibrant Festival", value: "Vibrant festival palette — hot pink, yellow, teal, purple" },
  { label: "Monochrome Luxe", value: "Sophisticated monochrome — black, white, gold accents" },
  { label: "Forest Green", value: "Lush forest green with copper and cream accents" },
];

interface GeneratedImage {
  url: string;
  path: string;
}

export default function VisualIdentityStudio() {
  const [description, setDescription] = useState("");
  const [eventName, setEventName] = useState("");
  const [selectedPattern, setSelectedPattern] = useState("Geometric");
  const [selectedMood, setSelectedMood] = useState(COLOR_MOODS[0].value);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error("Please describe your event visual first.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("spark-visual", {
        body: {
          description,
          patternStyle: selectedPattern,
          colorMood: selectedMood,
          eventName: eventName || undefined,
          count: 3,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setImages(data.images || []);
      toast.success(`Generated ${data.images?.length || 0} poster concepts!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate visuals. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `event-visual-${index + 1}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Image downloaded!");
    } catch {
      toast.error("Failed to download image.");
    }
  };

  const handleDelete = async (image: GeneratedImage, index: number) => {
    try {
      await supabase.storage.from("generated-visuals").remove([image.path]);
      setImages((prev) => prev.filter((_, i) => i !== index));
      toast.info("Visual removed.");
    } catch {
      toast.error("Failed to delete image.");
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" /> Visual Identity Studio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Event Name (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="vis-event-name">Event Name (optional)</Label>
          <Input
            id="vis-event-name"
            placeholder="e.g. AfriTech Summit 2026"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="vis-description">Describe your event visual</Label>
          <Textarea
            id="vis-description"
            placeholder="e.g. A modern fintech conference in Lagos with skyscrapers and traditional motifs blending technology and heritage"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Pattern Style */}
        <div className="space-y-1.5">
          <Label>Pattern Style</Label>
          <div className="flex flex-wrap gap-2">
            {PATTERN_STYLES.map((p) => (
              <Badge
                key={p.label}
                variant={selectedPattern === p.label ? "default" : "outline"}
                className="cursor-pointer hover:bg-muted transition-colors text-sm px-3 py-1"
                onClick={() => setSelectedPattern(p.label)}
              >
                <span className="mr-1">{p.icon}</span> {p.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Color Mood */}
        <div className="space-y-1.5">
          <Label>Color Mood</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {COLOR_MOODS.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => setSelectedMood(m.value)}
                className={`rounded-lg border px-3 py-2 text-xs text-left transition-all ${
                  selectedMood === m.value
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          variant="hero"
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1" /> Generate Visuals
            </>
          )}
        </Button>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-lg bg-muted border border-border animate-pulse flex items-center justify-center"
              >
                <div className="text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-40" />
                  <p className="text-xs">Generating concept {i}…</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && images.length > 0 && (
          <div className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground font-medium">
              Generated {images.length} concept{images.length > 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img, i) => (
                <div key={i} className="group relative rounded-lg overflow-hidden border border-border bg-card">
                  <img
                    src={img.url}
                    alt={`Event visual concept ${i + 1}`}
                    className="w-full aspect-[3/4] object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-end justify-center pb-3 gap-2 opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(img.url, i)}
                      className="text-xs"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(img, i)}
                      className="text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && images.length === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground"
              >
                <div className="text-center">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Concept {i}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
