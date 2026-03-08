import { Link } from "react-router-dom";
import { Lightbulb, Handshake, Megaphone, Settings, CalendarDays, CheckCircle2, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const stats = [
  { label: "Events Active", value: "1", icon: CalendarDays, color: "text-primary" },
  { label: "Tasks Done", value: "3/12", icon: CheckCircle2, color: "text-earth-green" },
  { label: "Sponsors Contacted", value: "2", icon: Users, color: "text-sunset-gold" },
  { label: "Posts Scheduled", value: "0", icon: TrendingUp, color: "text-kente-red" },
];

const quickActions = [
  { title: "Generate Event Name", desc: "Let AI suggest creative names", icon: Lightbulb, to: "/dashboard/spark", color: "gradient-sunset" },
  { title: "Find Sponsors", desc: "Browse curated sponsor database", icon: Handshake, to: "/dashboard/chase", color: "gradient-indigo" },
  { title: "Plan Content", desc: "Build your 90-day calendar", icon: Megaphone, to: "/dashboard/buzz", color: "gradient-sunset" },
  { title: "View Checklist", desc: "Track logistics & tasks", icon: Settings, to: "/dashboard/engine", color: "gradient-indigo" },
];

export default function Dashboard() {
  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Welcome back! 👋</h1>
        <p className="text-muted-foreground mt-1">Here's your event planning overview.</p>
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

      {/* Current Event Progress */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">AfroTech Lagos 2026</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium text-foreground">25%</span>
          </div>
          <Progress value={25} className="h-2" />
          <p className="text-xs text-muted-foreground">Event date: June 15, 2026 · 98 days away</p>
        </CardContent>
      </Card>

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
