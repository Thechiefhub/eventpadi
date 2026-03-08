/**
 * AcceptInvite page — handles the /invite/:token route.
 * 
 * Flow:
 * 1. Reads the invitation token from the URL
 * 2. Fetches the invite details (event name, role)
 * 3. If user is not logged in → redirects to /auth with returnTo param
 * 4. If user is logged in → accepts the invite (sets user_id, status=accepted)
 * 5. Redirects to the D-Day dashboard
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";

interface InviteData {
  id: string;
  event_id: string;
  invited_email: string;
  role: string;
  status: string;
  token_expires_at: string;
  events: { name: string } | null;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Fetch the invite by token
  useEffect(() => {
    if (!token) { setError("Invalid invitation link"); setLoading(false); return; }

    const fetchInvite = async () => {
      const { data, error: fetchError } = await supabase
        .from("event_team_members")
        .select("id, event_id, invited_email, role, status, token_expires_at, events(name)")
        .eq("invitation_token", token)
        .single();

      if (fetchError || !data) {
        setError("Invitation not found or has been revoked.");
        setLoading(false);
        return;
      }

      const inviteData = data as unknown as InviteData;

      if (inviteData.status === "accepted") {
        setAccepted(true);
        setInvite(inviteData);
        setLoading(false);
        return;
      }

      if (new Date(inviteData.token_expires_at) < new Date()) {
        setError("This invitation has expired. Please ask the event admin to resend it.");
        setLoading(false);
        return;
      }

      setInvite(inviteData);
      setLoading(false);
    };

    fetchInvite();
  }, [token]);

  // If not logged in, redirect to auth with return URL
  useEffect(() => {
    if (!authLoading && !user && !loading && invite && !error) {
      const returnTo = `/invite/${token}`;
      navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [authLoading, user, loading, invite, error, token, navigate]);

  const handleAccept = async () => {
    if (!user || !invite) return;
    setAccepting(true);

    const { error: updateError } = await supabase
      .from("event_team_members")
      .update({ user_id: user.id, status: "accepted" })
      .eq("id", invite.id)
      .eq("status", "pending");

    if (updateError) {
      toast.error("Failed to accept invitation: " + updateError.message);
      setAccepting(false);
      return;
    }

    setAccepted(true);
    setAccepting(false);
    toast.success("Invitation accepted! Welcome to the team.");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center text-center py-8 space-y-4">
            <XCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-display font-bold text-foreground">Invalid Invitation</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link to="/">
              <Button variant="outline">Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center text-center py-8 space-y-4">
            <CheckCircle className="h-12 w-12 text-[hsl(var(--earth-green))]" />
            <h2 className="text-lg font-display font-bold text-foreground">You're in!</h2>
            <p className="text-sm text-muted-foreground">
              You've joined <strong>{invite?.events?.name || "the event"}</strong> as{" "}
              <Badge variant="outline">{invite?.role}</Badge>.
            </p>
            <Button onClick={() => navigate("/dashboard/dday")} className="gradient-sunset text-primary-foreground gap-2">
              Go to D-Day Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show accept prompt
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            <CalendarCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="font-display text-xl">Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            You've been invited to join
          </p>
          <h3 className="text-lg font-display font-bold text-foreground">
            {invite?.events?.name || "an event"}
          </h3>
          <div className="flex justify-center">
            <Badge className="gradient-sunset text-primary-foreground border-0 text-sm px-3 py-1">
              {invite?.role === "admin" ? "Admin" : "Registration Staff"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {invite?.role === "admin"
              ? "Full access: upload attendees, manage check-ins, export data, and manage the team."
              : "You'll be able to check in attendees at the event."}
          </p>
          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full gradient-sunset text-primary-foreground"
            size="lg"
          >
            {accepting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Accept Invitation
          </Button>
          <p className="text-xs text-muted-foreground">
            Logged in as <strong>{user?.email}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
