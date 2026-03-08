/**
 * Shortlist Management Page
 * View all saved names across events, compare side-by-side, mark final choice.
 */

import { useState, useEffect, useMemo } from "react";
import { Star, Check, Trash2, ArrowLeftRight, Sparkles, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ShortlistedName {
  id: string;
  name: string;
  category: string | null;
  rationale: string | null;
  tagline: string | null;
  rating: number | null;
  chosen: boolean | null;
  event_id: string | null;
  created_at: string;
}

interface EventInfo {
  id: string;
  name: string;
}

export default function ShortlistPage() {
  const { user } = useAuth();
  const [names, setNames] = useState<ShortlistedName[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  // Fetch data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      const [namesRes, eventsRes] = await Promise.all([
        supabase
          .from("shortlisted_names")
          .select("id, name, category, rationale, tagline, rating, chosen, event_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name"),
      ]);

      if (namesRes.data) setNames(namesRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  // Filtered names
  const filtered = useMemo(
    () => (filterEvent === "all" ? names : names.filter((n) => n.event_id === filterEvent)),
    [names, filterEvent]
  );

  // Compare selection
  const compareNames = useMemo(
    () => names.filter((n) => compareIds.has(n.id)),
    [names, compareIds]
  );

  const eventName = (eventId: string | null) =>
    events.find((e) => e.id === eventId)?.name || "No event";

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      } else {
        toast.info("You can compare up to 4 names at a time.");
      }
      return next;
    });
  };

  const markChosen = async (id: string) => {
    const target = names.find((n) => n.id === id);
    if (!target) return;
    const newVal = !target.chosen;

    const { error } = await supabase
      .from("shortlisted_names")
      .update({ chosen: newVal })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update.");
      return;
    }

    setNames((prev) => prev.map((n) => (n.id === id ? { ...n, chosen: newVal } : n)));
    toast.success(newVal ? `"${target.name}" marked as final choice!` : `"${target.name}" unmarked.`);
  };

  const deleteName = async (id: string) => {
    const target = names.find((n) => n.id === id);
    const { error } = await supabase.from("shortlisted_names").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete.");
      return;
    }
    setNames((prev) => prev.filter((n) => n.id !== id));
    setCompareIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.info(`"${target?.name}" removed from shortlist.`);
  };

  const renderStars = (rating: number | null) => {
    const r = rating || 0;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${i <= r ? "fill-[hsl(var(--sunset-gold))] text-[hsl(var(--sunset-gold))]" : "text-muted-foreground/30"}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-[hsl(var(--sunset-gold))]" /> Shortlist
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {names.length} saved name{names.length !== 1 ? "s" : ""} across {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Filter by event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {compareIds.size >= 2 && (
            <Button
              variant="hero-outline"
              size="sm"
              onClick={() => setShowCompare(!showCompare)}
            >
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              Compare ({compareIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Compare View */}
      {showCompare && compareNames.length >= 2 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" /> Side-by-Side Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Attribute</TableHead>
                    {compareNames.map((n) => (
                      <TableHead key={n.id} className="min-w-[180px] font-display font-semibold">
                        {n.name}
                        {n.chosen && (
                          <Badge variant="default" className="ml-2 text-[10px]">
                            <Check className="h-2.5 w-2.5 mr-0.5" /> Chosen
                          </Badge>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Tagline</TableCell>
                    {compareNames.map((n) => (
                      <TableCell key={n.id} className="text-sm italic">
                        {n.tagline || "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Category</TableCell>
                    {compareNames.map((n) => (
                      <TableCell key={n.id}>
                        <Badge variant="secondary" className="text-xs">{n.category || "—"}</Badge>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Rating</TableCell>
                    {compareNames.map((n) => (
                      <TableCell key={n.id}>{renderStars(n.rating)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Rationale</TableCell>
                    {compareNames.map((n) => (
                      <TableCell key={n.id} className="text-xs text-muted-foreground max-w-[220px]">
                        {n.rationale || "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Event</TableCell>
                    {compareNames.map((n) => (
                      <TableCell key={n.id} className="text-xs">{eventName(n.event_id)}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Actions</TableCell>
                    {compareNames.map((n) => (
                      <TableCell key={n.id}>
                        <Button
                          size="sm"
                          variant={n.chosen ? "default" : "outline"}
                          onClick={() => markChosen(n.id)}
                          className="text-xs"
                        >
                          <Check className="h-3 w-3 mr-1" /> {n.chosen ? "Chosen ✓" : "Mark Final"}
                        </Button>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Names Grid */}
      {filtered.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              No shortlisted names yet. Generate names in The Spark module and add them to your shortlist.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((n) => (
            <Card
              key={n.id}
              className={`border-border transition-all ${
                n.chosen ? "ring-2 ring-primary border-primary/40 bg-primary/5" : ""
              } ${compareIds.has(n.id) ? "ring-2 ring-[hsl(var(--sunset-gold))] border-[hsl(var(--sunset-gold))]/40" : ""}`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-lg text-foreground leading-tight">
                      {n.name}
                    </h3>
                    {n.tagline && (
                      <p className="text-xs italic text-muted-foreground">{n.tagline}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {n.chosen && (
                      <Badge variant="default" className="text-[10px] px-1.5">
                        <Check className="h-2.5 w-2.5 mr-0.5" /> Final
                      </Badge>
                    )}
                  </div>
                </div>

                {renderStars(n.rating)}

                {n.category && (
                  <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
                )}

                {n.rationale && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{n.rationale}</p>
                )}

                <div className="text-[10px] text-muted-foreground/60">
                  {eventName(n.event_id)} · {new Date(n.created_at).toLocaleDateString()}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant={n.chosen ? "default" : "outline"}
                    className="text-xs flex-1"
                    onClick={() => markChosen(n.id)}
                  >
                    <Check className="h-3 w-3 mr-1" /> {n.chosen ? "Chosen ✓" : "Mark Final"}
                  </Button>
                  <Button
                    size="sm"
                    variant={compareIds.has(n.id) ? "secondary" : "ghost"}
                    className="text-xs"
                    onClick={() => toggleCompare(n.id)}
                    title="Add to comparison"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteName(n.id)}
                    title="Remove from shortlist"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
