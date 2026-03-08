/**
 * TeamManager — Invite team members by email with role selection.
 * Sends invitation emails via edge function and shows invite link as fallback.
 * Displays pending/accepted members with status badges.
 */

import { useState, useEffect } from "react";
import { UserPlus, Shield, Loader2, Trash2, Copy, Check, Mail, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  invitation_token: string | null;
  created_at: string;
}

interface Props {
  eventId: string;
}

export default function TeamManager({ eventId }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("event_team_members")
      .select("id, invited_email, role, status, invitation_token, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setMembers((data as TeamMember[]) || []);
  };

  useEffect(() => { fetchMembers(); }, [eventId]);

  const invite = async () => {
    if (!email.trim() || !user) return;
    setLoading(true);

    // 1. Create the invite record
    const { data: insertData, error } = await supabase
      .from("event_team_members")
      .insert({
        event_id: eventId,
        invited_email: email.trim().toLowerCase(),
        invited_by: user.id,
        role,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message.includes("duplicate") ? "Already invited" : error.message);
      setLoading(false);
      return;
    }

    // 2. Send invitation email via edge function
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("send-team-invite", {
        body: { inviteId: insertData.id },
      });

      if (fnError) {
        console.error("Email send error:", fnError);
        toast.success("Invitation created! Copy the invite link to share it.");
      } else if (fnData?.emailSent) {
        toast.success(`Invitation email sent to ${email}`);
      } else {
        toast.success("Invitation created! Copy the invite link to share it.");
      }
    } catch (err) {
      console.error("Edge function call failed:", err);
      toast.success("Invitation created! Copy the invite link to share it.");
    }

    setEmail("");
    fetchMembers();
    setLoading(false);
  };

  const remove = async (id: string) => {
    await supabase.from("event_team_members").delete().eq("id", id);
    toast.success("Removed team member");
    fetchMembers();
  };

  const copyInviteLink = (token: string | null, memberId: string) => {
    if (!token) return;
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(memberId);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resendInvite = async (memberId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-team-invite", {
        body: { inviteId: memberId },
      });
      if (error) throw error;
      if (data?.emailSent) {
        toast.success("Invitation resent!");
      } else {
        toast.info("Could not send email. Use the copy link instead.");
      }
    } catch {
      toast.error("Failed to resend invitation");
    }
  };

  return (
    <div className="space-y-4">
      {/* Invite Form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Invite Team Member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong>Admin:</strong> Full access (upload, check-in, export, manage team).
            <br />
            <strong>Staff:</strong> Check-in only.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && invite()}
            />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={invite} disabled={loading || !email.trim()} className="gradient-sunset text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-1" /> Invite</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team List */}
      {members.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Team ({members.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-bold shrink-0">
                    {m.invited_email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{m.invited_email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-xs">{m.role}</Badge>
                      <Badge
                        variant={m.status === "accepted" ? "default" : "secondary"}
                        className={`text-xs ${m.status === "accepted" ? "bg-[hsl(var(--earth-green))] border-0" : ""}`}
                      >
                        {m.status === "accepted" ? (
                          <><CheckCircle className="h-3 w-3 mr-0.5" /> Accepted</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-0.5" /> Pending</>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {m.status === "pending" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyInviteLink(m.invitation_token, m.id)}
                        title="Copy invite link"
                      >
                        {copiedId === m.id ? (
                          <Check className="h-4 w-4 text-[hsl(var(--earth-green))]" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => resendInvite(m.id)}
                        title="Resend invitation email"
                      >
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
