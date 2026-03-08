/**
 * SparkForm — Multi-step form for collecting rich event naming context.
 * Steps: Fundamentals → Brand Personality → Creative Direction → Constraints → Cultural Guidance
 */

import { useState } from "react";
import {
  Sparkles, ChevronRight, ChevronLeft, Globe, Users, MapPin,
  Palette, Target, ShieldAlert, Languages, Lightbulb, Heart,
  Zap, Crown, Flame, Compass, Star, TreePine, Megaphone, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SparkContext {
  topic: string;
  eventType: string;
  audienceSize: string;
  location: string;
  audience: string;
  brandPersonality: string[];
  creativeDimensions: string;
  emotionalResponse: string;
  wordsToAvoid: string;
  lengthPreference: string;
  languages: string;
  competitors: string;
  lovedNames: string;
  dislikedNames: string;
  namePreferenceReason: string;
  culturalConcepts: string;
  sensitivities: string;
}

const defaultContext: SparkContext = {
  topic: "",
  eventType: "conference",
  audienceSize: "200-500",
  location: "",
  audience: "",
  brandPersonality: [],
  creativeDimensions: "",
  emotionalResponse: "Inspired and energized",
  wordsToAvoid: "Innovation, Summit, Future, Africa, Connect, Tech, Disrupt, Empower, Nexus, Synergy",
  lengthPreference: "2-4 words",
  languages: "English with optional African language elements",
  competitors: "",
  lovedNames: "",
  dislikedNames: "",
  namePreferenceReason: "",
  culturalConcepts: "",
  sensitivities: "",
};

const brandPersonalities = [
  { id: "bold", label: "Bold & Daring", icon: Flame },
  { id: "elegant", label: "Elegant & Premium", icon: Crown },
  { id: "innovative", label: "Innovative", icon: Lightbulb },
  { id: "community", label: "Community-Focused", icon: Users },
  { id: "cultural", label: "Culturally Rooted", icon: Globe },
  { id: "playful", label: "Playful & Fun", icon: Star },
  { id: "inspiring", label: "Inspiring", icon: Compass },
  { id: "authentic", label: "Authentic & Raw", icon: Heart },
  { id: "futuristic", label: "Future-Forward", icon: Zap },
  { id: "grounded", label: "Grounded & Earthy", icon: TreePine },
];

const eventTypes = [
  "conference", "summit", "festival", "workshop", "gala",
  "hackathon", "meetup", "awards", "concert", "exhibition",
];

interface Props {
  onSubmit: (context: SparkContext) => void;
  loading: boolean;
}

export default function SparkForm({ onSubmit, loading }: Props) {
  const [step, setStep] = useState(0);
  const [ctx, setCtx] = useState<SparkContext>(defaultContext);

  const update = (key: keyof SparkContext, value: any) => setCtx((prev) => ({ ...prev, [key]: value }));

  const togglePersonality = (id: string) => {
    setCtx((prev) => ({
      ...prev,
      brandPersonality: prev.brandPersonality.includes(id)
        ? prev.brandPersonality.filter((p) => p !== id)
        : [...prev.brandPersonality, id],
    }));
  };

  const canProceed = () => {
    if (step === 0) return ctx.topic.trim().length > 0;
    return true;
  };

  const steps = [
    { title: "Event Fundamentals", icon: Target },
    { title: "Brand Personality", icon: Palette },
    { title: "Creative Direction", icon: Eye },
    { title: "Constraints & Preferences", icon: ShieldAlert },
    { title: "Cultural Guidance", icon: Languages },
  ];

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <button
            key={s.title}
            onClick={() => i <= step && setStep(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              i === step
                ? "gradient-sunset text-primary-foreground"
                : i < step
                ? "bg-[hsl(var(--earth-green))] text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{s.title}</span>
            <span className="sm:hidden">{i + 1}</span>
          </button>
        ))}
      </div>

      {/* Step 0: Fundamentals */}
      {step === 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Event Topic *
                </Label>
                <Input
                  placeholder="e.g. Women in Tech, Pan-African Fintech, Youth Entrepreneurship"
                  value={ctx.topic}
                  onChange={(e) => update("topic", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5 text-primary" /> Event Type
                </Label>
                <Select value={ctx.eventType} onValueChange={(v) => update("eventType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" /> Target Audience
                </Label>
                <Input
                  placeholder="e.g. Young entrepreneurs, CTOs, Creative professionals"
                  value={ctx.audience}
                  onChange={(e) => update("audience", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" /> Audience Size
                </Label>
                <Select value={ctx.audienceSize} onValueChange={(v) => update("audienceSize", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="<50">Intimate (&lt;50)</SelectItem>
                    <SelectItem value="50-200">Small (50-200)</SelectItem>
                    <SelectItem value="200-500">Medium (200-500)</SelectItem>
                    <SelectItem value="500-2000">Large (500-2,000)</SelectItem>
                    <SelectItem value="2000+">Mega (2,000+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Location
              </Label>
              <Input
                placeholder="e.g. Lagos, Nigeria / Nairobi, Kenya / Virtual"
                value={ctx.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Brand Personality */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">Select the personality traits that best describe your event's brand. Choose 2-4.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {brandPersonalities.map((bp) => {
                const selected = ctx.brandPersonality.includes(bp.id);
                return (
                  <button
                    key={bp.id}
                    onClick={() => togglePersonality(bp.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-center ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary/30 text-muted-foreground"
                    }`}
                  >
                    <bp.icon className={`h-6 w-6 ${selected ? "text-primary" : ""}`} />
                    <span className="text-xs font-medium">{bp.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Creative Direction */}
      {step === 2 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Key Creative Dimensions</Label>
              <Textarea
                placeholder="e.g. The name should evoke both tradition and modernity, feel pan-African rather than country-specific, work well as a verb ('Let's go to ___')"
                value={ctx.creativeDimensions}
                onChange={(e) => update("creativeDimensions", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Desired Emotional Response</Label>
              <Input
                placeholder="e.g. Excitement, pride, curiosity, belonging"
                value={ctx.emotionalResponse}
                onChange={(e) => update("emotionalResponse", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Names You Love (any event/brand)</Label>
                <Textarea
                  placeholder="e.g. TED, Afrotech, Chale Wote, Blankets & Wine"
                  value={ctx.lovedNames}
                  onChange={(e) => update("lovedNames", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Names You Dislike</Label>
                <Textarea
                  placeholder="e.g. Africa Innovation Summit, Future Leaders Forum"
                  value={ctx.dislikedNames}
                  onChange={(e) => update("dislikedNames", e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Why? (What makes names good/bad to you?)</Label>
              <Input
                placeholder="e.g. I love short, punchy names that feel like a movement"
                value={ctx.namePreferenceReason}
                onChange={(e) => update("namePreferenceReason", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Constraints */}
      {step === 3 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Words/Phrases to Avoid</Label>
              <Input
                placeholder="Comma-separated"
                value={ctx.wordsToAvoid}
                onChange={(e) => update("wordsToAvoid", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Pre-filled with commonly overused event words in Africa</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name Length Preference</Label>
                <Select value={ctx.lengthPreference} onValueChange={(v) => update("lengthPreference", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 word">One Word</SelectItem>
                    <SelectItem value="2-3 words">2-3 Words</SelectItem>
                    <SelectItem value="2-4 words">2-4 Words</SelectItem>
                    <SelectItem value="any">Any Length</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language Preference</Label>
                <Select value={ctx.languages} onValueChange={(v) => update("languages", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English only">English Only</SelectItem>
                    <SelectItem value="English with optional African language elements">English + African Elements</SelectItem>
                    <SelectItem value="Primarily African language with English accessibility">Primarily African Language</SelectItem>
                    <SelectItem value="French with African elements">French + African</SelectItem>
                    <SelectItem value="Multilingual blend">Multilingual Blend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Competitor Events (optional)</Label>
              <Textarea
                placeholder="List similar events in your space that you want to differentiate from"
                value={ctx.competitors}
                onChange={(e) => update("competitors", e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Cultural Guidance */}
      {step === 4 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Cultural Concepts to Explore</Label>
              <Textarea
                placeholder="e.g. Ubuntu (togetherness), Sankofa (learning from the past), Harambee (pulling together), Ujamaa (cooperative economics)"
                value={ctx.culturalConcepts}
                onChange={(e) => update("culturalConcepts", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Cultural Sensitivities</Label>
              <Textarea
                placeholder="e.g. Avoid religious references, be mindful of ethnic tensions in [region], don't use sacred symbols"
                value={ctx.sensitivities}
                onChange={(e) => update("sensitivities", e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="hero"
            onClick={() => onSubmit(ctx)}
            disabled={loading || !ctx.topic.trim()}
            className="gap-1.5"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate Names
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
