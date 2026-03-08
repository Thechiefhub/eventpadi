import { Megaphone, Calendar, Image, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const phases = [
  { name: "Launch", range: "90–60 days", color: "bg-primary", posts: [
    { day: "Day 90", type: "Save the Date", platform: "All", status: "done" },
    { day: "Day 85", type: "Early Bird Tickets", platform: "Instagram", status: "done" },
    { day: "Day 80", type: "Speaker Call", platform: "LinkedIn", status: "pending" },
    { day: "Day 75", type: "Behind the Scenes", platform: "WhatsApp", status: "upcoming" },
  ]},
  { name: "Build", range: "60–30 days", color: "bg-sunset-gold", posts: [
    { day: "Day 55", type: "Speaker Reveal #1", platform: "Instagram", status: "upcoming" },
    { day: "Day 50", type: "Agenda Highlights", platform: "LinkedIn", status: "upcoming" },
    { day: "Day 45", type: "Sponsor Shoutout", platform: "Twitter", status: "upcoming" },
    { day: "Day 40", type: "Networking Tips", platform: "WhatsApp", status: "upcoming" },
  ]},
  { name: "Final Push", range: "30–0 days", color: "bg-kente-red", posts: [
    { day: "Day 25", type: "Venue Info", platform: "All", status: "upcoming" },
    { day: "Day 15", type: "Countdown Post", platform: "Instagram", status: "upcoming" },
    { day: "Day 7", type: "Last Chance Tickets", platform: "All", status: "upcoming" },
    { day: "Day 1", type: "See You There!", platform: "WhatsApp", status: "upcoming" },
  ]},
];

const statusColors: Record<string, string> = {
  done: "bg-earth-green/20 text-earth-green",
  pending: "bg-sunset-gold/20 text-sunset-gold",
  upcoming: "bg-muted text-muted-foreground",
};

export default function BuzzModule() {
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="h-7 w-7 text-earth-green" /> The Buzz
        </h1>
        <p className="text-muted-foreground mt-1">Your 90-day content calendar, social designs & scheduling.</p>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="calendar"><Calendar className="h-4 w-4 mr-1" /> Calendar</TabsTrigger>
          <TabsTrigger value="design"><Image className="h-4 w-4 mr-1" /> Design Studio</TabsTrigger>
          <TabsTrigger value="schedule"><Send className="h-4 w-4 mr-1" /> Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6 space-y-6">
          {phases.map((phase) => (
            <Card key={phase.name} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${phase.color}`} />
                  Phase: {phase.name}
                  <span className="text-sm font-normal text-muted-foreground">({phase.range})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {phase.posts.map((post) => (
                    <div key={post.day + post.type} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground w-16">{post.day}</span>
                        <span className="font-medium text-foreground text-sm">{post.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{post.platform}</Badge>
                        <Badge className={`text-xs ${statusColors[post.status]}`}>{post.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="design" className="mt-6">
          <Card className="border-border">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Image className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">Design Studio</h3>
              <p className="text-sm max-w-md mx-auto">Create stunning social media graphics with African-inspired templates. Coming soon with AI integration.</p>
              <Button variant="hero" className="mt-4" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          <Card className="border-border">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">Post Scheduler</h3>
              <p className="text-sm max-w-md mx-auto">Connect your social media accounts to schedule posts directly from Myevent.</p>
              <Button variant="hero" className="mt-4" disabled>Connect Accounts</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
