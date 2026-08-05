import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Camera, ArrowLeft, Loader2, AlertTriangle, ScanLine, Zap, ZapOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type ScanResult = {
  ok: boolean;
  status: "checked_in" | "already" | "not_found" | "invalid";
  reason?: string;
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
  const inFlightRef = useRef<Set<string>>(new Set());
  const autoStartedRef = useRef(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCam, setActiveCam] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const feedback = (ok: boolean) => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = ok ? 880 : 220;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      }
    } catch {}
    try { navigator.vibrate?.(ok ? 60 : [40, 40, 40]); } catch {}
  };

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
    if (!eventId || !code) return;
    // Allow back-to-back scans: only block the exact same code while it's in flight
    if (inFlightRef.current.has(code)) return;
    inFlightRef.current.add(code);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("qr-check-in", { body: { eventId, code } });
      if (error) throw new Error(error.message || "Scan failed");
      const r = data as ScanResult;
      setResult(r);
      if (r.tierCounts) setCounts(r.tierCounts);
      if (r.status === "checked_in") { feedback(true); toast.success(`✓ ${r.attendee?.name} checked in`); }
      else if (r.status === "already") { feedback(false); toast.info(`${r.attendee?.name} is already in`); }
      else if (r.status === "invalid") { feedback(false); toast.error(r.reason || "Invalid or forged QR code"); }
      else { feedback(false); toast.error("Ticket not recognised"); }
    } catch (e: any) {
      toast.error(e.message || "Scan failed");
    } finally {
      inFlightRef.current.delete(code);
      setBusy(false);
    }
  };

  const startScanner = async (deviceId?: string) => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      // Enumerate cameras once so users can flip front/back if needed
      if (cameras.length === 0) {
        try {
          const cams = await Html5Qrcode.getCameras();
          setCameras(cams.map((c: any) => ({ id: c.id, label: c.label || "Camera" })));
          if (!deviceId && cams.length) {
            const back = cams.find((c: any) => /back|rear|environment/i.test(c.label || ""));
            deviceId = back?.id || cams[cams.length - 1].id;
          }
        } catch {}
      }
      // Give the DOM a beat to mount the region
      await new Promise((r) => setTimeout(r, 80));
      const scanner = new Html5Qrcode("qr-scan-region", { verbose: false } as any);
      scannerRef.current = scanner;
      const cameraSpec: any = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } };
      const config = {
        fps: 30,
        qrbox: (w: number, h: number) => {
          const side = Math.floor(Math.min(w, h) * 0.9);
          return { width: side, height: side };
        },
        aspectRatio: 1.0,
        disableFlip: true,
        videoConstraints: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 1280 }, focusMode: "continuous" }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 }, focusMode: "continuous" },
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        rememberLastUsedCamera: true,
      } as any;
      await scanner.start(
        config.videoConstraints,
        config,
        (decoded: string) => {
          const now = Date.now();
          // De-dupe the same badge briefly, but never delay a different badge
          if (decoded === lastScanRef.current.code && now - lastScanRef.current.at < 1200) return;
          lastScanRef.current = { code: decoded, at: now };
          void submitCode(decoded);
        },
        () => {}
      );
      setActiveCam(deviceId || null);
      // Torch detection
      try {
        const caps = (scanner as any).getRunningTrackCapabilities?.();
        setTorchAvailable(!!caps?.torch);
      } catch { setTorchAvailable(false); }
    } catch (err: any) {
      toast.error(err?.message?.includes("Permission") ? "Camera permission denied — enable it in your browser settings." : "Could not access camera. Try HTTPS or a different browser.");
      setScanning(false);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch { toast.error("Torch not supported on this device"); }
  };

  const switchCamera = async () => {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex((c) => c.id === activeCam);
    const next = cameras[(idx + 1) % cameras.length];
    await stopScanner();
    await new Promise((r) => setTimeout(r, 120));
    await startScanner(next.id);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setTorchOn(false);
    setScanning(false);
  };

  useEffect(() => { return () => { void stopScanner(); }; }, []);

  // Auto-start the camera the moment the page opens so a badge is captured instantly
  useEffect(() => {
    if (authLoading || !user || !eventId || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, eventId]);

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
                <p className="font-display text-lg font-bold">
                  {result.status === "checked_in" ? `Welcome, ${result.attendee?.name}!`
                    : result.status === "already" ? `${result.attendee?.name} is already in`
                    : result.status === "invalid" ? "Invalid ticket — do not admit"
                    : "Ticket not found"}
                </p>
                {result.status === "invalid" && (
                  <p className="text-xs text-muted-foreground">{result.reason || "This QR code could not be verified for this event."}</p>
                )}
                {result.attendee && (
                  <div className="mt-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{(result.attendee.role || "General").toUpperCase()}</Badge>
                      <Badge className="gradient-sunset text-primary-foreground">Admits {result.attendee.admits}</Badge>
                      <Badge variant="outline">{result.attendee.ticket_id}</Badge>
                    </div>
                    {(result.attendee.email || result.attendee.phone) && (
                      <p className="truncate text-xs text-muted-foreground">{result.attendee.email || result.attendee.phone}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scanner */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            className={scanning ? "flex-1" : "gradient-sunset text-primary-foreground w-full"}
            variant={scanning ? "destructive" : "default"}
            onClick={() => (scanning ? stopScanner() : startScanner())}
          >
            <Camera className="mr-2 h-5 w-5" />
            {scanning ? "Stop Camera" : "Start Camera Scanner"}
          </Button>
          {scanning && torchAvailable && (
            <Button size="lg" variant="outline" onClick={toggleTorch} title="Toggle torch">
              {torchOn ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </Button>
          )}
          {scanning && cameras.length > 1 && (
            <Button size="lg" variant="outline" onClick={switchCamera} title="Switch camera">
              <RefreshCw className="h-5 w-5" />
            </Button>
          )}
        </div>
        {scanning && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-black shadow-lg">
            <div id="qr-scan-region" className="w-full [&_video]:w-full [&_video]:h-auto" />
            {/* Corner reticle overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[70%] aspect-square">
                <span className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-[hsl(var(--sunset-gold))] rounded-tl-lg" />
                <span className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-[hsl(var(--sunset-gold))] rounded-tr-lg" />
                <span className="absolute left-0 bottom-0 h-8 w-8 border-l-4 border-b-4 border-[hsl(var(--sunset-gold))] rounded-bl-lg" />
                <span className="absolute right-0 bottom-0 h-8 w-8 border-r-4 border-b-4 border-[hsl(var(--sunset-gold))] rounded-br-lg" />
                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-[hsl(var(--sunset-gold))]/70 animate-pulse" />
              </div>
            </div>
            {busy && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/60 py-2 text-xs text-white">
                <Loader2 className="h-3 w-3 animate-spin" /> Verifying ticket…
              </div>
            )}
          </div>
        )}
        {scanning && (
          <p className="text-center text-xs text-muted-foreground">Hold the QR code steady inside the frame — scans happen automatically.</p>
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