/**
 * The Spark Module — Advanced AI Event Naming Engine
 *
 * Multi-step form → AI-generated categorized names → Shortlist → Theme generation
 * With offline caching, mobile responsiveness, and save-to-database.
 */

import { useState, useEffect, useCallback } from "react";
import { Sparkles, WifiOff, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEventSelect } from "@/hooks/useEventSelect";
import { toast } from "sonner";
import SparkForm, { type SparkContext } from "@/components/spark/SparkForm";
import SparkResults, { type NameCategory, type NameSuggestion } from "@/components/spark/SparkResults";
import SparkThemes, { type ThemePackage } from "@/components/spark/SparkThemes";
import VisualIdentityStudio from "@/components/spark/VisualIdentityStudio";

const CACHE_KEY = "spark_last_generation";

export default function SparkModule() {
  const { user } = useAuth();
  const { events, selectedEventId } = useEventSelect();

  // State
  const [loading, setLoading] = useState(false);
  const [themesLoading, setThemesLoading] = useState(false);
  const [categories, setCategories] = useState<NameCategory[]>([]);
  const [themes, setThemes] = useState<ThemePackage[]>([]);
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
  const [shortlistDetails, setShortlistDetails] = useState<Map<string, { suggestion: NameSuggestion; category: string }>>(new Map());
  const [lastContext, setLastContext] = useState<SparkContext | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Offline detection
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Load cached results on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { categories: c, context: ctx } = JSON.parse(cached);
        if (c?.length) {
          setCategories(c);
          setLastContext(ctx);
        }
      }
    } catch {}
  }, []);

  // Generate names
  const handleGenerate = useCallback(async (context: SparkContext) => {
    if (isOffline) {
      toast.error("You're offline. Showing cached results if available.");
      return;
    }

    setLoading(true);
    setCategories([]);
    setThemes([]);
    setShortlisted(new Set());
    setShortlistDetails(new Map());
    setLastContext(context);

    try {
      const { data, error } = await supabase.functions.invoke("spark-generate", {
        body: { mode: "names", context },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const cats: NameCategory[] = data.categories || [];
      setCategories(cats);

      // Cache for offline
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ categories: cats, context }));
      } catch {}

      toast.success(`Generated ${cats.reduce((s, c) => s + c.names.length, 0)} name suggestions!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate names. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isOffline]);

  // Toggle shortlist
  const toggleShortlist = useCallback(async (suggestion: NameSuggestion, category: string) => {
    const name = suggestion.name;
    const newSet = new Set(shortlisted);
    const newDetails = new Map(shortlistDetails);

    if (newSet.has(name)) {
      newSet.delete(name);
      newDetails.delete(name);
      // Remove from DB
      if (user) {
        await supabase.from("shortlisted_names").delete()
          .eq("user_id", user.id).eq("name", name);
      }
      toast.info(`Removed "${name}" from shortlist`);
    } else {
      newSet.add(name);
      newDetails.set(name, { suggestion, category });
      // Save to DB
      if (user) {
        await supabase.from("shortlisted_names").insert({
          user_id: user.id,
          event_id: selectedEventId || null,
          name: suggestion.name,
          category,
          rationale: suggestion.rationale,
          tagline: suggestion.tagline,
          rating: suggestion.rating,
          generation_context: lastContext as any,
        });
      }
      toast.success(`"${name}" added to shortlist`);
    }

    setShortlisted(newSet);
    setShortlistDetails(newDetails);
  }, [shortlisted, shortlistDetails, user, selectedEventId, lastContext]);

  // Generate themes for shortlisted names
  const handleGenerateThemes = useCallback(async () => {
    if (shortlisted.size === 0) return;
    if (isOffline) {
      toast.error("You're offline. Please reconnect to generate themes.");
      return;
    }

    setThemesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("spark-generate", {
        body: {
          mode: "theme",
          context: lastContext,
          selectedNames: Array.from(shortlisted),
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setThemes(data.themes || []);
      toast.success("Theme frameworks generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate themes.");
    } finally {
      setThemesLoading(false);
    }
  }, [shortlisted, lastContext, isOffline]);

  const handleReset = () => {
    setCategories([]);
    setThemes([]);
    setShortlisted(new Set());
    setShortlistDetails(new Map());
    setLastContext(null);
  };

  const showResults = categories.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-[hsl(var(--sunset-gold))]" /> The Spark
        </h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          AI-powered event naming engine with deep African cultural context.
        </p>
      </div>

      {/* Offline Banner */}
      {isOffline && (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--kente-red))] bg-[hsl(var(--kente-red))/0.1] rounded-lg px-4 py-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline. Showing cached results. New generations require an internet connection.</span>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="name" className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="name">Name Generator</TabsTrigger>
          <TabsTrigger value="visual">Visual Identity</TabsTrigger>
        </TabsList>

        <TabsContent value="name" className="mt-6 space-y-6">
          {!showResults ? (
            <>
              {/* Privacy Notice */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Your inputs are sent to our AI for name generation only. We optionally track which names you choose to improve future suggestions. You can opt out anytime.
                </span>
              </div>
              <SparkForm onSubmit={handleGenerate} loading={loading} />
            </>
          ) : (
            <div className="space-y-6">
              <SparkResults
                categories={categories}
                shortlisted={shortlisted}
                onToggleShortlist={toggleShortlist}
                onGenerateThemes={handleGenerateThemes}
                onReset={handleReset}
                themesLoading={themesLoading}
                context={lastContext}
              />
              {themes.length > 0 && <SparkThemes themes={themes} />}
            </div>
          )}
        </TabsContent>

        <TabsContent value="visual" className="mt-6">
          <VisualIdentityStudio />
        </TabsContent>
      </Tabs>
    </div>
  );
}
