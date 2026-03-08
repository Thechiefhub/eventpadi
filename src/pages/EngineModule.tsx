import { useState } from "react";
import { Settings, CheckCircle2, Circle, Clock, AlertTriangle, Zap, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

interface Task {
  id: string;
  text: string;
  category: string;
  done: boolean;
  dueIn: string;
  priority: "high" | "medium" | "low";
}

const initialTasks: Task[] = [
  { id: "1", text: "Book venue and confirm availability", category: "Venue", done: true, dueIn: "Done", priority: "high" },
  { id: "2", text: "Book backup generator for venue", category: "Logistics", done: true, dueIn: "Done", priority: "high" },
  { id: "3", text: "Confirm PA system and microphone availability", category: "Logistics", done: true, dueIn: "Done", priority: "high" },
  { id: "4", text: "Arrange security (>100 attendees)", category: "Logistics", done: false, dueIn: "14 days", priority: "high" },
  { id: "5", text: "Set up mobile money payments (M-Pesa/MoMo)", category: "Logistics", done: false, dueIn: "21 days", priority: "medium" },
  { id: "6", text: "Send speaker invitation emails", category: "Speakers", done: false, dueIn: "7 days", priority: "high" },
  { id: "7", text: "Collect speaker headshots and bios", category: "Speakers", done: false, dueIn: "30 days", priority: "medium" },
  { id: "8", text: "Design and order event badges", category: "Marketing", done: false, dueIn: "21 days", priority: "medium" },
  { id: "9", text: "Submit early bird ticket post", category: "Marketing", done: false, dueIn: "3 days", priority: "high" },
  { id: "10", text: "Recruit and brief volunteers", category: "Volunteers", done: false, dueIn: "28 days", priority: "low" },
  { id: "11", text: "Plan for traffic/transport logistics", category: "Logistics", done: false, dueIn: "14 days", priority: "medium" },
  { id: "12", text: "Arrange catering with local vendors", category: "Logistics", done: false, dueIn: "21 days", priority: "medium" },
];

const priorityColors: Record<string, string> = {
  high: "bg-kente-red/15 text-kente-red border-kente-red/30",
  medium: "bg-sunset-gold/15 text-sunset-gold border-sunset-gold/30",
  low: "bg-earth-green/15 text-earth-green border-earth-green/30",
};

const categories = ["All", "Venue", "Logistics", "Speakers", "Marketing", "Volunteers"];

export default function EngineModule() {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState("All");

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  };

  const filtered = filter === "All" ? tasks : tasks.filter((t) => t.category === filter);
  const doneCount = tasks.filter((t) => t.done).length;
  const progress = Math.round((doneCount / tasks.length) * 100);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7 text-kente-red" /> The Engine
        </h1>
        <p className="text-muted-foreground mt-1">Your master checklist, reminders & logistics tracker.</p>
      </div>

      {/* Progress */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-semibold text-foreground">Overall Progress</h3>
            <span className="font-display text-2xl font-bold text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          <p className="text-sm text-muted-foreground">{doneCount} of {tasks.length} tasks completed</p>
        </CardContent>
      </Card>

      {/* Category Filter */}
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

      {/* Task List */}
      <div className="space-y-2">
        {filtered.map((task) => (
          <Card key={task.id} className={`border-border transition-all ${task.done ? "opacity-60" : ""}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <Checkbox checked={task.done} onCheckedChange={() => toggleTask(task.id)} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.text}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{task.category}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {task.dueIn}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
                {task.priority}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

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
