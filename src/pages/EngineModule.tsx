import { useState, useEffect } from "react";
import { Settings, Clock, FileText, Plus, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  is_completed: boolean;
  due_date: string | null;
  event_id: string;
}

const defaultTasks = [
  { title: "Book venue and confirm availability", category: "Venue" },
  { title: "Book backup generator for venue", category: "Logistics" },
  { title: "Confirm PA system and microphone availability", category: "Logistics" },
  { title: "Arrange security (>100 attendees)", category: "Logistics" },
  { title: "Set up mobile money payments (M-Pesa/MoMo)", category: "Logistics" },
  { title: "Send speaker invitation emails", category: "Speakers" },
  { title: "Collect speaker headshots and bios", category: "Speakers" },
  { title: "Design and order event badges", category: "Marketing" },
  { title: "Submit early bird ticket post", category: "Marketing" },
  { title: "Recruit and brief volunteers", category: "Volunteers" },
  { title: "Plan for traffic/transport logistics", category: "Logistics" },
  { title: "Arrange catering with local vendors", category: "Logistics" },
  { title: "Upload attendee list to D-Day module", category: "D-Day" },
  { title: "Print attendee badges with QR codes", category: "D-Day" },
  { title: "Set up check-in desk and signage", category: "D-Day" },
  { title: "Test QR scanner on check-in devices", category: "D-Day" },
  { title: "Brief check-in staff on D-Day module", category: "D-Day" },
  { title: "Invite team members to D-Day check-in", category: "D-Day" },
  { title: "Prepare offline check-in backup plan", category: "D-Day" },
  { title: "Do a dry run of the check-in flow", category: "D-Day" },
];

const categories = ["All", "Venue", "Logistics", "Speakers", "Marketing", "Volunteers", "D-Day", "General"];

export default function EngineModule() {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("events").select("id, name").order("created_at", { ascending: false }).then(({ data }) => {
      const evts = data || [];
      setEvents(evts);
      if (evts.length > 0 && !selectedEvent) setSelectedEvent(evts[0].id);
    });
  }, [user]);

  const fetchItems = async () => {
    if (!selectedEvent) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("event_id", selectedEvent)
      .order("created_at");
    if (error) toast.error(error.message);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [selectedEvent]);

  const seedDefaults = async () => {
    if (!user || !selectedEvent) return;
    setAdding(true);
    const rows = defaultTasks.map((t) => ({ ...t, event_id: selectedEvent, user_id: user.id }));
    const { error } = await supabase.from("checklist_items").insert(rows);
    if (error) toast.error(error.message);
    else toast.success("Default checklist added!");
    await fetchItems();
    setAdding(false);
  };

  const toggleItem = async (item: ChecklistItem) => {
    const newVal = !item.is_completed;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_completed: newVal } : i));
    const { error } = await supabase.from("checklist_items").update({ is_completed: newVal }).eq("id", item.id);
    if (error) {
      toast.error("Failed to update task");
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_completed: !newVal } : i));
    }
  };

  const addItem = async () => {
    if (!newTitle.trim() || !user || !selectedEvent) return;
    setAdding(true);
    const { error } = await supabase.from("checklist_items").insert({
      title: newTitle.trim(),
      category: newCategory,
      event_id: selectedEvent,
      user_id: user.id,
    });
    if (error) toast.error(error.message);
    else { setNewTitle(""); toast.success("Task added!"); }
    await fetchItems();
    setAdding(false);
  };

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); fetchItems(); }
  };

  const filtered = filter === "All" ? items : items.filter((t) => t.category === filter);
  const doneCount = items.filter((t) => t.is_completed).length;
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7 text-kente-red" /> The Engine
        </h1>
        <p className="text-muted-foreground mt-1">Your master checklist, reminders & logistics tracker.</p>
      </div>

      {/* Event Selector */}
      {events.length > 0 ? (
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-full md:w-72">
            <SelectValue placeholder="Select an event" />
          </SelectTrigger>
          <SelectContent>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Card className="border-border">
          <CardContent className="p-6 text-center text-muted-foreground">
            Create an event first to use the checklist.
          </CardContent>
        </Card>
      )}

      {selectedEvent && (
        <>
          {/* Progress */}
          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-semibold text-foreground">Overall Progress</h3>
                <span className="font-display text-2xl font-bold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-sm text-muted-foreground">{doneCount} of {items.length} tasks completed</p>
            </CardContent>
          </Card>

          {/* Add Task */}
          <Card className="border-border">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Add a new task..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1"
                maxLength={200}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
              />
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c !== "All").map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="hero" size="sm" onClick={addItem} disabled={adding || !newTitle.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </CardContent>
          </Card>

          {/* Seed defaults */}
          {!loading && items.length === 0 && (
            <Card className="border-border">
              <CardContent className="p-6 text-center space-y-3">
                <p className="text-muted-foreground">No tasks yet for this event.</p>
                <Button variant="outline" onClick={seedDefaults} disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Load Default African Event Checklist
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Category Filter */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={filter === cat ? "default" : "outline"}
                  className={`cursor-pointer ${filter === cat ? "gradient-sunset text-primary-foreground border-transparent" : ""}`}
                  onClick={() => setFilter(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          )}

          {/* Task List */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-2">
              {filtered.map((task) => (
                <Card key={task.id} className={`border-border transition-all ${task.is_completed ? "opacity-60" : ""}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <Checkbox checked={task.is_completed} onCheckedChange={() => toggleItem(task)} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{task.category}</Badge>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {task.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => deleteItem(task.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Resources */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Resource Library
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {["Budget Template (African Events)", "Floor Plan Layout", "Volunteer Briefing Sheet", "Post-Event Survey"].map((res) => (
              <button key={res} className="text-left rounded-lg border border-border p-3 hover:border-primary hover:shadow-warm transition-all text-sm text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground inline mr-2" />{res}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
