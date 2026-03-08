/**
 * NarrativeStudio — Full page for generating narratives + social posts
 * for a selected event name from The Spark module.
 *
 * State is passed via location.state from SparkResults. If missing,
 * redirects back to The Spark.
 */

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles, ArrowLeft, Copy, Check, Loader2, Save, RefreshCw,
  Instagram, Linkedin, Twitter, Facebook, MessageCircle, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEventSelect } from "@/hooks/useEventSelect";
import { toast } from "sonner";
import type { SparkContext } from "@/components/spark/SparkForm";

interface LocationState {
  eventName: string;
  tagline: string;
  rationale: string;
  category: string;
  context: SparkContext;
}

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "twitter", label: "Twitter / X", icon: Twitter },
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
] as const;

const POST_TYPES = [
  { id: "announcement", label: "Event Announcement" },
  { id: "speaker-highlight", label: "Speaker Highlight" },
  { id: "early-bird", label: "Early Bird Promo" },
  { id: "countdown", label: "Countdown" },
  { id: "behind-the-scenes", label: "Behind the Scenes" },
  { id: "recap", label: "Post-Event Recap" },
  { id: "testimonial", label: "Testimonial" },
];

const REFINE_OPTIONS = [
  "Make it shorter",
  "More professional",
  "Add more hashtags",
  "Make it funnier",
  "Add urgency",
  "More emojis",
];

export default function NarrativeStudioPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedEventId } = useEventSelect();
  const state = location.state as LocationState | undefined;

  // Narrative state
  const [narrative, setNarrative] = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState("");

  // Social studio state
  const [platform, setPlatform] = useState("instagram");
  const [postType, setPostType] = useState("announcement");
  const [customInstruction, setCustomInstruction] = useState("");
  const [generatedPost, setGeneratedPost] = useState("");
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState("");
  const [refineLoading, setRefineLoading] = useState(false);
  const [savedPosts, setSavedPosts] = useState<Array<{ platform: string; content: string; postType: string }>>([]);

  // Copy state
  const [copiedNarrative, setCopiedNarrative] = useState(false);
  const [copiedPost, setCopiedPost] = useState(false);

  // Saving state
  const [savingNarrative, setSavingNarrative] = useState(false);
  const [savingPost, setSavingPost] = useState(false);

  // Redirect if no state
  useEffect(() => {
    if (!state?.eventName) {
      navigate("/dashboard/spark", { replace: true });
    }
  }, [state, navigate]);

  const eventName = state?.eventName || "";
  const tagline = state?.tagline || "";
  const rationale = state?.rationale || "";
  const category = state?.category || "";
  const context = state?.context;

  // Generate narrative on mount
  useEffect(() => {
    if (eventName && !narrative) {
      generateNarrative();
    }
  }, [eventName]);

  if (!state?.eventName) return null;

  const generateNarrative = async () => {
    setNarrativeLoading(true);
    setNarrativeError("");
    try {
      const { data, error } = await supabase.functions.invoke("spark-studio", {
        body: { mode: "narrative", eventName, context },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setNarrative(data.content);
    } catch (e: any) {
      setNarrativeError(e.message || "Failed to generate narrative.");
    } finally {
      setNarrativeLoading(false);
    }
  };

  const generatePost = async () => {
    setPostLoading(true);
    setPostError("");
    try {
      const { data, error } = await supabase.functions.invoke("spark-studio", {
        body: {
          mode: "social",
          eventName,
          context,
          platform,
          postType,
          customInstruction: customInstruction || undefined,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setGeneratedPost(data.content);
    } catch (e: any) {
      setPostError(e.message || "Failed to generate post.");
    } finally {
      setPostLoading(false);
    }
  };

  const refinePost = async (instruction: string) => {
    if (!generatedPost) return;
    setRefineLoading(true);
    setPostError("");
    try {
      const { data, error } = await supabase.functions.invoke("spark-studio", {
        body: {
          mode: "refine",
          eventName,
          previousPost: generatedPost,
          refineInstruction: instruction,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setGeneratedPost(data.content);
      toast.success("Post refined!");
    } catch (e: any) {
      setPostError(e.message || "Failed to refine post.");
    } finally {
      setRefineLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: "narrative" | "post") => {
    navigator.clipboard.writeText(text);
    if (type === "narrative") {
      setCopiedNarrative(true);
      setTimeout(() => setCopiedNarrative(false), 1500);
    } else {
      setCopiedPost(true);
      setTimeout(() => setCopiedPost(false), 1500);
    }
    toast.success("Copied to clipboard!");
  };

  const saveNarrative = async () => {
    if (!user || !narrative) return;
    setSavingNarrative(true);
    try {
      const { error } = await supabase.from("spark_narratives").insert({
        user_id: user.id,
        event_id: selectedEventId || null,
        event_name: eventName,
        narrative,
        generation_context: context as any,
      });
      if (error) throw error;
      toast.success("Narrative saved to event!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save narrative.");
    } finally {
      setSavingNarrative(false);
    }
  };

  const savePost = async () => {
    if (!user || !generatedPost) return;
    setSavingPost(true);
    try {
      const { error } = await supabase.from("spark_social_posts").insert({
        user_id: user.id,
        event_id: selectedEventId || null,
        event_name: eventName,
        platform,
        post_type: postType,
        content: generatedPost,
        custom_instruction: customInstruction || null,
      });
      if (error) throw error;
      setSavedPosts((prev) => [...prev, { platform, content: generatedPost, postType }]);
      toast.success("Post saved to event!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save post.");
    } finally {
      setSavingPost(false);
    }
  };

  const PlatformIcon = PLATFORMS.find((p) => p.id === platform)?.icon || Instagram;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-muted-foreground gap-1.5 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to names
        </Button>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-[hsl(var(--sunset-gold))]" /> {eventName}
          </h1>
          {tagline && (
            <p className="text-[hsl(var(--sunset-gold))] font-medium italic mt-1">"{tagline}"</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">{category}</Badge>
            <p className="text-xs text-muted-foreground">{rationale}</p>
          </div>
        </div>
      </div>

      {/* Narrative Card */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            📖 Event Narrative
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {narrativeLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Crafting your narrative…
            </div>
          ) : narrativeError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{narrativeError}</p>
              <Button variant="outline" size="sm" onClick={generateNarrative}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            </div>
          ) : narrative ? (
            <>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{narrative}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => copyToClipboard(narrative, "narrative")}
                >
                  {copiedNarrative ? <Check className="h-3.5 w-3.5 text-[hsl(var(--earth-green))]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedNarrative ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={generateNarrative}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={saveNarrative}
                  disabled={savingNarrative}
                >
                  {savingNarrative ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save to Event
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Social Studio */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            📱 Social Media Studio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Platform selector */}
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-all ${
                      platform === p.id
                        ? "border-primary bg-primary/10 text-foreground font-medium"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Post type */}
          <div className="space-y-1.5">
            <Label>Post Type</Label>
            <Select value={postType} onValueChange={setPostType}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom instruction */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label>Custom Instructions (optional)</Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">
                    Try "make it funny", "include a discount code", "mention Lagos", or "target Gen Z audience"
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              placeholder="e.g. Include a discount code SPARK25, mention the Lagos venue…"
              rows={2}
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
            />
          </div>

          {/* Generate */}
          <Button
            variant="hero"
            onClick={generatePost}
            disabled={postLoading}
            className="w-full sm:w-auto"
          >
            {postLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <PlatformIcon className="h-4 w-4 mr-1" /> Generate Post
              </>
            )}
          </Button>

          {/* Post output */}
          {postError && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{postError}</p>
              <Button variant="outline" size="sm" onClick={generatePost}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            </div>
          )}

          {generatedPost && !postLoading && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PlatformIcon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {PLATFORMS.find((p) => p.id === platform)?.label} · {POST_TYPES.find((t) => t.id === postType)?.label}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {generatedPost}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => copyToClipboard(generatedPost, "post")}
                >
                  {copiedPost ? <Check className="h-3.5 w-3.5 text-[hsl(var(--earth-green))]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedPost ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={savePost}
                  disabled={savingPost}
                >
                  {savingPost ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save to Event
                </Button>
              </div>

              {/* Refine chips */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Quick refinements:</p>
                <div className="flex flex-wrap gap-1.5">
                  {REFINE_OPTIONS.map((opt) => (
                    <Button
                      key={opt}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2.5"
                      onClick={() => refinePost(opt)}
                      disabled={refineLoading}
                    >
                      {refineLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      {opt}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved posts summary */}
      {savedPosts.length > 0 && (
        <Card className="border-[hsl(var(--earth-green))]/20 bg-[hsl(var(--earth-green))]/5">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-sm flex items-center gap-2">
              <Save className="h-4 w-4 text-[hsl(var(--earth-green))]" />
              Saved Posts ({savedPosts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedPosts.map((sp, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {PLATFORMS.find((p) => p.id === sp.platform)?.label}
                </Badge>
                <span className="truncate">{sp.content.slice(0, 80)}…</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              These posts are saved to your event and accessible in The Buzz module.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
