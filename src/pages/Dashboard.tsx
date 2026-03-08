import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Lightbulb, Handshake, Megaphone, Settings, CalendarDays, CheckCircle2, Users, TrendingUp, Plus, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NewEventDialog from "@/components/NewEventDialog";
import { format, differenceInDays } from "date-fns";

interface Event {
  id: string;
  name: string;
  event_date: string | null;
  city: string | null;
  country: string | null;
  event_type: string | null;
  progress: number | null;
}

const quickActions = [
  { title: "Generate Event Name", desc: "Let AI suggest creative names", icon: Lightbulb, to: "/dashboard/spark", color: "gradient-sunset" },
  { title: "Find Sponsors", desc: "Browse curated sponsor database", icon: Handshake, to: "/dashboard/chase", color: "gradient-indigo" },
  { title: "Plan Content", desc: "Build your 90-day calendar", icon: Megaphone, to: "/dashboard/buzz", color: "gradient-sunset" },
  { title: "View Checklist", desc: "Track logistics & tasks", icon: Settings, to: "/dashboard/engine", color: "gradient-indigo" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskStats, setTaskStats] = useState({ done: 0, total: 0 });
  const [sponsorCount, setSponsorCount] = useState(0);
  const [postCount, setPostCount] = useState(0);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [eventsRes, tasksRes, sponsorsRes, postsRes] = await Promise.all([
      supabase.from("events").select("id, name, event_date, city, country, event_type, progress").order("created_at", { ascending: false }),
      supabase.from("checklist_items").select("is_completed"),
      supabase.from("sponsor_contacts").select("id"),
      supabase.from("content_posts").select("id"),
    ]);

    setEvents(eventsRes.data || []);

    const tasks = tasksRes.data || [];
    setTaskStats({ done: tasks.filter((t) => t.is_completed).length, total: tasks.length });
    setSponsorCount(sponsorsRes.data?.length || 0);
    setPostCount(postsRes.data?.length || 0);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const stats = [
    { label: "Events Active", value: String(events.length), icon: CalendarDays, color: "text-primary" },
    { label: "Tasks Done", value: `${taskStats.done}/${taskStats.total}`, icon: CheckCircle2, color: "text-earth-green" },
    { label: "Sponsors Contacted", value: String(sponsorCount), icon: Users, color: "text-sunset-gold" },
    { label: "Posts Scheduled", value: String(postCount), icon: TrendingUp, color: "text-kente-red" },
  ];

  const nextEvent = events.find((e) => e.event_date && new Date(e.event_date) >= new Date());

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Welcome back! 👋</h1>
          <p className="text-muted-foreground mt-1">Here's your event planning overview.</p>
        </div>
        <NewEventDialog onCreated={fetchData} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`rounded-lg bg-muted p-2.5 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events List or Empty State */}
      {loading ? (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center text-muted-foreground">Loading events...</CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center space-y-3">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="font-display text-lg font-semibold text-foreground">No events yet</h3>
            <p className="text-muted-foreground text-sm">Create your first event to get started!</p>
            <NewEventDialog onCreated={fetchData}>
              <Button variant="hero">
                <Plus className="h-4 w-4 mr-1" /> Create Your First Event
              </Button>
            </NewEventDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-foreground">Your Events</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {events.map((event) => {
              const daysAway = event.event_date
                ? differenceInDays(new Date(event.event_date), new Date())
                : null;

              return (
                <Card key={event.id} className="border-border bg-card hover:shadow-warm transition-all">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-display font-semibold text-foreground text-lg">{event.name}</h3>
                      <Badge variant="outline" className="capitalize text-xs">{event.event_type}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {event.event_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {format(new Date(event.event_date), "MMM d, yyyy")}
                        </span>
                      )}
                      {(event.city || event.country) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {[event.city, event.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium text-foreground">{event.progress || 0}%</span>
                      </div>
                      <Progress value={event.progress || 0} className="h-1.5" />
                    </div>
                    {daysAway !== null && daysAway >= 0 && (
                      <p className="text-xs text-muted-foreground">{daysAway} days away</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.title} to={action.to} className="group">
              <Card className="border-border bg-card hover:shadow-warm transition-all duration-300 hover:-translate-y-1 h-full">
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className={`inline-flex rounded-lg p-2.5 ${action.color} w-fit`}>
                    <action.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
