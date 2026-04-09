import { useState } from "react";
import { Search, Download, Award, Loader2, ArrowLeft, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface LookupResult {
  attendee: {
    id: string;
    name: string;
    email: string | null;
    role: string | null;
    ticket_id: string;
    checked_in: boolean;
    certificate_url: string | null;
    certificate_sent_at: string | null;
  };
  event: {
    name: string;
    date: string | null;
    location: string | null;
  } | null;
}

export default function CertificateLookup() {
  const [ticketId, setTicketId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [sendingCert, setSendingCert] = useState(false);
  const [certSent, setCertSent] = useState(false);

  const handleLookup = async () => {
    const cleaned = ticketId.trim();
    if (cleaned.length < 3) {
      setError("Please enter your ticket ID (e.g. TKT-A1B2C3)");
      return;
    }
    setError("");
    setResult(null);
    setCertSent(false);
    setEmail("");
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("lookup-certificate", {
        body: { ticket_id: cleaned },
      });

      if (fnError) {
        setError("Something went wrong. Please try again.");
      } else if (data?.error) {
        setError(data.error);
      } else {
        setResult(data);
        if (data?.attendee?.email) {
          setEmail(data.attendee.email);
        }
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCertificate = async () => {
    if (!result || !email.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSendingCert(true);
    try {
      const certId = `CERT-${result.attendee.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
      const { data, error: certError } = await supabase.functions.invoke("send-certificate", {
        body: {
          attendeeId: result.attendee.id,
          attendeeName: result.attendee.name,
          attendeeEmail: email.trim(),
          eventName: result.event?.name || "Event",
          eventDate: result.event?.date || null,
          eventLocation: result.event?.location || null,
          certificateId: certId,
          certMode: "auto",
        },
      });

      if (certError) {
        toast.error("Failed to generate certificate. Please try again.");
      } else if (data?.certificateUrl) {
        setCertSent(true);
        setResult((prev) =>
          prev
            ? {
                ...prev,
                attendee: {
                  ...prev.attendee,
                  certificate_url: data.certificateUrl,
                  certificate_sent_at: new Date().toISOString(),
                },
              }
            : prev
        );
        toast.success("Certificate generated and sent to your email!");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSendingCert(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-display font-bold text-foreground">Download Certificate</h1>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 py-8 sm:py-16">
        <div className="w-full max-w-md space-y-6">
          {/* Intro */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
              <Award className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              Your Certificate
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your ticket ID to get your event certificate.
              You can find it on your badge or registration confirmation.
            </p>
          </div>

          {/* Search form */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter ticket ID (e.g. TKT-A1B2C3)"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                className="pl-9 font-mono tracking-wider"
                maxLength={20}
              />
            </div>
            <Button
              onClick={handleLookup}
              disabled={loading || ticketId.trim().length < 3}
              className="w-full gradient-sunset text-primary-foreground"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Looking up…</>
              ) : (
                <><Search className="h-4 w-4 mr-2" /> Find My Certificate</>
              )}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Result */}
          {result && (
            <Card className="border-border overflow-hidden">
              <div className="h-2 gradient-sunset" />
              <CardContent className="p-6 space-y-4">
                {/* Attendee info */}
                <div className="text-center space-y-1">
                  <p className="font-display font-bold text-xl text-foreground">{result.attendee.name}</p>
                  {result.attendee.role && (
                    <Badge className="gradient-sunset text-primary-foreground text-xs border-transparent">
                      {result.attendee.role}
                    </Badge>
                  )}
                </div>

                {/* Event info */}
                {result.event && (
                  <div className="bg-muted rounded-lg p-3 text-center space-y-1">
                    <p className="font-display font-semibold text-sm text-foreground">{result.event.name}</p>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      {result.event.date && <span>{new Date(result.event.date).toLocaleDateString()}</span>}
                      {result.event.date && result.event.location && <span>·</span>}
                      {result.event.location && <span>{result.event.location}</span>}
                    </div>
                  </div>
                )}

                {/* Ticket ID */}
                <div className="text-center">
                  <p className="font-mono text-xs text-muted-foreground tracking-widest">
                    {result.attendee.ticket_id}
                  </p>
                </div>

                {/* Certificate download or generate */}
                {result.attendee.certificate_url ? (
                  <a
                    href={result.attendee.certificate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button className="w-full gradient-sunset text-primary-foreground" size="lg">
                      <Download className="h-5 w-5 mr-2" /> Download Certificate
                    </Button>
                  </a>
                ) : result.attendee.checked_in ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center">
                      Enter your email to receive your certificate:
                    </p>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendCertificate()}
                        className="pl-9"
                      />
                    </div>
                    <Button
                      onClick={handleSendCertificate}
                      disabled={sendingCert || !email.trim()}
                      className="w-full gradient-sunset text-primary-foreground"
                      size="lg"
                    >
                      {sendingCert ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</>
                      ) : (
                        <><Send className="h-4 w-4 mr-2" /> Generate & Send Certificate</>
                      )}
                    </Button>
                    {certSent && (
                      <p className="text-xs text-center text-[hsl(var(--earth-green))]">
                        ✓ Certificate sent! Check your email or click download above.
                      </p>
                    )}
                  </div>
                ) : (
                  <Card className="border-border bg-muted/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Your certificate will be available after you check in at the event.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by <Link to="/" className="text-primary hover:underline font-medium">Myevent</Link>
        </p>
      </footer>
    </div>
  );
}
