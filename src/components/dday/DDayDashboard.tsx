import { useState, useMemo } from "react";
import { Users, UserCheck, UserMinus, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Attendee } from "@/hooks/useAttendees";
import { format } from "date-fns";
import AttendeeListModal, { type AttendeeFilter } from "./AttendeeListModal";

interface Props {
  attendees: Attendee[];
}

export default function DDayDashboard({ attendees }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState<AttendeeFilter>("all");
  const [modalTitle, setModalTitle] = useState("");

  const total = attendees.length;
  const checkedIn = attendees.filter((a) => a.checked_in).length;
  const remaining = total - checkedIn;
  const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  // Build check-in over time chart data (cumulative, bucketed by minute)
  const chartData = useMemo(() => {
    const checkedInList = attendees
      .filter((a) => a.checked_in && a.checked_in_at)
      .sort((a, b) => new Date(a.checked_in_at!).getTime() - new Date(b.checked_in_at!).getTime());
    if (checkedInList.length === 0) return [];

    const buckets = new Map<string, number>();
    checkedInList.forEach((a) => {
      const key = format(new Date(a.checked_in_at!), "HH:mm");
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    let cumulative = 0;
    return Array.from(buckets.entries()).map(([time, count]) => {
      cumulative += count;
      return { time, count: cumulative, rate: Math.round((cumulative / total) * 100) };
    });
  }, [attendees, total]);

  const openModal = (filter: AttendeeFilter, title: string) => {
    setModalFilter(filter);
    setModalTitle(title);
    setModalOpen(true);
  };

  const recentCheckins = attendees
    .filter((a) => a.checked_in && a.checked_in_at)
    .sort((a, b) => new Date(b.checked_in_at!).getTime() - new Date(a.checked_in_at!).getTime())
    .slice(0, 10);

  const stats = [
    { label: "Registered", value: total, icon: Users, color: "text-primary", filter: "all" as AttendeeFilter },
    { label: "Checked In", value: checkedIn, icon: UserCheck, color: "text-[hsl(var(--earth-green))]", filter: "checked_in" as AttendeeFilter },
    { label: "Remaining", value: remaining, icon: UserMinus, color: "text-[hsl(var(--kente-red))]", filter: "remaining" as AttendeeFilter },
    { label: "Check-in %", value: `${pct}%`, icon: Clock, color: "text-[hsl(var(--sunset-gold))]", filter: null },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className={`border-border transition-all ${
              s.filter ? "cursor-pointer hover:shadow-md hover:border-primary/30 active:scale-[0.98]" : ""
            }`}
            onClick={() => s.filter && openModal(s.filter, `${s.label} Attendees`)}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <s.icon className={`h-6 w-6 ${s.color}`} />
              <span className="text-2xl md:text-3xl font-display font-bold text-foreground">{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Check-in Progress</span>
            <span>{checkedIn}/{total}</span>
          </div>
          <Progress value={pct} className="h-3" />
        </CardContent>
      </Card>

      {/* Check-in Rate Over Time Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Check-in Rate Over Time</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="checkinGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) =>
                      name === "count" ? [`${value} attendees`, "Checked In"] : [`${value}%`, "Rate"]
                    }
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#checkinGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">Recent Check-ins</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {recentCheckins.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No check-ins yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentCheckins.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full gradient-sunset flex items-center justify-center text-primary-foreground text-xs font-bold">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.role || "attendee"}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {a.checked_in_at ? format(new Date(a.checked_in_at), "HH:mm:ss") : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendee List Modal */}
      <AttendeeListModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        attendees={attendees}
        filter={modalFilter}
        title={modalTitle}
      />
    </div>
  );
}
