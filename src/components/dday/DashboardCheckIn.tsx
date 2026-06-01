import { useState, useRef, useEffect } from "react";
import { Search, UserCheck, Undo2, StickyNote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Attendee } from "@/hooks/useAttendees";

interface Props {
  attendees: Attendee[];
  onCheckIn: (id: string, notes?: string) => Promise<boolean>;
  onUndoCheckIn: (id: string) => Promise<void>;
}

export default function DashboardCheckIn({ attendees, onCheckIn, onUndoCheckIn }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.trim().length >= 2
    ? attendees.filter(
        (a) =>
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          (a.email && a.email.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCheckIn = async (a: Attendee) => {
    await onCheckIn(a.id, notesById[a.id]);
    setNotesById((prev) => {
      const next = { ...prev };
      delete next[a.id];
      return next;
    });
    setQuery("");
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display">Quick Check-In</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div ref={containerRef} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            placeholder="Search by name or email to check in…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
            className="pl-9"
          />

          {open && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
              {results.map((a) => (
                <div
                  key={a.id}
                  className="px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border last:border-0 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full gradient-sunset flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.email || a.role || ""}
                          {a.admits > 1 ? ` · admits ${a.admits}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {a.checked_in ? (
                        <>
                          <Badge variant="secondary" className="bg-[hsl(var(--earth-green)/0.15)] text-[hsl(var(--earth-green))] text-xs">
                            In
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUndoCheckIn(a.id)}>
                            <Undo2 className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" className="h-7 text-xs gradient-sunset text-primary-foreground" onClick={() => handleCheckIn(a)}>
                          <UserCheck className="h-3 w-3 mr-1" /> Check In
                        </Button>
                      )}
                    </div>
                  </div>
                  {!a.checked_in && (
                    <div className="relative">
                      <StickyNote className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={notesById[a.id] || ""}
                        onChange={(e) => setNotesById((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCheckIn(a); } }}
                        placeholder="Note (e.g. entered with 1 guest, extra bag)"
                        maxLength={280}
                        className="h-8 pl-7 text-xs"
                      />
                    </div>
                  )}
                  {a.checked_in && a.check_in_notes && (
                    <p className="text-xs text-muted-foreground italic pl-10">📝 {a.check_in_notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {open && query.trim().length >= 2 && results.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 p-3 text-center">
              <p className="text-sm text-muted-foreground">No attendees found</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
