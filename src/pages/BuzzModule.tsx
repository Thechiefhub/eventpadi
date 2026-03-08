import { useState, useEffect } from "react";
import { Megaphone, Calendar, Image, Send, Plus, Loader2, Trash2, Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface ContentPost {
  id: string;
  title: string;
  platform: string | null;
  phase: string | null;
  scheduled_date: string | null;
  status: string | null;
  content: string | null;
  event_id: string;
}

const phases = ["launch", "build", "final", "post-event"];
const phaseLabels: Record<string, { label: string; range: string; color: string }> = {
  launch: { label: "Launch", range: "90–60 days", color: "bg-primary" },
  build: { label: "Build", range: "60–30 days", color: "bg-sunset-gold" },
  final: { label: "Final Push", range: "30–0 days", color: "bg-kente-red" },
  "post-event": { label: "Post-Event", range: "After event", color: "bg-earth-green" },
};

const platforms = ["Instagram", "LinkedIn", "Twitter", "WhatsApp", "Facebook", "All"];
const statusOptions = ["draft", "scheduled", "published"];
const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-sunset-gold/20 text-sunset-gold",
  published: "bg-earth-green/20 text-earth-green",
};

export default function BuzzModule() {
  const { user } = useAuth();
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  // New post dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPlatform, setNewPlatform] = useState("Instagram");
  const [newPhase, setNewPhase] = useState("launch");
  const [newDate, setNewDate] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  // AI generate dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPost, setAiPost] = useState<ContentPost | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiCaption, setAiCaption] = useState("");
  const [aiHashtags, setAiHashtags] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("events").select("id, name").order("created_at", { ascending: false }).then(({ data }) => {
      const evts = data || [];
      setEvents(evts);
      if (evts.length > 0 && !selectedEvent) setSelectedEvent(evts[0].id);
    });
  }, [user]);

  const fetchPosts = async () => {
    if (!selectedEvent) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("content_posts")
      .select("*")
      .eq("event_id", selectedEvent)
      .order("scheduled_date", { ascending: true, nullsFirst: false });
    setPosts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, [selectedEvent]);

  const addPost = async () => {
    if (!user || !selectedEvent || !newTitle.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("content_posts").insert({
      user_id: user.id,
      event_id: selectedEvent,
      title: newTitle.trim(),
      platform: newPlatform,
      phase: newPhase,
      scheduled_date: newDate || null,
      status: "draft",
      content: newContent.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Post added!");
      setNewTitle(""); setNewContent(""); setNewDate("");
      setDialogOpen(false);
    }
    await fetchPosts();
    setAdding(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("content_posts").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else setPosts((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
  };

  const deletePost = async (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("content_posts").delete().eq("id", id);
    if (error) { toast.error(error.message); fetchPosts(); }
  };

  const seedDefaults = async () => {
    if (!user || !selectedEvent) return;
    setAdding(true);
    const defaults = [
      { title: "Save the Date Announcement", platform: "All", phase: "launch", status: "draft" },
      { title: "Early Bird Tickets", platform: "Instagram", phase: "launch", status: "draft" },
      { title: "Call for Speakers", platform: "LinkedIn", phase: "launch", status: "draft" },
      { title: "Behind the Scenes Teaser", platform: "WhatsApp", phase: "launch", status: "draft" },
      { title: "Speaker Reveal #1", platform: "Instagram", phase: "build", status: "draft" },
      { title: "Agenda Highlights", platform: "LinkedIn", phase: "build", status: "draft" },
      { title: "Sponsor Shoutout", platform: "Twitter", phase: "build", status: "draft" },
      { title: "Networking Tips", platform: "WhatsApp", phase: "build", status: "draft" },
      { title: "Venue & Logistics Info", platform: "All", phase: "final", status: "draft" },
      { title: "Countdown – 7 Days!", platform: "Instagram", phase: "final", status: "draft" },
      { title: "Last Chance Tickets", platform: "All", phase: "final", status: "draft" },
      { title: "See You There!", platform: "WhatsApp", phase: "final", status: "draft" },
      { title: "Thank You Post", platform: "All", phase: "post-event", status: "draft" },
      { title: "Highlight Reel", platform: "Instagram", phase: "post-event", status: "draft" },
    ];
    const rows = defaults.map((d) => ({ ...d, event_id: selectedEvent, user_id: user.id }));
    const { error } = await supabase.from("content_posts").insert(rows);
    if (error) toast.error(error.message);
    else toast.success("90-day calendar loaded!");
    await fetchPosts();
    setAdding(false);
  };

  const generateCaption = async (post: ContentPost) => {
    setAiPost(post);
    setAiDialogOpen(true);
    setAiGenerating(true);
    setAiCaption("");
    setAiHashtags([]);

    const eventName = events.find((e) => e.id === post.event_id)?.name || "Our Event";

    try {
      const { data, error } = await supabase.functions.invoke("buzz-generate", {
        body: {
          title: post.title,
          platform: post.platform,
          phase: post.phase,
          eventName,
        },
      });

      if (error) {
        toast.error("AI generation failed. Please try again.");
        setAiGenerating(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setAiGenerating(false);
        return;
      }

      setAiCaption(data.caption || "");
      setAiHashtags(data.hashtags || []);
    } catch (e) {
      toast.error("Failed to generate caption.");
    }
    setAiGenerating(false);
  };

  const useCaption = async () => {
    if (!aiPost) return;
    const fullContent = aiCaption + "\n\n" + aiHashtags.map((h) => `#${h}`).join(" ");
    const { error } = await supabase.from("content_posts").update({ content: fullContent }).eq("id", aiPost.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Caption saved to post!");
      setPosts((prev) => prev.map((p) => p.id === aiPost.id ? { ...p, content: fullContent } : p));
      setAiDialogOpen(false);
    }
  };

  const copyCaption = () => {
    const fullContent = aiCaption + "\n\n" + aiHashtags.map((h) => `#${h}`).join(" ");
    navigator.clipboard.writeText(fullContent);
    toast.success("Copied to clipboard!");
  };

  const grouped = phases.reduce((acc, phase) => {
    acc[phase] = posts.filter((p) => p.phase === phase);
    return acc;
  }, {} as Record<string, ContentPost[]>);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-earth-green" /> The Buzz
          </h1>
          <p className="text-muted-foreground mt-1">Your 90-day content calendar, social designs & scheduling.</p>
        </div>
        {selectedEvent && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm"><Plus className="h-4 w-4 mr-1" /> New Post</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Add Content Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Post Title *</Label>
                  <Input placeholder="e.g. Speaker Reveal #2" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={150} />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={newPlatform} onValueChange={setNewPlatform}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Phase</Label>
                    <Select value={newPhase} onValueChange={setNewPhase}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {phases.map((p) => <SelectItem key={p} value={p} className="capitalize">{phaseLabels[p].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Content / Caption</Label>
                  <Textarea placeholder="Write your post copy here..." value={newContent} onChange={(e) => setNewContent(e.target.value)} maxLength={1000} rows={3} />
                </div>
                <Button variant="hero" className="w-full" onClick={addPost} disabled={adding || !newTitle.trim()}>
                  {adding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add Post
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Event Selector */}
      {events.length > 0 ? (
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-full md:w-72"><SelectValue placeholder="Select an event" /></SelectTrigger>
          <SelectContent>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Card className="border-border">
          <CardContent className="p-6 text-center text-muted-foreground">Create an event first to plan content.</CardContent>
        </Card>
      )}

      {selectedEvent && (
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="bg-muted">
            <TabsTrigger value="calendar"><Calendar className="h-4 w-4 mr-1" /> Calendar</TabsTrigger>
            <TabsTrigger value="design"><Image className="h-4 w-4 mr-1" /> Design Studio</TabsTrigger>
            <TabsTrigger value="schedule"><Send className="h-4 w-4 mr-1" /> Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-6 space-y-6">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : posts.length === 0 ? (
              <Card className="border-border">
                <CardContent className="p-8 text-center space-y-3">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <h3 className="font-display text-lg font-semibold text-foreground">No posts yet</h3>
                  <p className="text-muted-foreground text-sm">Start from scratch or load the 90-day template.</p>
                  <Button variant="outline" onClick={seedDefaults} disabled={adding}>
                    {adding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Load 90-Day Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              phases.map((phase) => {
                const phasePosts = grouped[phase];
                if (phasePosts.length === 0) return null;
                const info = phaseLabels[phase];
                return (
                  <Card key={phase} className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="font-display text-lg flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${info.color}`} />
                        Phase: {info.label}
                        <span className="text-sm font-normal text-muted-foreground">({info.range})</span>
                        <Badge variant="secondary" className="text-xs ml-auto">{phasePosts.length} posts</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {phasePosts.map((post) => (
                          <div key={post.id} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors gap-2">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {post.scheduled_date && (
                                <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">
                                  {format(new Date(post.scheduled_date), "MMM d")}
                                </span>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-foreground text-sm truncate">{post.title}</span>
                                {post.content && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{post.content.slice(0, 60)}…</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="text-xs">{post.platform}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-primary hover:text-primary/80 gap-1"
                                onClick={() => generateCaption(post)}
                              >
                                <Sparkles className="h-3.5 w-3.5" /> AI
                              </Button>
                              <Select value={post.status || "draft"} onValueChange={(v) => updateStatus(post.id, v)}>
                                <SelectTrigger className={`w-28 h-7 text-xs capitalize ${statusColors[post.status || "draft"]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deletePost(post.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
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
      )}

      {/* AI Caption Generator Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Caption Generator
            </DialogTitle>
          </DialogHeader>
          {aiPost && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium text-foreground">{aiPost.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {aiPost.platform} · {phaseLabels[aiPost.phase || "launch"]?.label} Phase
                </p>
              </div>

              {aiGenerating ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Crafting your caption…</p>
                </div>
              ) : aiCaption ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caption</Label>
                    <div className="rounded-lg border border-border p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {aiCaption}
                    </div>
                  </div>
                  {aiHashtags.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hashtags</Label>
                      <div className="flex flex-wrap gap-2">
                        {aiHashtags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="hero" className="flex-1" onClick={useCaption}>
                      Save to Post
                    </Button>
                    <Button variant="outline" onClick={copyCaption}>
                      <Copy className="h-4 w-4 mr-1" /> Copy
                    </Button>
                    <Button variant="outline" onClick={() => generateCaption(aiPost)}>
                      <Sparkles className="h-4 w-4 mr-1" /> Regenerate
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Something went wrong. Try again.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
