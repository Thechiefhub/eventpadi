/**
 * SparkResults — Displays AI-generated name suggestions in a categorized,
 * tabbed view with save-to-shortlist, rating display, and export options.
 */

import { useState } from "react";
import { Star, Heart, Copy, Check, Download, RotateCcw, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export interface NameSuggestion {
  name: string;
  rationale: string;
  tagline: string;
  rating: number;
  language_note?: string;
}

export interface NameCategory {
  category: string;
  names: NameSuggestion[];
}

interface Props {
  categories: NameCategory[];
  shortlisted: Set<string>;
  onToggleShortlist: (name: NameSuggestion, category: string) => void;
  onGenerateThemes: () => void;
  onReset: () => void;
  themesLoading: boolean;
}

export default function SparkResults({
  categories,
  shortlisted,
  onToggleShortlist,
  onGenerateThemes,
  onReset,
  themesLoading,
}: Props) {
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const copyName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedName(name);
    toast.success(`"${name}" copied!`);
    setTimeout(() => setCopiedName(null), 1500);
  };

  const exportAll = () => {
    const lines = ["Category,Name,Tagline,Rating,Rationale"];
    categories.forEach((cat) => {
      cat.names.forEach((n) => {
        lines.push(
          `"${cat.category}","${n.name}","${n.tagline}",${n.rating},"${n.rationale.replace(/"/g, '""')}"`
        );
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spark-names-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating ? "fill-[hsl(var(--sunset-gold))] text-[hsl(var(--sunset-gold))]" : "text-border"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Badge className="gradient-sunset text-primary-foreground border-0">
            {categories.reduce((sum, c) => sum + c.names.length, 0)} names generated
          </Badge>
          {shortlisted.size > 0 && (
            <Link to="/dashboard/shortlist">
              <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted transition-colors">
                <Heart className="h-3 w-3 fill-[hsl(var(--kente-red))] text-[hsl(var(--kente-red))]" />
                {shortlisted.size} shortlisted
                <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
              </Badge>
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportAll} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> New Search
          </Button>
        </div>
      </div>

      {/* Categorized Tabs */}
      <Tabs defaultValue={categories[0]?.category} className="w-full">
        <TabsList className="w-full flex overflow-x-auto gap-1 h-auto flex-wrap">
          {categories.map((cat) => (
            <TabsTrigger key={cat.category} value={cat.category} className="text-xs whitespace-nowrap">
              {cat.category}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat.category} value={cat.category} className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {cat.names.map((n) => {
                const isShortlisted = shortlisted.has(n.name);
                return (
                  <Card
                    key={n.name}
                    className={`border-border transition-all hover:shadow-md ${
                      isShortlisted ? "ring-2 ring-primary/30 border-primary/30" : ""
                    }`}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-foreground text-base leading-tight">
                          {n.name}
                        </h3>
                        {renderStars(n.rating)}
                      </div>
                      <p className="text-sm text-[hsl(var(--sunset-gold))] font-medium italic">
                        "{n.tagline}"
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{n.rationale}</p>
                      {n.language_note && (
                        <p className="text-xs text-[hsl(var(--earth-green))] flex items-center gap-1">
                          🌍 {n.language_note}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 px-2 gap-1 text-xs ${
                            isShortlisted
                              ? "text-[hsl(var(--kente-red))]"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => onToggleShortlist(n, cat.category)}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${isShortlisted ? "fill-current" : ""}`}
                          />
                          {isShortlisted ? "Saved" : "Save"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 gap-1 text-xs text-muted-foreground"
                          onClick={() => copyName(n.name)}
                        >
                          {copiedName === n.name ? (
                            <Check className="h-3.5 w-3.5 text-[hsl(var(--earth-green))]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Generate Themes CTA */}
      {shortlisted.size > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div>
              <p className="font-display font-bold text-foreground text-sm">
                Ready for the next step?
              </p>
              <p className="text-xs text-muted-foreground">
                Generate full themes & narrative frameworks for your {shortlisted.size} shortlisted name{shortlisted.size !== 1 ? "s" : ""}.
              </p>
            </div>
            <Button
              variant="hero"
              onClick={onGenerateThemes}
              disabled={themesLoading}
              className="gap-1.5 shrink-0"
            >
              {themesLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Generating…
                </>
              ) : (
                "Generate Themes →"
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
