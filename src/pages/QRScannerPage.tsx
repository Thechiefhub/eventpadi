import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Camera, ArrowLeft, Loader2, AlertTriangle, ScanLine, Zap, ZapOff, RefreshCw, Timer, CornerDownLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { describeScan, shouldSubmitScan, formatCheckedInAgo, type ScanResult } from "@/lib/scan-conflict";

/** How long an attendee's details stay on screen after a scan, so the door
 *  team can verify them before the next badge is processed. */
const HOLD_MS = 30000;

export default function QRScannerPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [eventName, setEventName] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [conflict, setConflict] = useState<ScanResult | null>(null);
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
  const [holdUntil, setHoldUntil] = useState(0);
  const [holdLeft, setHoldLeft] = useState(0);

  // Countdown for the review window
  useEffect(() => {
    if (!holdUntil) { setHoldLeft(0); return; }
    const tick = () => {
      const left = Math.max(0, Math.ceil((holdUntil - Date.now()) / 1000));
      setHoldLeft(left);
      if (left === 0) setHoldUntil(0);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [holdUntil]);

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
      const copy = describeScan(r);
      feedback(copy.tone === "success");
      // Keep the attendee's details on screen for the review window.
      setHoldUntil(Date.now() + HOLD_MS);
      if (copy.tone === "success") {
        toast.success(copy.title);
      } else {
        // Conflicts get an explicit, explained dialog — the camera keeps running
        // underneath so the next badge is never delayed by the prompt.
        setConflict(r);
      }
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
      const config = {
        fps: 25,
        qrbox: (w: number, h: number) => {
          const side = Math.floor(Math.min(w, h) * 0.92);
          return { width: side, height: side };
        },
        aspectRatio: 1.0,
        disableFlip: true,
        videoConstraints: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, focusMode: "continuous", advanced: [{ focusMode: "continuous" }, { exposureMode: "continuous" }] }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, focusMode: "continuous", advanced: [{ focusMode: "continuous" }, { exposureMode: "continuous" }] },
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        rememberLastUsedCamera: true,
      } as any;
      await scanner.start(
        config.videoConstraints,
        config,
        (decoded: string) => {
          const now = Date.now();
          // Hold the same badge for the whole review window (so it never flips
          // to "already checked in" while the team is verifying), but never
          // delay a *different* badge — the next attendee scans immediately.
          if (!shouldSubmitScan(decoded, lastScanRef.current, now, HOLD_MS)) return;
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

  const clearResult = useCallback(() => {
    setHoldUntil(0);
    setResult(null);
    lastScanRef.current = { code: "", at: 0 };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Enter/Space clears the current result so the next badge can scan immediately.
      if ((e.key === "Enter" || e.key === " ") && result) {
        e.preventDefault();
        clearResult();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, clearResult]);

  useEffect(() => { return () => { void stopScanner(); }; }, []);

  // Auto-start the camera the moment the page opens so a badge is captured instantly
  useEffect(() => {
    if (authLoading || !user || !eventId || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startScanner();
    // Warm the check-in function container + TLS connection so the very first
    // real scan doesn't pay cold-start latency.
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qr-check-in`;
      void fetch(url, { method: "OPTIONS", mode: "cors" }).catch(() => {});
    } catch { /* warm-up is best effort */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, eventId]);

  const totalCi = useMemo(() => Object.values(counts).reduce((s, v) => s + v.checkedIn, 0), [counts]);
  const totalReg = useMemo(() => Object.values(counts).reduce((s, v) => s + v.total, 0), [counts]);
  const conflictCopy = useMemo(() => (conflict ? describeScan(conflict) : null), [conflict]);

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

        {/* Result banner — designed for fast, at-a-glance door decisions */}
        {result && (
          <Card
            className={
              result.status === "checked_in"
                ? "border-2 border-[hsl(var(--earth-green))] bg-[hsl(var(--earth-green)/0.12)] shadow-lg"
                : result.status === "already"
                ? "border-2 border-[hsl(var(--sunset-gold))] bg-[hsl(var(--sunset-gold)/0.12)] shadow-lg"
                : "border-2 border-destructive bg-destructive/10 shadow-lg"
            }
          >
            <CardContent className="p-4">
              {/* Big status verdict */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {result.status === "checked_in" ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--earth-green))]/20">
                      <CheckCircle2 className="h-7 w-7 text-[hsl(var(--earth-green))]" />
                    </div>
                  ) : result.status === "already" ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--sunset-gold))]/20">
                      <AlertTriangle className="h-7 w-7 text-[hsl(var(--sunset-gold))]" />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
                      <XCircle className="h-7 w-7 text-destructive" />
                    </div>
                  )}
                  <div>
                    <p
                      className={
                        "font-display text-lg font-bold " +
                        (result.status === "checked_in"
                          ? "text-[hsl(var(--earth-green))]"
                          : result.status === "already"
                          ? "text-[hsl(var(--sunset-gold))]"
                          : "text-destructive")
                      }
                    >
                      {result.status === "checked_in" ? "ADMIT — CHECKED IN" : result.status === "already" ? "ALREADY INSIDE — HOLD" : "DO NOT ADMIT"}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">{describeScan(result).title}</p>
                  </div>
                </div>
                {holdLeft > 0 && (
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold tabular-nums leading-none">{holdLeft}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">seconds left</p>
                  </div>
                )}
              </div>

              {/* Attendee details */}
              {result.attendee?.name && (
                <div className="mt-4 rounded-xl border border-white/10 bg-background/50 p-3">
                  <p className="font-display text-3xl font-bold leading-tight text-foreground">{result.attendee.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-sm">{(result.attendee.role || "General").toUpperCase()}</Badge>
                    <Badge className="gradient-sunset text-primary-foreground text-sm">Admits {result.attendee.admits}</Badge>
                    <Badge variant="outline" className="text-sm">{result.attendee.ticket_id}</Badge>
                  </div>
                  {(result.attendee.email || result.attendee.phone) && (
                    <p className="mt-2 truncate text-xs text-muted-foreground">{result.attendee.email || result.attendee.phone}</p>
                  )}
                </div>
              )}

              <p className="mt-3 text-xs text-muted-foreground">{describeScan(result).explanation}</p>

              {/* Primary action: huge, fast next-scan button */}
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  size="lg"
                  className="gradient-sunset h-14 w-full text-base font-bold text-primary-foreground"
                  onClick={clearResult}
                  autoFocus
                >
                  <CornerDownLeft className="mr-2 h-5 w-5" /> Scan next attendee
                </Button>
                <p className="text-center text-[10px] text-muted-foreground">Press Enter or Space to clear and continue</p>
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

      {/* Conflict flow — explains duplicate / invalid badges without stopping the camera */}
      <Dialog open={!!conflict} onOpenChange={(o) => { if (!o) setConflict(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left">
              {conflictCopy?.tone === "warning"
                ? <AlertTriangle className="h-6 w-6 shrink-0 text-[hsl(var(--sunset-gold))]" />
                : <XCircle className="h-6 w-6 shrink-0 text-destructive" />}
              <span>{conflictCopy?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{conflictCopy?.explanation}</p>
            {conflict?.attendee && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-semibold">{conflict.attendee.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{(conflict.attendee.role || "General").toUpperCase()}</Badge>
                  <Badge className="gradient-sunset text-primary-foreground">Admits {conflict.attendee.admits}</Badge>
                  <Badge variant="outline">{conflict.attendee.ticket_id}</Badge>
                </div>
                {conflict.status === "already" && conflict.checkedInAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    First entry {formatCheckedInAgo(conflict.checkedInAt)}
                    {conflict.checkedInByName ? ` · scanned by ${conflict.checkedInByName}` : ""}
                  </p>
                )}
              </div>
            )}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">What to do</p>
              <p className="mt-1 text-sm text-foreground">{conflictCopy?.action}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {conflict?.status === "not_found" && (
              <Button variant="outline" onClick={() => { setConflict(null); navigate("/dashboard/dday"); }}>
                Open check-in list
              </Button>
            )}
            <Button className="gradient-sunset text-primary-foreground" onClick={() => setConflict(null)}>
              Keep scanning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}