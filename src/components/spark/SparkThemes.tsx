/**
 * SparkThemes — Displays generated theme & narrative frameworks for shortlisted names.
 */

import { Copy, Check, Hash, Palette as PaletteIcon, Users, BookOpen } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface ThemePackage {
  name: string;
  theme_statement: string;
  narrative_hook: string;
  key_pillars: string[];
  hashtag: string;
  color_mood: string;
  audience_promise: string;
}

interface Props {
  themes: ThemePackage[];
}

export default function SparkThemes({ themes }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const CopyBtn = ({ text, label }: { text: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-1.5 text-muted-foreground"
      onClick={() => copy(text, label)}
    >
      {copiedField === label ? (
        <Check className="h-3 w-3 text-[hsl(var(--earth-green))]" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge className="gradient-sunset text-primary-foreground border-0">
          {themes.length} Theme{themes.length !== 1 ? "s" : ""} Generated
        </Badge>
      </div>

      <div className="grid gap-4">
        {themes.map((t) => (
          <Card key={t.name} className="border-border overflow-hidden">
            <CardHeader className="pb-2 bg-muted/50">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                {t.name}
                <CopyBtn text={t.name} label={`${t.name} name`} />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Theme Statement */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Theme Statement</span>
                  <CopyBtn text={t.theme_statement} label={`${t.name} theme`} />
                </div>
                <p className="text-sm text-foreground leading-relaxed">{t.theme_statement}</p>
              </div>

              {/* Narrative Hook */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Narrative Hook</span>
                <p className="text-sm text-muted-foreground italic border-l-2 border-primary pl-3">
                  {t.narrative_hook}
                </p>
              </div>

              {/* Key Pillars */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Content Pillars</span>
                <div className="flex flex-wrap gap-1.5">
                  {t.key_pillars.map((p) => (
                    <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                  ))}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="flex items-start gap-2 p-2 rounded-lg bg-muted">
                  <Hash className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Hashtag</p>
                    <p className="text-sm font-medium text-foreground">{t.hashtag}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded-lg bg-muted">
                  <PaletteIcon className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Color Mood</p>
                    <p className="text-sm font-medium text-foreground">{t.color_mood}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded-lg bg-muted">
                  <Users className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Audience Promise</p>
                    <p className="text-sm font-medium text-foreground">{t.audience_promise}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
