import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Camera, ArrowLeft, Loader2, AlertTriangle, ScanLine } from "lucide-react";
import { toast } from "sonner";

type ScanResult = {
  ok: boolean;
  status: "checked_in" | "already" | "not_found";
  attendee?: any;
  tierCounts?: Record<string, { total: number; checkedIn: number }>;
};

export default function QRScannerPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [eventName, setEventName] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [counts, setCounts] = useState<Record<string, { total: number; checkedIn: number }>>({
    General: { total: 0, checkedIn: 0 }, VIP: { total: 0, checkedIn: 0 }, VVIP: { total: 0, checkedIn: 0 },
  });
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    if (!eventId) return;
    supabase.from("events").select("name").eq("id", eventId).maybeSingle().then(({ data }) => {
      if (data) setEventName(data.name);
    });
    supabase.from("attendees").select("role,checked_in").eq("event_id", eventId).then(({ data }) => {
      const out = { General: { total: 0, checkedIn: 0 }, VIP: { total: 0, checkedIn: 0 }, VVIP: { total: 0, checkedIn: 0 } } as any;
      (data || []).forEach((r: any) => {
        const k = (r.role || "").toUpperCase() === "VVIP" ? "VVIP" : (r.role || "").toUpperCase() === "VIP" ? "VIP" : "General";
        out[k].total += 1; if (r.checked_in) out[k].checkedIn += 1;
      });
      setCounts(out);
    });
    const ch = supabase.channel(`scan-${eventId}`).on("postgres_changes", {
      event: "*", schema: "public", table: "attendees", filter: `event_id=eq.${eventId}`,
    }, () => {
      supabase.from("attendees").select("role,checked_in").eq("event_id", eventId).then(({ data }) => {
        const out = { General: { total: 0, checkedIn: 0 }, VIP: { total: 0, checkedIn: 0 }, VVIP: { total: 0, checkedIn: 0 } } as any;
        (data || []).forEach((r: any) => {
          const k = (r.role || "").toUpperCase() === "VVIP" ? "VVIP" : (r.role || "").toUpperCase() === "VIP" ? "VIP" : "General";
          out[k].total += 1; if (r.checked_in) out[k].checkedIn += 1;
        });
        setCounts(out);
      });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId]);

  const submitCode = async (code: string) => {
    if (!eventId || !code || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("qr-check-in", { body: { eventId, code } });
      if (error) throw new Error(error.message || "Scan failed");
      const r = data as ScanResult;
      setResult(r);
      if (r.tierCounts) setCounts(r.tierCounts);
      if (r.status === "checked_in") toast.success(`✓ ${r.attendee?.name} checked in`);
      else if (r.status === "already") toast.info(`${r.attendee?.name} is already in`);
      else toast.error("Ticket not recognised");
    } catch (e: any) {
      toast.error(e.message || "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const startScanner = async () => {
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    setTimeout(async () => {
      const scanner = new Html5Qrcode("qr-scan-region");
      scannerRef.current = scanner;
      try {
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded) => {
            const now = Date.now();
            if (decoded === lastScanRef.current.code && now - lastScanRef.current.at < 3000) return;
            lastScanRef.current = { code: decoded, at: now };
            submitCode(decoded);
          },
          () => {}
        );
      } catch {
        toast.error("Could not access camera");
        setScanning(false);
      }
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
    setScanning(false);
  };

  useEffect(() => () => stopScanner(), []);

  const totalCi = useMemo(() => Object.values(counts).reduce((s, v) => s + v.checkedIn, 0), [counts]);
  const totalReg = useMemo(() => Object.values(counts).reduce((s, v) => s + v.total, 0), [counts]);

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) {
    navigate(`/auth?redirect=/scan/${eventId}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/dday")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> D-Day
          </Button>
          <Badge variant="outline" className="border-primary text-primary"><ScanLine className="mr-1 h-3 w-3" />Scanner</Badge>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Scanning for</p>
          <h1 className="font-display text-2xl font-bold">{eventName || "Event"}</h1>
        </div>

        {/* Live counts */}
        <Card>
          <CardContent className="grid grid-cols-4 gap-3 p-4">
            {(["General","VIP","VVIP"] as const).map((t) => (
              <div key={t} className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t}</p>
                <p className="font-display text-xl font-bold text-foreground">{counts[t]?.checkedIn ?? 0}<span className="text-sm text-muted-foreground">/{counts[t]?.total ?? 0}</span></p>
              </div>
            ))}
            <div className="text-center border-l border-border">
              <p className="text-[10px] uppercase tracking-wide text-primary">Total In</p>
              <p className="font-display text-xl font-bold text-primary">{totalCi}<span className="text-sm text-muted-foreground">/{totalReg}</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Result banner */}
        {result && (
          <Card className={
            result.status === "checked_in" ? "border-[hsl(var(--earth-green))] bg-[hsl(var(--earth-green)/0.1)]"
            : result.status === "already" ? "border-[hsl(var(--sunset-gold))] bg-[hsl(var(--sunset-gold)/0.1)]"
            : "border-destructive bg-destructive/10"
          }>
            <CardContent className="flex items-center gap-3 p-4">
              {result.status === "checked_in" ? <CheckCircle2 className="h-8 w-8 text-[hsl(var(--earth-green))]" />
                : result.status === "already" ? <AlertTriangle className="h-8 w-8 text-[hsl(var(--sunset-gold))]" />
                : <XCircle className="h-8 w-8 text-destructive" />}
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold">
                  {result.status === "checked_in" ? `Welcome, ${result.attendee?.name}!`
                    : result.status === "already" ? `${result.attendee?.name} is already in`
                    : "Ticket not found"}
                </p>
                {result.attendee && (
                  <p className="text-xs text-muted-foreground truncate">
                    <Badge variant="secondary" className="mr-1">{(result.attendee.role || "General").toUpperCase()}</Badge>
                    Admit {result.attendee.admits} · {result.attendee.ticket_id}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scanner */}
        <Button
          size="lg"
          className={scanning ? "" : "gradient-sunset text-primary-foreground w-full"}
          variant={scanning ? "destructive" : "default"}
          onClick={scanning ? stopScanner : startScanner}
        >
          <Camera className="mr-2 h-5 w-5" />
          {scanning ? "Stop Camera" : "Start Camera Scanner"}
        </Button>
        {scanning && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div id="qr-scan-region" className="w-full" />
          </div>
        )}

        {/* Manual entry */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-medium text-muted-foreground">Or enter ticket ID manually</p>
            <div className="flex gap-2">
              <Input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="TKT-XXXXXX" />
              <Button onClick={() => { submitCode(manualCode.trim()); setManualCode(""); }} disabled={busy || !manualCode.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check In"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}