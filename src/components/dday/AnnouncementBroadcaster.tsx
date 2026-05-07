import { useMemo, useState } from "react";
import { Megaphone, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Attendee } from "@/hooks/useAttendees";

interface Props { eventId: string; eventName: string; attendees: Attendee[]; }

const TIERS = ["General", "VIP", "VVIP"] as const;

export default function AnnouncementBroadcaster({ eventId, eventName, attendees }: Props) {
  const [subject, setSubject] = useState(`📣 Update from ${eventName}`);
  const [message, setMessage] = useState(`Hi {{name}},\n\nQuick update for {{event}}.\n\n— The team`);
  const [tiers, setTiers] = useState<Set<string>>(new Set(TIERS));
  const [audience, setAudience] = useState<"all" | "checked_in" | "not_checked_in">("all");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; failed: number; recipients: number } | null>(null);

  const recipientCount = useMemo(() => {
    return attendees.filter((a) => {
      if (!a.email) return false;
      const tier = (a.role || "").toUpperCase() === "VVIP" ? "VVIP" : (a.role || "").toUpperCase() === "VIP" ? "VIP" : "General";
      if (!tiers.has(tier)) return false;
      if (audience === "checked_in" && !a.checked_in) return false;
      if (audience === "not_checked_in" && a.checked_in) return false;
      return true;
    }).length;
  }, [attendees, tiers, audience]);

  const toggleTier = (t: string, on: boolean) => {
    setTiers((prev) => { const n = new Set(prev); if (on) n.add(t); else n.delete(t); return n; });
  };

  const send = async () => {
    if (!subject.trim() || !message.trim()) { toast.error("Subject and message are required"); return; }
    if (tiers.size === 0) { toast.error("Select at least one tier"); return; }
    if (recipientCount === 0) { toast.error("No attendees match this audience"); return; }
    setSending(true); setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-announcement", {
        body: {
          eventId, subject, message,
          tiers: Array.from(tiers),
          onlyCheckedIn: audience === "checked_in",
          onlyNotCheckedIn: audience === "not_checked_in",
        },
      });
      if (error) throw new Error(error.message || "Send failed");
      const r = data as any;
      setLastResult({ sent: r.sent || 0, failed: r.failed || 0, recipients: r.recipients || 0 });
      if ((r.failed || 0) === 0) toast.success(`Announcement sent to ${r.sent} attendee(s)`);
      else toast.warning(`Sent ${r.sent}, ${r.failed} failed`);
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <Megaphone className="h-5 w-5 text-primary" /> Public Announcement
          </CardTitle>
          <p className="text-xs text-muted-foreground">Send a message via email to attendees on file. Variables: <code>{"{{name}}"}</code>, <code>{"{{event}}"}</code>, <code>{"{{ticket}}"}</code>, <code>{"{{role}}"}</code>.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} className="font-mono text-sm" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Tiers</Label>
              <div className="flex flex-wrap gap-3">
                {TIERS.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={tiers.has(t)} onCheckedChange={(v) => toggleTier(t, !!v)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Audience</Label>
              <RadioGroup value={audience} onValueChange={(v) => setAudience(v as any)} className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="all" /> All</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="checked_in" /> Checked-in only</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="not_checked_in" /> Not yet checked-in</label>
              </RadioGroup>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm">
              <span className="font-display text-lg font-bold text-primary">{recipientCount}</span>{" "}
              attendee(s) with email match this audience
            </p>
            <Button onClick={send} disabled={sending || recipientCount === 0} className="gradient-sunset text-primary-foreground">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send to {recipientCount}
            </Button>
          </div>

          {lastResult && (
            <div className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--earth-green))]" />
              Delivered <Badge variant="secondary">{lastResult.sent}/{lastResult.recipients}</Badge>
              {lastResult.failed > 0 && <Badge variant="destructive">{lastResult.failed} failed</Badge>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}