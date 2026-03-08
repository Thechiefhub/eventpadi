import { useState, useEffect } from "react";
import { UserPlus, Shield, Loader2, Trash2 } from "lucide-react";
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

  const fetchMembers = async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("event_team_members")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setMembers((data as TeamMember[]) || []);
  };

  useEffect(() => { fetchMembers(); }, [eventId]);

  const invite = async () => {
    if (!email.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("event_team_members").insert({
      event_id: eventId,
      invited_email: email.trim().toLowerCase(),
      invited_by: user.id,
      role,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Already invited" : error.message);
    } else {
      toast.success(`Invited ${email} as ${role}`);
      setEmail("");
      fetchMembers();
    }
    setLoading(false);
  };

  const remove = async (id: string) => {
    await supabase.from("event_team_members").delete().eq("id", id);
    toast.success("Removed team member");
    fetchMembers();
  };

  return (
    <div className="space-y-4">
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
              <div key={m.id} className="flex items-center justify-between p-2 rounded bg-muted">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-bold shrink-0">
                    {m.invited_email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.invited_email}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">{m.role}</Badge>
                      <Badge variant={m.status === "accepted" ? "default" : "secondary"} className="text-xs">
                        {m.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
