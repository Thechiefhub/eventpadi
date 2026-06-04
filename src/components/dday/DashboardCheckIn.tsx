import { useState, useRef, useEffect } from "react";
import { Search, UserCheck, Undo2, StickyNote, Pencil, Trash2, History, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Attendee } from "@/hooks/useAttendees";

const QUICK_NOTE_TEMPLATES = [
  "Entered with 1 guest",
  "Entered with 2 guests",
  "Extra bag",
  "VIP lane",
  "Late arrival",
  "No badge — replacement issued",
];

interface Props {
  attendees: Attendee[];
  onCheckIn: (id: string, notes?: string) => Promise<boolean>;
  onUndoCheckIn: (id: string) => Promise<void>;
}

export default function DashboardCheckIn({ attendees, onCheckIn, onUndoCheckIn }: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [auditOpenFor, setAuditOpenFor] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
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
    const note = notesById[a.id];
    const ok = await onCheckIn(a.id, note);
    if (ok && note?.trim() && user) {
      await supabase.from("check_in_note_audits").insert({
        attendee_id: a.id,
        event_id: a.event_id,
        changed_by: user.id,
        changed_by_name: user.email || null,
        action: "create",
        previous_note: null,
        new_note: note.trim().slice(0, 280),
      });
    }
    setNotesById((prev) => {
      const next = { ...prev };
      delete next[a.id];
      return next;
    });
    setQuery("");
    setOpen(false);
  };

  const applyTemplate = (id: string, tmpl: string) => {
    setNotesById((prev) => ({ ...prev, [id]: tmpl }));
  };

  const startEdit = (a: Attendee) => {
    setEditingId(a.id);
    setEditValue(a.check_in_notes || "");
  };

  const cancelEdit = () => { setEditingId(null); setEditValue(""); };

  const saveEdit = async (a: Attendee) => {
    const prev = a.check_in_notes || null;
    const next = editValue.trim() ? editValue.trim().slice(0, 280) : null;
    if (next === prev) { cancelEdit(); return; }
    const { error } = await supabase
      .from("attendees")
      .update({ check_in_notes: next })
      .eq("id", a.id);
    if (error) { toast.error("Failed to update note"); return; }
    if (user) {
      await supabase.from("check_in_note_audits").insert({
        attendee_id: a.id,
        event_id: a.event_id,
        changed_by: user.id,
        changed_by_name: user.email || null,
        action: next ? "edit" : "delete",
        previous_note: prev,
        new_note: next,
      });
    }
    toast.success(next ? "Note updated" : "Note removed");
    cancelEdit();
  };

  const deleteNote = async (a: Attendee) => {
    if (!a.check_in_notes) return;
    const prev = a.check_in_notes;
    const { error } = await supabase
      .from("attendees")
      .update({ check_in_notes: null })
      .eq("id", a.id);
    if (error) { toast.error("Failed to delete note"); return; }
    if (user) {
      await supabase.from("check_in_note_audits").insert({
        attendee_id: a.id,
        event_id: a.event_id,
        changed_by: user.id,
        changed_by_name: user.email || null,
        action: "delete",
        previous_note: prev,
        new_note: null,
      });
    }
    toast.success("Note deleted");
  };

  const loadAudit = async (attendeeId: string) => {
    setAuditOpenFor(attendeeId);
    setAuditLoading(true);
    const { data } = await supabase
      .from("check_in_note_audits")
      .select("*")
      .eq("attendee_id", attendeeId)
      .order("created_at", { ascending: false })
      .limit(20);
    setAuditEntries(data || []);
    setAuditLoading(false);
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
                    <div className="space-y-1.5">
                      <div className="relative">
                        <StickyNote className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={notesById[a.id] || ""}
                          onChange={(e) => setNotesById((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCheckIn(a); } }}
                          placeholder="Note (or pick a quick template below)"
                          maxLength={280}
                          className="h-8 pl-7 text-xs"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1 pl-1">
                        {QUICK_NOTE_TEMPLATES.map((t) => (
                          <button
                            type="button"
                            key={t}
                            onClick={() => applyTemplate(a.id, t)}
                            className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted/40 hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.checked_in && (
                    <div className="pl-10 space-y-1.5">
                      {editingId === a.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); saveEdit(a); }
                              if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                            }}
                            maxLength={280}
                            placeholder="Edit note…"
                            className="h-7 text-xs"
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(a)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1">
                          <p className="text-xs text-muted-foreground italic flex-1">
                            {a.check_in_notes ? `📝 ${a.check_in_notes}` : <span className="opacity-60">No note</span>}
                          </p>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(a)} title="Edit note">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {a.check_in_notes && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteNote(a)} title="Delete note">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          <Popover open={auditOpenFor === a.id} onOpenChange={(o) => o ? loadAudit(a.id) : setAuditOpenFor(null)}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6" title="View audit log">
                                <History className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 max-h-80 overflow-y-auto bg-popover z-50" side="left">
                              <p className="text-xs font-semibold mb-2">Note history</p>
                              {auditLoading ? (
                                <p className="text-xs text-muted-foreground">Loading…</p>
                              ) : auditEntries.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No changes recorded.</p>
                              ) : (
                                <ul className="space-y-2">
                                  {auditEntries.map((au) => (
                                    <li key={au.id} className="text-xs border-b border-border last:border-0 pb-2 last:pb-0">
                                      <div className="flex justify-between gap-2">
                                        <span className="font-medium capitalize">{au.action}</span>
                                        <span className="text-muted-foreground">{format(new Date(au.created_at), "MMM d, HH:mm")}</span>
                                      </div>
                                      <p className="text-muted-foreground truncate">by {au.changed_by_name || au.changed_by.slice(0, 8)}</p>
                                      {au.previous_note && <p className="line-through text-muted-foreground/70">{au.previous_note}</p>}
                                      {au.new_note && <p className="text-foreground">{au.new_note}</p>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
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
