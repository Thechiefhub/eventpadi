import { useState, useEffect, useCallback } from "react";
import {
  Megaphone, Calendar, Sparkles, Copy, Plus, Loader2, Trash2, Send,
  RefreshCw, Hash, Lightbulb, FileText, PenTool, Instagram, Linkedin,
  Twitter, Facebook, MessageCircle, ChevronDown, Star, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

// --- Types ---
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

interface ContentIdea {
  title: string;
  description: string;
  platforms: string[];
  visual: string;
  hashtags: string[];
  category: string;
}

interface EventData {
  id: string;
  name: string;
  event_date: string | null;
  city: string | null;
  country: string | null;
  tagline: string | null;
  theme_statement: string | null;
  event_type: string | null;
}

// --- Constants ---
const platforms = ["Instagram", "LinkedIn", "Twitter", "WhatsApp", "Facebook"];
const platformIcons: Record<string, React.ReactNode> = {
  Instagram: <Instagram className="h-4 w-4" />,
  LinkedIn: <Linkedin className="h-4 w-4" />,
  Twitter: <Twitter className="h-4 w-4" />,
  WhatsApp: <MessageCircle className="h-4 w-4" />,
  Facebook: <Facebook className="h-4 w-4" />,
};
const postTypes = ["Announcement", "Speaker Highlight", "Sponsor Thanks", "Countdown", "Educational Tip", "Poll", "Quote", "Behind-the-Scenes", "Call to Action"];
const tones = ["Professional", "Friendly", "Urgent", "Inspirational", "Funny", "Casual"];
const phases = ["launch", "build", "final", "post-event"];
const phaseLabels: Record<string, { label: string; range: string; color: string }> = {
  launch: { label: "Launch", range: "90–60 days", color: "bg-primary" },
  build: { label: "Build", range: "60–30 days", color: "bg-sunset-gold" },
  final: { label: "Final Push", range: "30–0 days", color: "bg-kente-red" },
  "post-event": { label: "Post-Event", range: "After event", color: "bg-earth-green" },
};
const statusOptions = ["draft", "scheduled", "published"];
const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-sunset-gold/20 text-sunset-gold",
  published: "bg-earth-green/20 text-earth-green",
};
const ideaCategories = ["Announcements", "Educational", "Engagement", "Behind-the-Scenes", "Countdown", "Post-Event"];
const refinements = ["Make it shorter", "Make it longer", "More emojis", "More professional", "More casual", "Add hashtags", "Add a call to action", "Make it funnier"];

export default function BuzzModule() {
  const { user } = useAuth();

  // Event state
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [eventData, setEventData] = useState<EventData | null>(null);

  // Posts / drafts
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState("dashboard");

  // AI Ideas
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

  // Custom Post Generator
  const [genPlatform, setGenPlatform] = useState("Instagram");
  const [genPostType, setGenPostType] = useState("Announcement");
  const [genPrompt, setGenPrompt] = useState("");
  const [genTone, setGenTone] = useState("Professional");
  const [genEmojis, setGenEmojis] = useState(true);
  const [genHashtagCount, setGenHashtagCount] = useState("5");
  const [genCta, setGenCta] = useState("");
  const [genResult, setGenResult] = useState("");
  const [genHashtags, setGenHashtags] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);

  // Hashtag generator
  const [hashKeywords, setHashKeywords] = useState("");
  const [hashResults, setHashResults] = useState<{ tag: string; tier: string }[]>([]);
  const [hashLoading, setHashLoading] = useState(false);

  // New post dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPlatform, setNewPlatform] = useState("Instagram");
  const [newPhase, setNewPhase] = useState("launch");
  const [newDate, setNewDate] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit dialog
  const [editPost, setEditPost] = useState<ContentPost | null>(null);
  const [editContent, setEditContent] = useState("");

  // Load events
  useEffect(() => {
    if (!user) return;
    supabase
      .from("events")
      .select("id, name, event_date, city, country, tagline, theme_statement, event_type")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const evts = (data || []) as EventData[];
        setEvents(evts);
        if (evts.length > 0 && !selectedEvent) {
          setSelectedEvent(evts[0].id);
          setEventData(evts[0]);
        }
      });
  }, [user]);

  useEffect(() => {
    const ev = events.find((e) => e.id === selectedEvent);
    setEventData(ev || null);
  }, [selectedEvent, events]);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    if (!selectedEvent) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("content_posts")
      .select("*")
      .eq("event_id", selectedEvent)
      .order("scheduled_date", { ascending: true, nullsFirst: false });
    setPosts(data || []);
    setLoading(false);
  }, [selectedEvent]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // --- AI Functions ---
  const generateIdeas = async () => {
    if (!eventData) return;
    setIdeasLoading(true);
    setIdeas([]);
    try {
      const { data, error } = await supabase.functions.invoke("buzz-generate", {
        body: {
          mode: "ideas",
          event_name: eventData.name,
          event_theme: eventData.theme_statement || eventData.tagline || "",
          event_date: eventData.event_date || "",
          event_location: [eventData.city, eventData.country].filter(Boolean).join(", "),
          audience: "",
          key_messages: eventData.tagline || "",
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Failed to generate ideas");
      } else {
        setIdeas(data.ideas || []);
        toast.success(`Generated ${data.ideas?.length || 0} content ideas!`);
      }
    } catch {
      toast.error("Failed to generate ideas.");
    }
    setIdeasLoading(false);
  };

  const generatePost = async () => {
    if (!eventData || !genPrompt.trim()) { toast.error("Enter a prompt first"); return; }
    setGenLoading(true);
    setGenResult("");
    setGenHashtags([]);
    try {
      const { data, error } = await supabase.functions.invoke("buzz-generate", {
        body: {
          mode: "post",
          event_name: eventData.name,
          event_theme: eventData.theme_statement || eventData.tagline || "",
          event_date: eventData.event_date || "",
          event_location: [eventData.city, eventData.country].filter(Boolean).join(", "),
          audience: "",
          platform: genPlatform,
          post_type: genPostType,
          user_prompt: genPrompt,
          tone: genTone,
          use_emojis: genEmojis,
          hashtag_count: parseInt(genHashtagCount),
          cta: genCta,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Failed to generate post");
      } else {
        setGenResult(data.content || "");
        setGenHashtags(data.hashtags || []);
      }
    } catch {
      toast.error("Failed to generate post.");
    }
    setGenLoading(false);
  };

  const refinePost = async (refinement: string) => {
    if (!genResult) return;
    setGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("buzz-generate", {
        body: {
          mode: "refine",
          original_post: genResult + "\n\n" + genHashtags.map((h) => `#${h}`).join(" "),
          refinement,
          platform: genPlatform,
          event_name: eventData?.name || "",
          event_theme: eventData?.theme_statement || eventData?.tagline || "",
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Refinement failed");
      } else {
        setGenResult(data.content || genResult);
        setGenHashtags(data.hashtags || genHashtags);
        toast.success("Post refined!");
      }
    } catch {
      toast.error("Refinement failed.");
    }
    setGenLoading(false);
  };

  const generateHashtags = async () => {
    if (!hashKeywords.trim()) return;
    setHashLoading(true);
    setHashResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("buzz-generate", {
        body: { mode: "hashtags", keywords: hashKeywords, platform: genPlatform },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Failed to generate hashtags");
      } else {
        setHashResults(data.hashtags || []);
      }
    } catch {
      toast.error("Failed to generate hashtags.");
    }
    setHashLoading(false);
  };

  // --- CRUD ---
  const addPost = async () => {
    if (!user || !selectedEvent || !newTitle.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("content_posts").insert({
      user_id: user.id, event_id: selectedEvent, title: newTitle.trim(),
      platform: newPlatform, phase: newPhase, scheduled_date: newDate || null,
      status: "draft", content: newContent.trim() || null,
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

  const saveGeneratedAsDraft = async (content: string, hashtags: string[], platform: string, title?: string) => {
    if (!user || !selectedEvent) return;
    const fullContent = content + (hashtags.length ? "\n\n" + hashtags.map((h) => `#${h}`).join(" ") : "");
    const { error } = await supabase.from("content_posts").insert({
      user_id: user.id, event_id: selectedEvent,
      title: title || `${platform} Post – ${format(new Date(), "MMM d")}`,
      platform, phase: "launch", status: "draft", content: fullContent,
    });
    if (error) toast.error(error.message);
    else { toast.success("Saved as draft!"); fetchPosts(); }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("content_posts").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else setPosts((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
  };

  const updatePostContent = async () => {
    if (!editPost) return;
    const { error } = await supabase.from("content_posts").update({ content: editContent }).eq("id", editPost.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Post updated!");
      setPosts((prev) => prev.map((p) => p.id === editPost.id ? { ...p, content: editContent } : p));
      setEditPost(null);
    }
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
      { title: "Save the Date Announcement", platform: "All", phase: "launch" },
      { title: "Early Bird Tickets", platform: "Instagram", phase: "launch" },
      { title: "Call for Speakers", platform: "LinkedIn", phase: "launch" },
      { title: "Behind the Scenes Teaser", platform: "WhatsApp", phase: "launch" },
      { title: "Speaker Reveal #1", platform: "Instagram", phase: "build" },
      { title: "Agenda Highlights", platform: "LinkedIn", phase: "build" },
      { title: "Sponsor Shoutout", platform: "Twitter", phase: "build" },
      { title: "Networking Tips", platform: "WhatsApp", phase: "build" },
      { title: "Venue & Logistics Info", platform: "All", phase: "final" },
      { title: "Countdown – 7 Days!", platform: "Instagram", phase: "final" },
      { title: "Last Chance Tickets", platform: "All", phase: "final" },
      { title: "See You There!", platform: "WhatsApp", phase: "final" },
      { title: "Thank You Post", platform: "All", phase: "post-event" },
      { title: "Highlight Reel", platform: "Instagram", phase: "post-event" },
    ];
    const rows = defaults.map((d) => ({ ...d, event_id: selectedEvent, user_id: user.id, status: "draft" }));
    const { error } = await supabase.from("content_posts").insert(rows);
    if (error) toast.error(error.message);
    else toast.success("90-day calendar loaded!");
    await fetchPosts();
    setAdding(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const useIdeaAsPrompt = (idea: ContentIdea) => {
    setGenPrompt(idea.description);
    setGenPlatform(idea.platforms[0] || "Instagram");
    setActiveTab("generator");
    toast.success("Idea loaded into generator!");
  };

  // --- Stats ---
  const draftCount = posts.filter((p) => p.status === "draft").length;
  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
  const publishedCount = posts.filter((p) => p.status === "published").length;

  const grouped = phases.reduce((acc, phase) => {
    acc[phase] = posts.filter((p) => p.phase === phase);
    return acc;
  }, {} as Record<string, ContentPost[]>);

  // --- Render ---
  return (
    <TooltipProvider>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Megaphone className="h-7 w-7 text-earth-green" /> The Buzz
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">AI-powered social media engine for your event.</p>
          </div>
          {events.length > 0 && (
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Select event" /></SelectTrigger>
              <SelectContent>
                {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {events.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Create an event first in The Spark module.</CardContent></Card>
        ) : !selectedEvent ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Select an event above.</CardContent></Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted flex flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard" className="text-xs sm:text-sm"><Megaphone className="h-3.5 w-3.5 mr-1" /> Dashboard</TabsTrigger>
              <TabsTrigger value="ideas" className="text-xs sm:text-sm"><Lightbulb className="h-3.5 w-3.5 mr-1" /> AI Ideas</TabsTrigger>
              <TabsTrigger value="generator" className="text-xs sm:text-sm"><PenTool className="h-3.5 w-3.5 mr-1" /> Create Post</TabsTrigger>
              <TabsTrigger value="drafts" className="text-xs sm:text-sm"><FileText className="h-3.5 w-3.5 mr-1" /> Drafts</TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs sm:text-sm"><Calendar className="h-3.5 w-3.5 mr-1" /> Calendar</TabsTrigger>
              <TabsTrigger value="hashtags" className="text-xs sm:text-sm"><Hash className="h-3.5 w-3.5 mr-1" /> Hashtags</TabsTrigger>
            </TabsList>

            {/* === DASHBOARD === */}
            <TabsContent value="dashboard" className="mt-6 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{draftCount}</p>
                    <p className="text-xs text-muted-foreground">Drafts</p>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-sunset-gold">{scheduledCount}</p>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-earth-green">{publishedCount}</p>
                    <p className="text-xs text-muted-foreground">Published</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => { setActiveTab("ideas"); if (ideas.length === 0) generateIdeas(); }}>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Lightbulb className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground">Generate Content Ideas</h3>
                      <p className="text-sm text-muted-foreground">AI curates 15 ideas based on your event</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setActiveTab("generator")}>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-earth-green/10 flex items-center justify-center shrink-0">
                      <PenTool className="h-6 w-6 text-earth-green" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground">Create Custom Post</h3>
                      <p className="text-sm text-muted-foreground">Write any prompt and get a tailored post</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent drafts preview */}
              {posts.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-display text-base flex items-center justify-between">
                      Recent Drafts
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("drafts")} className="text-xs">View All →</Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {posts.slice(0, 5).map((post) => (
                        <div key={post.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-xs shrink-0">{post.platform}</Badge>
                            <span className="truncate text-foreground">{post.title}</span>
                          </div>
                          <Badge className={`text-xs capitalize ${statusColors[post.status || "draft"]}`}>{post.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* === AI IDEAS === */}
            <TabsContent value="ideas" className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">AI Content Curator</h2>
                  <p className="text-sm text-muted-foreground">AI-generated ideas tailored to {eventData?.name}</p>
                </div>
                <Button variant="hero" onClick={generateIdeas} disabled={ideasLoading}>
                  {ideasLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  {ideas.length > 0 ? "Generate More" : "Generate Ideas"}
                </Button>
              </div>

              {ideasLoading && (
                <div className="flex flex-col items-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Curating content ideas for your event…</p>
                </div>
              )}

              {!ideasLoading && ideas.length === 0 && (
                <Card className="border-border">
                  <CardContent className="p-8 text-center">
                    <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="font-display text-lg font-semibold text-foreground mb-2">No ideas yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">Click "Generate Ideas" to get AI-curated content suggestions.</p>
                  </CardContent>
                </Card>
              )}

              {ideas.length > 0 && ideaCategories.map((cat) => {
                const catIdeas = ideas.filter((i) => i.category === cat);
                if (catIdeas.length === 0) return null;
                return (
                  <div key={cat} className="space-y-3">
                    <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                      <Badge variant="secondary">{cat}</Badge>
                      <span className="text-xs text-muted-foreground">{catIdeas.length} ideas</span>
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {catIdeas.map((idea, idx) => (
                        <Card key={idx} className="border-border hover:border-primary/30 transition-colors">
                          <CardContent className="p-4 space-y-3">
                            <div>
                              <h4 className="font-semibold text-foreground text-sm">{idea.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1">{idea.description}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {idea.platforms.map((p) => (
                                <Tooltip key={p}>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-xs gap-1 py-0.5">
                                      {platformIcons[p] || null} {p}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>{p}</TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {idea.hashtags.map((h) => (
                                <span key={h} className="text-xs text-primary">#{h}</span>
                              ))}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button size="sm" variant="outline" className="text-xs flex-1" onClick={() => useIdeaAsPrompt(idea)}>
                                <PenTool className="h-3 w-3 mr-1" /> Use as Prompt
                              </Button>
                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => saveGeneratedAsDraft(idea.description, idea.hashtags, idea.platforms[0] || "All", idea.title)}>
                                <Plus className="h-3 w-3 mr-1" /> Save
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            {/* === POST GENERATOR === */}
            <TabsContent value="generator" className="mt-6 space-y-6">
              <h2 className="font-display text-xl font-bold text-foreground">Custom Post Generator</h2>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Input side */}
                <Card className="border-border">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    {/* Platform buttons */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</Label>
                      <div className="flex flex-wrap gap-2">
                        {platforms.map((p) => (
                          <Button key={p} size="sm" variant={genPlatform === p ? "default" : "outline"} onClick={() => setGenPlatform(p)} className="gap-1.5 text-xs">
                            {platformIcons[p]} {p}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Post type & tone */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Post Type</Label>
                        <Select value={genPostType} onValueChange={setGenPostType}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{postTypes.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tone</Label>
                        <Select value={genTone} onValueChange={setGenTone}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{tones.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Prompt */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">What should this post be about?</Label>
                      <Textarea
                        placeholder="e.g., 'Write a fun post about early-bird tickets closing tomorrow' or 'Announce our keynote speaker Dr. Aisha'"
                        value={genPrompt}
                        onChange={(e) => setGenPrompt(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>

                    {/* Advanced options */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Hashtags</Label>
                        <Select value={genHashtagCount} onValueChange={setGenHashtagCount}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["0", "3", "5", "7", "10"].map((n) => <SelectItem key={n} value={n} className="text-xs">{n === "0" ? "None" : n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Call to Action</Label>
                        <Input placeholder="e.g., Register now" value={genCta} onChange={(e) => setGenCta(e.target.value)} className="text-xs" />
                      </div>
                    </div>

                    <Button variant="hero" className="w-full" onClick={generatePost} disabled={genLoading || !genPrompt.trim()}>
                      {genLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                      Generate Post
                    </Button>
                  </CardContent>
                </Card>

                {/* Output side */}
                <Card className="border-border">
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Post</Label>

                    {genLoading && (
                      <div className="flex flex-col items-center py-12 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Crafting your {genPlatform} post…</p>
                      </div>
                    )}

                    {!genLoading && !genResult && (
                      <div className="flex flex-col items-center py-12 text-center">
                        <PenTool className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">Your generated post will appear here.</p>
                      </div>
                    )}

                    {!genLoading && genResult && (
                      <>
                        <div className="rounded-lg border border-border p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed min-h-[100px]">
                          {genResult}
                        </div>
                        {genHashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {genHashtags.map((h) => <Badge key={h} variant="secondary" className="text-xs">#{h}</Badge>)}
                          </div>
                        )}

                        {/* Refine buttons */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Tweaks</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {refinements.map((r) => (
                              <Button key={r} size="sm" variant="outline" className="text-xs h-7" onClick={() => refinePost(r)} disabled={genLoading}>
                                {r}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(genResult + "\n\n" + genHashtags.map((h) => `#${h}`).join(" "))}>
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => saveGeneratedAsDraft(genResult, genHashtags, genPlatform)}>
                            <FileText className="h-3.5 w-3.5 mr-1" /> Save Draft
                          </Button>
                          <Button size="sm" variant="outline" onClick={generatePost} disabled={genLoading}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* === DRAFTS === */}
            <TabsContent value="drafts" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-foreground">My Drafts</h2>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="hero" size="sm"><Plus className="h-4 w-4 mr-1" /> New Post</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-display">Add Content Post</DialogTitle></DialogHeader>
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
                            <SelectContent>{[...platforms, "All"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Phase</Label>
                          <Select value={newPhase} onValueChange={setNewPhase}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{phases.map((p) => <SelectItem key={p} value={p}>{phaseLabels[p].label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Scheduled Date</Label>
                        <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea placeholder="Write your post copy..." value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={3} />
                      </div>
                      <Button variant="hero" className="w-full" onClick={addPost} disabled={adding || !newTitle.trim()}>
                        {adding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Add Post
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : posts.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="font-display text-lg font-semibold text-foreground mb-2">No drafts yet</h3>
                    <p className="text-sm text-muted-foreground">Generate content from the AI Ideas or Create Post tabs, or add manually.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {posts.map((post) => (
                    <Card key={post.id} className="border-border">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground text-sm">{post.title}</span>
                              <Badge variant="outline" className="text-xs gap-1">
                                {platformIcons[post.platform || ""] || null} {post.platform}
                              </Badge>
                              <Badge className={`text-xs capitalize ${statusColors[post.status || "draft"]}`}>{post.status}</Badge>
                            </div>
                            {post.content && (
                              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{post.content}</p>
                            )}
                            {post.scheduled_date && (
                              <p className="text-xs text-muted-foreground mt-1">📅 {format(new Date(post.scheduled_date), "MMM d, yyyy")}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditPost(post); setEditContent(post.content || ""); }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {post.content && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyToClipboard(post.content || "")}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Select value={post.status || "draft"} onValueChange={(v) => updateStatus(post.id, v)}>
                              <SelectTrigger className={`w-24 h-7 text-xs capitalize ${statusColors[post.status || "draft"]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((s) => <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deletePost(post.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* === CALENDAR === */}
            <TabsContent value="calendar" className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-foreground">90-Day Content Calendar</h2>
                {posts.length === 0 && (
                  <Button variant="outline" onClick={seedDefaults} disabled={adding}>
                    {adding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Load Template
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : posts.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="p-8 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="font-display text-lg font-semibold text-foreground mb-2">No posts planned</h3>
                    <p className="text-sm text-muted-foreground">Load the 90-day template or create posts from AI Ideas.</p>
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
                        <CardTitle className="font-display text-base flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${info.color}`} />
                          {info.label}
                          <span className="text-xs font-normal text-muted-foreground">({info.range})</span>
                          <Badge variant="secondary" className="text-xs ml-auto">{phasePosts.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1.5">
                          {phasePosts.map((post) => (
                            <div key={post.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors text-sm gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {post.scheduled_date && (
                                  <span className="text-xs text-muted-foreground w-16 shrink-0">{format(new Date(post.scheduled_date), "MMM d")}</span>
                                )}
                                <span className="truncate text-foreground">{post.title}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="outline" className="text-xs">{post.platform}</Badge>
                                <Badge className={`text-xs capitalize ${statusColors[post.status || "draft"]}`}>{post.status}</Badge>
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

            {/* === HASHTAGS === */}
            <TabsContent value="hashtags" className="mt-6 space-y-6">
              <h2 className="font-display text-xl font-bold text-foreground">Hashtag Generator</h2>
              <Card className="border-border">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Enter keywords related to your event</Label>
                    <div className="flex gap-2">
                      <Input placeholder="e.g., tech conference Lagos" value={hashKeywords} onChange={(e) => setHashKeywords(e.target.value)} className="flex-1" />
                      <Button variant="hero" onClick={generateHashtags} disabled={hashLoading || !hashKeywords.trim()}>
                        {hashLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {hashResults.length > 0 && (
                    <div className="space-y-3">
                      {["trending", "popular", "niche"].map((tier) => {
                        const tierTags = hashResults.filter((h) => h.tier === tier);
                        if (tierTags.length === 0) return null;
                        return (
                          <div key={tier}>
                            <Label className="text-xs capitalize mb-1.5 block text-muted-foreground">
                              {tier === "trending" ? "🔥 Trending" : tier === "popular" ? "⭐ Popular" : "🎯 Niche"}
                            </Label>
                            <div className="flex flex-wrap gap-1.5">
                              {tierTags.map((h) => (
                                <Badge
                                  key={h.tag}
                                  variant={tier === "trending" ? "default" : "secondary"}
                                  className="text-xs cursor-pointer hover:opacity-80"
                                  onClick={() => copyToClipboard(`#${h.tag}`)}
                                >
                                  #{h.tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(hashResults.map((h) => `#${h.tag}`).join(" "))}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy All
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Edit Post Dialog */}
        <Dialog open={!!editPost} onOpenChange={(open) => !open && setEditPost(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-display">Edit Post</DialogTitle></DialogHeader>
            {editPost && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{editPost.platform}</Badge>
                  <span className="text-sm font-medium text-foreground">{editPost.title}</span>
                </div>
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6} className="text-sm" />
                <div className="flex gap-2">
                  <Button variant="hero" className="flex-1" onClick={updatePostContent}>Save Changes</Button>
                  <Button variant="outline" onClick={() => copyToClipboard(editContent)}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
